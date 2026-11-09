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
import { MusicService } from '../core/services/music.service';
import { MediaHubStore } from '../core/store/mediahub.store';
import { ToastService } from '../core/services/toast.service';
import { IconComponent } from '../shared/icon.component';
import { formatDuration } from '../core/util/format';

/**
 * Mini-reproductor de música.
 *
 * Usa un elemento `<audio>` real apuntando al archivo original empaquetado; la
 * app no transcodifica ni copia la música.
 */
@Component({
  selector: 'mh-music-player',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './music-player.component.html',
})
export class MusicPlayerComponent implements OnDestroy {
  readonly music = inject(MusicService);
  readonly store = inject(MediaHubStore);
  private readonly toast = inject(ToastService);

  readonly audioRef = viewChild<ElementRef<HTMLAudioElement>>('audioEl');
  readonly queueOpen = signal(false);
  readonly eqOpen = signal(false);
  readonly dragIndex = signal<number | null>(null);

  private timer: ReturnType<typeof setInterval> | undefined;
  private vizTimer: ReturnType<typeof setInterval> | undefined;
  private lastSave = 0;

  readonly visible = computed(() => !!this.music.current());
  readonly current = computed(() => this.music.current());
  readonly bars = Array.from({ length: 24 }, (_, i) => i);

  readonly equalizerPresets: string[] = ['Flat', 'Rock', 'Pop', 'Jazz', 'Classical', 'Bass boost'];

  readonly presetGains: Record<string, number[]> = {
    Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    Rock: [6, 4, 1, -2, -3, 0, 4, 6, 6, 5],
    Pop: [-2, 2, 5, 6, 4, 1, -1, -1, 1, 2],
    Jazz: [3, 2, 1, 2, -1, -1, 0, 2, 3, 4],
    Classical: [4, 3, 1, 0, -1, -1, 0, 2, 3, 4],
    'Bass boost': [9, 7, 4, 1, 0, 0, 0, 0, 0, 0],
  };

  constructor() {
    effect(() => {
      const track = this.music.current();
      const el = this.audioRef()?.nativeElement;
      if (!track || !el) return;
      el.src = track.source;
      el.volume = this.music.volume() / 100;
      el.playbackRate = 1;
      el.play().catch(() => {
        /* el autoplay puede estar bloqueado hasta que el usuario interactúe */
      });
      this.music.setPosition(0);
      this.store.dispatch({ type: 'PlayTrackCommand', payload: track.id });
      document.body.classList.add('has-mini');
    });

    effect(() => {
      const el = this.audioRef()?.nativeElement;
      if (!el) return;
      el.volume = this.music.volume() / 100;
      el.muted = this.music.muted();
    });

    this.timer = setInterval(() => {
      const el = this.audioRef()?.nativeElement;
      if (!el || !this.music.playing()) return;
      if (!el.paused && el.duration) {
        this.music.setPosition(el.currentTime);
        this.music.setDuration(el.duration);
        return;
      }
      /* respaldo: si el medio no se puede decodificar, avanzamos la línea de tiempo */
      const duration = this.music.duration();
      if (!duration) return;
      const next = this.music.position() + 1;
      if (next >= duration) {
        if (this.music.repeat() === 'one') {
          this.music.setPosition(0);
        } else {
          this.music.next();
          return;
        }
      } else {
        this.music.setPosition(next);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    clearInterval(this.vizTimer);
    document.body.classList.remove('has-mini');
  }

  /* --------------------------------- audio --------------------------------- */

  onTimeUpdate(): void {
    const el = this.audioRef()?.nativeElement;
    if (!el || !el.duration) return;
    this.music.setPosition(el.currentTime);
    this.music.setDuration(el.duration);
  }

  onEnded(): void {
    if (this.music.repeat() === 'one') {
      const el = this.audioRef()?.nativeElement;
      if (el) {
        el.currentTime = 0;
        el.play().catch(() => undefined);
      }
      return;
    }
    this.music.next();
  }

  onError(): void {
    this.toast.warn('No se pudo decodificar el medio; la línea de tiempo avanza de forma simulada.');
  }

  toggle(): void {
    const el = this.audioRef()?.nativeElement;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => undefined);
      this.music.playing.set(true);
    } else {
      el.pause();
      this.music.playing.set(false);
    }
  }

  next(): void {
    this.music.next();
  }

  previous(): void {
    this.music.previous();
  }

  seek(value: string): void {
    const pct = Number(value);
    const duration = this.music.duration();
    if (!duration) return;
    const seconds = (pct / 100) * duration;
    const el = this.audioRef()?.nativeElement;
    if (el && el.duration) el.currentTime = seconds;
    this.music.setPosition(seconds);
  }

  setVolume(value: string): void {
    const v = Number(value);
    this.music.setVolume(v);
    this.store.dispatch({ type: 'SetStateCommand', payload: { volume: v } });
  }

  toggleShuffle(): void {
    this.music.toggleShuffle();
    this.store.dispatch({ type: 'SetStateCommand', payload: { shuffle: this.music.shuffle() } });
    this.toast.show('Aleatorio inteligente ' + (this.music.shuffle() ? 'activado' : 'desactivado'), 'info');
  }

  cycleRepeat(): void {
    this.music.cycleRepeat();
    this.store.dispatch({ type: 'SetStateCommand', payload: { repeatMode: this.music.repeat() } });
    const label = { off: 'desactivada', all: 'toda la cola', one: 'pista actual' }[this.music.repeat()];
    this.toast.show('Repetición: ' + label, 'info');
  }

  close(): void {
    const el = this.audioRef()?.nativeElement;
    if (el) {
      el.pause();
      el.removeAttribute('src');
    }
    this.music.close();
    document.body.classList.remove('has-mini');
  }

  /* --------------------------------- cola --------------------------------- */

  playFromQueue(index: number): void {
    const track = this.music.queue()[index];
    if (!track) return;
    this.music.play(track);
  }

  removeFromQueue(index: number): void {
    const track = this.music.queue()[index];
    if (!track) return;
    this.music.removeFromQueue(track.id);
  }

  onDragStart(index: number): void {
    this.dragIndex.set(index);
  }

  onDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    const from = this.dragIndex();
    if (from === null || from === index) return;
    this.music.reorderQueue(from, index);
    this.dragIndex.set(index);
  }

  onDragEnd(): void {
    this.dragIndex.set(null);
  }

  clearQueue(): void {
    this.music.close();
    this.queueOpen.set(false);
    this.toast.show('Cola vaciada.', 'info');
  }

  /* ------------------------------ ecualizador ------------------------------ */

  applyPreset(preset: string): void {
    const gains = (this.presetGains[preset] ?? this.presetGains['Flat']).slice();
    this.store.dispatch({
      type: 'SetStateCommand',
      payload: { equalizer: { enabled: true, preset, gains } },
    });
    this.music.equalizerPreset.set(preset);
    this.music.equalizerEnabled.set(true);
  }

  setGain(index: number, value: string): void {
    const current = this.store.state().equalizer;
    const gains = current.gains.slice();
    gains[index] = Number(value);
    this.store.dispatch({
      type: 'SetStateCommand',
      payload: { equalizer: { enabled: true, preset: 'Manual', gains } },
    });
    this.music.equalizerPreset.set('Manual');
  }

  toggleVisualizer(): void {
    this.music.visualizer.update((v) => !v);
    this.store.dispatch({ type: 'SetStateCommand', payload: { visualizer: this.music.visualizer() } });
  }

  readonly formatDuration = formatDuration;
}
