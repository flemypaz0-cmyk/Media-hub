import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { PlayerService } from '../core/services/player.service';
import { MediaHubStore } from '../core/store/mediahub.store';
import { ToastService } from '../core/services/toast.service';
import { IconComponent } from '../shared/icon.component';
import { ArtComponent } from '../shared/art.component';
import { formatDuration } from '../core/util/format';
import { Episode, ImageAdjustments, LibraryEntry } from '../core/models';

type PanelKind =
  | 'none'
  | 'audio'
  | 'subs'
  | 'quality'
  | 'chapters'
  | 'image'
  | 'substyle'
  | 'sleep'
  | 'keys'
  | 'cast';

interface AbRange {
  a: number | null;
  b: number | null;
}

/**
 * Reproductor de vídeo a pantalla completa.
 *
 * Reproduce el mismo archivo original que ya está en la biblioteca (la app no
 * transcodifica ni copia nada): el `source` del elemento apunta al medio
 * empaquetado en `public/assets/media`.
 */
@Component({
  selector: 'mh-video-player',
  standalone: true,
  imports: [IconComponent, ArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './video-player.component.html',
})
export class VideoPlayerComponent implements OnDestroy {
  readonly player = inject(PlayerService);
  readonly store = inject(MediaHubStore);
  private readonly toast = inject(ToastService);

  /** Campos del panel de ajustes de imagen. */
  readonly adjustmentFields: { key: keyof Omit<ImageAdjustments, 'toneMapping'>; label: string; min: number; max: number }[] = [
    { key: 'contrast', label: 'Contraste', min: 50, max: 200 },
    { key: 'brightness', label: 'Brillo', min: 50, max: 200 },
    { key: 'sharpness', label: 'Nitidez', min: 0, max: 200 },
    { key: 'saturation', label: 'Saturación', min: 0, max: 200 },
    { key: 'shadows', label: 'Sombras', min: 0, max: 200 },
    { key: 'highlights', label: 'Luces altas', min: 0, max: 200 },
    { key: 'gamma', label: 'Gamma', min: 50, max: 200 },
    { key: 'denoise', label: 'Reducción de ruido', min: 0, max: 100 },
  ];

  readonly shortcuts: [string, string][] = [
    ['Espacio / K', 'Reproducir o pausar'],
    ['J / L', 'Retroceder 30 s / avanzar 30 s'],
    ['← / →', 'Saltar 10 s'],
    ['↑ / ↓', 'Volumen'],
    ['M', 'Silenciar'],
    ['F', 'Pantalla completa'],
    ['P', 'Picture-in-picture'],
    ['C', 'Pista de subtítulos'],
    ['A', 'Pista de audio'],
    ['I', 'Ajustes de imagen'],
    ['R', 'Repetir desde el inicio'],
    ['Esc', 'Cerrar reproductor'],
  ];

  readonly devices: string[] = [
    'Escritorio — Chrome (1080p)',
    'TV del salón — Fire TV',
    'Auriculares Bluetooth',
    'ChromeCast Ultra',
  ];

  readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  readonly stageRef = viewChild<ElementRef<HTMLElement>>('playerStage');

  readonly panel = signal<PanelKind>('none');
  readonly feedbackIcon = signal<string | null>(null);
  readonly scrub = signal<{ x: number; time: number; seed: string } | null>(null);
  readonly ab = signal<AbRange>({ a: null, b: null });
  readonly nextCount = signal<number | null>(null);
  readonly nextTitle = signal('');
  readonly subtitleSample = signal<string | null>(null);
  readonly uiHidden = signal(false);
  readonly selectedQuality = signal('Automática');
  readonly selectedAudioTrack = signal<string | null>(null);
  readonly selectedSubtitleTrack = signal<string | null>(null);

  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  private nextTimer: ReturnType<typeof setTimeout> | undefined;
  private sleepTimer: ReturnType<typeof setTimeout> | undefined;
  private lastSave = 0;

  readonly item = computed(() => this.player.current());
  readonly title = computed(() => this.item()?.title ?? '—');
  readonly subtitle = computed(() => {
    const item = this.item();
    if (!item) return '—';
    const prefix =
      item.kind === 'episode' && item.seriesTitle
        ? `${item.seriesTitle} · T${item.seasonNumber}E${item.number ?? ''} · `
        : '';
    return prefix + (item.path || '');
  });

  readonly skipIntroVisible = computed(() => {
    const item = this.item();
    if (!item || !item.introEnd) return false;
    const t = this.player.position();
    return t >= item.introStart && t < item.introEnd;
  });

  readonly skipCreditsVisible = computed(() => {
    const item = this.item();
    if (!item || item.creditsEnd <= item.creditsStart) return false;
    const t = this.player.position();
    return t >= item.creditsStart && t < item.creditsEnd;
  });

  readonly abStyle = computed(() => {
    const range = this.ab();
    const duration = this.player.duration();
    if (range.a === null || duration <= 0) return null;
    const a = (range.a / duration) * 100;
    const b = range.b !== null ? (range.b / duration) * 100 : this.player.progressPercent();
    return { left: a + '%', width: Math.max(0, b - a) + '%' };
  });

  readonly filter = computed(() => {
    const a = this.store.state().imageAdjustments;
    const base = `brightness(${a.brightness / 100}) contrast(${a.contrast / 100}) saturate(${a.saturation / 100})`;
    return a.toneMapping ? `${base} sepia(.08)` : base;
  });

  readonly subtitleStyle = computed(() => {
    const st = this.store.state().subtitleStyle;
    return {
      fontSize: (st.size / 100) * 1.6 + 'rem',
      color: st.color,
      background: st.bg,
      opacity: st.opacity / 100,
      fontFamily: `'${st.font}', sans-serif`,
      bottom: st.position === 'bottom' ? '118px' : 'auto',
      top: st.position === 'top' ? '90px' : 'auto',
    };
  });

  constructor() {
    effect(() => {
      const item = this.player.current();
      const el = this.videoRef()?.nativeElement;
      if (!item || !el) return;

      this.cancelNext();
      el.src = item.source || '/assets/media/clip-01.mp4';
      el.volume = this.player.volume() / 100;
      el.muted = this.player.muted();
      el.playbackRate = this.player.rate();
      this.ab.set({ a: null, b: null });
      this.lastSave = 0;

      const nominalDuration = item.duration || 0;
      this.player.setDuration(nominalDuration);
      this.player.setPosition(item.progress || 0);

      el.play().catch(() => {
        /* el navegador puede bloquear el autoplay: el usuario pulsa reproducir */
      });
    });

    effect(() => {
      const el = this.videoRef()?.nativeElement;
      if (!el) return;
      el.playbackRate = this.player.rate();
      el.volume = this.player.volume() / 100;
      el.muted = this.player.muted();
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.hideTimer);
    clearTimeout(this.feedbackTimer);
    clearTimeout(this.nextTimer);
    clearTimeout(this.sleepTimer);
  }

  /* ------------------------------ reproducción ------------------------------ */

  onTimeUpdate(): void {
    const el = this.videoRef()?.nativeElement;
    const item = this.item();
    if (!el || !item) return;

    const nominalDuration = item.duration || el.duration || 0;
    const mediaDuration = el.duration || 0;

    let logicalPos = el.currentTime;
    if (mediaDuration > 0 && nominalDuration > mediaDuration) {
      const ratio = el.currentTime / mediaDuration;
      logicalPos = Math.round(ratio * nominalDuration);
    }

    this.player.setPosition(logicalPos);
    this.player.setDuration(nominalDuration);

    /* repetir A-B */
    const range = this.ab();
    if (range.a !== null && range.b !== null && logicalPos >= range.b) {
      if (mediaDuration > 0 && nominalDuration > mediaDuration) {
        el.currentTime = (range.a / nominalDuration) * mediaDuration;
      } else {
        el.currentTime = range.a;
      }
    }

    /* guardado periódico del progreso */
    if (nominalDuration > 0 && Math.abs(logicalPos - this.lastSave) > 10) {
      this.lastSave = logicalPos;
      if (item.kind === 'video') {
        this.store.dispatch({ type: 'UpdateProgressCommand', payload: { id: item.id, progress: logicalPos } });
      }
    }

    /* cuenta atrás del siguiente episodio si llegamos a los créditos finales */
    if (
      item.kind === 'episode' &&
      this.store.state().autoplayNext &&
      item.creditsStart > 0 &&
      item.creditsEnd > item.creditsStart &&
      logicalPos >= item.creditsStart &&
      this.nextCount() === null
    ) {
      this.setupNextEpisode(item);
    }
  }

  onLoadedMetadata(): void {
    const el = this.videoRef()?.nativeElement;
    const item = this.item();
    if (!el || !item) return;

    const nominalDuration = item.duration || el.duration || 0;
    this.player.setDuration(nominalDuration);

    const mediaDuration = el.duration || 0;
    if (mediaDuration > 0) {
      if (item.progress && item.progress > 0 && item.progress < nominalDuration - 10) {
        let targetTime = item.progress;
        if (nominalDuration > mediaDuration) {
          const ratio = item.progress / nominalDuration;
          targetTime = ratio * (mediaDuration - 1.5);
        }
        el.currentTime = Math.max(0, Math.min(mediaDuration - 1.5, targetTime));
        this.player.setPosition(item.progress);
      } else {
        el.currentTime = 0;
        this.player.setPosition(0);
      }
    }
  }

  onEnded(): void {
    const item = this.item();
    if (!item) return;
    if (item.kind === 'video') {
      this.store.dispatch({ type: 'MarkVideoWatchedCommand', payload: item.id });
    } else if (item.seriesId) {
      this.store.dispatch({
        type: 'MarkEpisodeWatchedCommand',
        payload: { seriesId: item.seriesId, episodeId: item.id },
      });
      if (this.store.state().autoplayNext && this.nextCount() === null) {
        this.setupNextEpisode(item);
        return;
      }
    }
    this.toast.success('Reproducción finalizada.');
  }

  togglePlay(): void {
    const el = this.videoRef()?.nativeElement;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => undefined);
      this.feedback('play');
    } else {
      el.pause();
      this.feedback('pause');
    }
    this.player.toggle();
  }

  skip(seconds: number): void {
    const el = this.videoRef()?.nativeElement;
    const item = this.item();
    if (!el || !item) return;

    const nominalDuration = item.duration || el.duration || 0;
    const mediaDuration = el.duration || 0;

    const curLogical = this.player.position();
    const newLogical = Math.max(0, Math.min(nominalDuration, curLogical + seconds));

    if (mediaDuration > 0 && nominalDuration > mediaDuration) {
      const ratio = newLogical / (nominalDuration || 1);
      el.currentTime = Math.max(0, Math.min(mediaDuration - 0.5, ratio * mediaDuration));
    } else {
      el.currentTime = Math.max(0, Math.min(mediaDuration, el.currentTime + seconds));
    }
    this.player.setPosition(newLogical);
    this.feedback(seconds > 0 ? 'forward10' : 'replay10');
  }

  restart(): void {
    const el = this.videoRef()?.nativeElement;
    if (!el) return;
    el.currentTime = 0;
    this.player.setPosition(0);
    el.play().catch(() => undefined);
    this.feedback('repeat');
    this.toast.show('Reproduciendo desde el inicio.', 'info');
  }

  seekFromEvent(event: MouseEvent): void {
    const track = (event.currentTarget as HTMLElement) ?? null;
    const el = this.videoRef()?.nativeElement;
    const item = this.item();
    if (!track || !el || !item) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));

    const nominalDuration = item.duration || el.duration || 0;
    const mediaDuration = el.duration || 0;

    if (mediaDuration > 0) {
      el.currentTime = Math.min(ratio * mediaDuration, Math.max(0, mediaDuration - 0.5));
    }
    const logicalPos = Math.round(ratio * nominalDuration);
    this.player.setPosition(logicalPos);
  }

  onTrackMove(event: MouseEvent): void {
    const track = event.currentTarget as HTMLElement;
    const stage = this.stageRef()?.nativeElement;
    const el = this.videoRef()?.nativeElement;
    if (!track || !stage || !el) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const t = ratio * (el.duration || 0);
    const stageRect = stage.getBoundingClientRect();
    this.scrub.set({
      x: Math.max(90, Math.min(stageRect.width - 90, rect.left - stageRect.left + ratio * rect.width)),
      time: t,
      seed: 'escena ' + Math.floor(t / 30),
    });
  }

  close(): void {
    const el = this.videoRef()?.nativeElement;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    clearTimeout(this.nextTimer);
    clearTimeout(this.sleepTimer);
    this.nextCount.set(null);
    this.panel.set('none');
    this.player.close();
  }

  /* -------------------------------- velocidad -------------------------------- */

  onSpeed(value: string): void {
    const pct = (Number(value) - 100) / 100;
    const rate = 1 + pct;
    this.player.setRate(rate);
    this.store.dispatch({ type: 'SetStateCommand', payload: { playbackRate: rate } });
  }

  formatRate(rate: number): string {
    return (Math.round(rate * 100) / 100).toString().replace('.', ',') + 'x';
  }

  /* ------------------------------ volumen ------------------------------ */

  onVolume(value: string): void {
    const v = Number(value);
    this.player.setVolume(v);
    this.store.dispatch({ type: 'SetStateCommand', payload: { volume: v } });
  }

  toggleMute(): void {
    this.player.toggleMute();
  }

  /* -------------------------------- A-B -------------------------------- */

  toggleAb(): void {
    const el = this.videoRef()?.nativeElement;
    if (!el) return;
    const current = this.ab();
    if (current.a === null) {
      this.ab.set({ a: el.currentTime, b: null });
      this.toast.show('Punto A marcado en ' + formatDuration(el.currentTime), 'info');
    } else if (current.b === null) {
      this.ab.set({ a: current.a, b: el.currentTime });
      this.toast.show('Punto B marcado en ' + formatDuration(el.currentTime), 'info');
    } else {
      this.ab.set({ a: null, b: null });
      this.toast.show('Repetición A-B desactivada.', 'info');
    }
  }

  /* ------------------------------ skip intro ------------------------------ */

  skipIntro(): void {
    const item = this.item();
    const el = this.videoRef()?.nativeElement;
    if (!item || !el) return;
    el.currentTime = item.introEnd;
    this.toast.show('Intro saltada.', 'info');
  }

  skipCredits(): void {
    const item = this.item();
    const el = this.videoRef()?.nativeElement;
    if (!item || !el) return;
    el.currentTime = item.creditsEnd;
    this.toast.show('Créditos saltados.', 'info');
  }

  /* --------------------------- siguiente episodio --------------------------- */

  private setupNextEpisode(item: LibraryEntry): void {
    clearTimeout(this.nextTimer);
    this.nextCount.set(null);
    if (item.kind !== 'episode' || !this.store.state().autoplayNext) return;
    const next = this.nextEpisodeOf(item as Episode);
    if (!next) return;

    this.nextTitle.set(next.title);
    let count = 5;
    this.nextCount.set(count);
    const tick = () => {
      if (count <= 0) {
        this.nextCount.set(null);
        this.openNext(next);
        return;
      }
      this.nextCount.set(count);
      count--;
      this.nextTimer = setTimeout(tick, 1000);
    };
    this.nextTimer = setTimeout(tick, 1000);
  }

  private nextEpisodeOf(item: Episode): Episode | null {
    const series = this.store.seriesById(item.seriesId ?? '');
    if (!series) return null;
    let found: Episode | null = null;
    series.seasons.forEach((sn) =>
      sn.episodes.forEach((e) => {
        if (!found && e.number === (item.number ?? 0) + 1) found = e;
      }),
    );
    return found;
  }

  private openNext(episode: Episode): void {
    const series = this.store.seriesById(episode.seriesId);
    const entry: LibraryEntry = {
      ...episode,
      kind: 'episode',
      seriesId: episode.seriesId,
      seriesTitle: series?.title ?? episode.seriesTitle,
      seasonNumber: episode.seasonNumber,
    };
    this.player.openItem(entry, this.player.queue());
  }

  cancelNext(): void {
    clearTimeout(this.nextTimer);
    this.nextCount.set(null);
    this.toast.show('Reproducción automática cancelada.', 'info');
  }

  playNextNow(): void {
    clearTimeout(this.nextTimer);
    this.nextCount.set(null);
    const item = this.item();
    if (!item || item.kind !== 'episode') return;
    const next = this.nextEpisodeOf(item as Episode);
    if (next) this.openNext(next);
  }

  /* -------------------------------- paneles -------------------------------- */

  openPanel(kind: PanelKind): void {
    this.panel.set(this.panel() === kind ? 'none' : kind);
  }

  panelTitle(): string {
    const titles: Record<PanelKind, string> = {
      none: 'Ajustes',
      audio: 'Pista de audio',
      subs: 'Pista de subtítulos',
      quality: 'Calidad de reproducción',
      chapters: 'Capítulos',
      image: 'Ajustes de imagen',
      substyle: 'Ajustes de subtítulos',
      sleep: 'Temporizador de suspensión',
      keys: 'Atajos de teclado',
      cast: 'Dispositivos en la red local',
    };
    return titles[this.panel()];
  }

  selectAudioTrack(id: string | null): void {
    this.selectedAudioTrack.set(id);
    this.toast.show(id ? 'Pista de audio seleccionada.' : 'Sin pista de audio adicional.', 'info');
  }

  selectSubtitleTrack(id: string | null, language: string): void {
    this.selectedSubtitleTrack.set(id);
    if (id) {
      this.subtitleSample.set(`[${language}] Ejemplo de subtítulo sincronizado`);
      setTimeout(() => this.subtitleSample.set(null), 3500);
    } else {
      this.subtitleSample.set(null);
    }
  }

  selectQuality(option: string): void {
    this.selectedQuality.set(option);
    this.toast.show('Calidad: ' + option, 'info');
  }

  jumpToChapter(start: number): void {
    const el = this.videoRef()?.nativeElement;
    if (!el) return;
    el.currentTime = start;
    this.toast.show('Capítulo: ' + formatDuration(start), 'info');
  }

  /* --------------------------- ajustes de imagen --------------------------- */

  updateAdjustment(key: string, value: string): void {
    const current = this.store.state().imageAdjustments;
    const next = { ...current, [key]: Number(value) };
    this.store.dispatch({ type: 'SetStateCommand', payload: { imageAdjustments: next } });
  }

  toggleToneMapping(): void {
    const current = this.store.state().imageAdjustments;
    this.store.dispatch({
      type: 'SetStateCommand',
      payload: { imageAdjustments: { ...current, toneMapping: !current.toneMapping } },
    });
  }

  resetAdjustments(): void {
    this.store.dispatch({
      type: 'SetStateCommand',
      payload: {
        imageAdjustments: {
          contrast: 100,
          brightness: 100,
          sharpness: 100,
          saturation: 100,
          shadows: 100,
          highlights: 100,
          gamma: 100,
          denoise: 0,
          toneMapping: false,
        },
      },
    });
    this.toast.show('Ajustes de imagen restablecidos.', 'info');
  }

  updateSubtitleStyle(key: string, value: string | number): void {
    const current = this.store.state().subtitleStyle;
    this.store.dispatch({
      type: 'SetStateCommand',
      payload: { subtitleStyle: { ...current, [key]: value } },
    });
  }

  /* ------------------------------ temporizador ------------------------------ */

  setSleepTimer(minutes: number): void {
    clearTimeout(this.sleepTimer);
    this.store.dispatch({ type: 'SetStateCommand', payload: { sleepTimer: minutes } });
    if (minutes > 0) {
      this.sleepTimer = setTimeout(() => {
        this.videoRef()?.nativeElement?.pause();
        this.toast.show('El reproductor se pausó por el temporizador.', 'info');
        this.store.dispatch({ type: 'SetStateCommand', payload: { sleepTimer: 0 } });
      }, minutes * 60000);
      this.toast.show('Temporizador de ' + minutes + ' minutos activado.', 'info');
    } else {
      this.toast.show('Temporizador cancelado.', 'info');
    }
    this.panel.set('sleep');
  }

  /* --------------------------- picture in picture --------------------------- */

  async togglePip(): Promise<void> {
    const el = this.videoRef()?.nativeElement;
    if (!el) return;
    if (!document.pictureInPictureEnabled) {
      this.toast.error('Picture-in-picture no disponible en este navegador.');
      return;
    }
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await el.requestPictureInPicture();
      }
    } catch {
      this.toast.error('Picture-in-picture no disponible en este navegador.');
    }
  }

  async toggleFullscreen(): Promise<void> {
    const stage = this.stageRef()?.nativeElement;
    if (!stage) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await stage.requestFullscreen();
      }
    } catch {
      this.toast.error('Pantalla completa no disponible.');
    }
  }

  castTo(device: string): void {
    this.toast.show('Transmitiendo a: ' + device, 'info');
  }

  /* ------------------------------ interacciones ------------------------------ */

  feedback(icon: string): void {
    this.feedbackIcon.set(icon);
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => this.feedbackIcon.set(null), 550);
  }

  onStageMove(): void {
    this.uiHidden.set(false);
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      const el = this.videoRef()?.nativeElement;
      if (el && !el.paused) this.uiHidden.set(true);
    }, 2600);
  }

  onStageLeave(): void {
    const el = this.videoRef()?.nativeElement;
    if (el && !el.paused) this.uiHidden.set(true);
  }

  readonly formatDuration = formatDuration;
}
