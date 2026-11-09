import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DialogService } from '../core/services/dialog.service';
import { FileExplorerService } from '../core/services/file-explorer.service';
import { MediaHubStore } from '../core/store/mediahub.store';
import { ToastService } from '../core/services/toast.service';
import { ComboBoxComponent } from './combo-box.component';
import { IconComponent } from './icon.component';
import { ExplorerResult, FileExplorerDialogComponent } from './file-explorer-dialog.component';
import { Episode, Series, Track, Video } from '../core/models';

export type MediaFormKind = 'video' | 'episode' | 'series' | 'track';

interface FormContext {
  kind: MediaFormKind;
  id?: string;
  seriesId?: string;
}

type Tab = 'basico' | 'pistas' | 'taxonomia' | 'imagen';

/**
 * Formulario compartido de alta y edición.
 *
 * Se usa tanto para vídeos independientes como para episodios, series y
 * pistas, de modo que las dos variantes del contenido (episodio / vídeo
 * suelto) tengan exactamente las mismas funciones.
 */
@Component({
  selector: 'mh-media-form',
  standalone: true,
  imports: [ComboBoxComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media-form.component.html',
})
export class MediaFormComponent {
  readonly data = input.required<FormContext>();

  private readonly dialogs = inject(DialogService);
  readonly store = inject(MediaHubStore);
  private readonly toast = inject(ToastService);
  private readonly explorerService = inject(FileExplorerService);

  readonly tab = signal<Tab>('basico');
  readonly isEdit = computed(() => !!this.data().id);

  /* ------------------------------ campos ------------------------------ */
  readonly title = signal('');
  readonly synopsis = signal('');
  readonly notes = signal('');
  readonly path = signal('');
  readonly duration = signal('');
  readonly year = signal(new Date().getFullYear());
  readonly category = signal<string | null>(null);
  readonly tags = signal<string[]>([]);
  readonly genre = signal<string | null>(null);
  readonly collection = signal<string | null>(null);
  readonly quality = signal<string | null>(null);
  readonly language = signal<string | null>(null);
  readonly artist = signal<string | null>(null);
  readonly album = signal<string | null>(null);
  readonly thumbnail = signal('');
  readonly poster = signal('');
  readonly seriesId = signal<string | null>(null);
  readonly seasonId = signal<string | null>(null);

  /* --------------------------- catálogos --------------------------- */
  readonly categoryValues = computed(() => this.store.categories().map((c) => c.name));
  readonly tagValues = computed(() => this.store.tags());
  readonly genreValues = computed(() => ['Drama', 'Ciencia ficción', 'Suspenso', 'Comedia', 'Aventura', 'Animación', 'Historia', 'Naturaleza', 'Cocina', 'Música', 'Tecnología', 'Deporte', 'Arte']);
  readonly collectionValues = computed(() => ['Colección 2026', 'Favoritos', 'Pendiente de ver', 'Visto en familia', 'Documentales']);
  readonly qualityValues = computed(() => ['2160p', '1440p', '1080p', '720p', '480p']);
  readonly languageValues = computed(() => ['Español', 'Inglés', 'Francés', 'Alemán', 'Italiano', 'Portugués', 'Japonés', 'Coreano', 'Chino', 'Ruso']);
  readonly artistValues = computed(() => this.store.artists().map((a) => a.name));
  readonly albumValues = computed(() => this.store.albums().map((a) => a.title));
  readonly seriesValues = computed(() => this.store.series().map((s) => s.title));
  readonly titleSuggestions = computed(() =>
    this.store
      .allEntries()
      .map((e) => e.title)
      .filter((t) => t !== this.title())
      .slice(0, 40),
  );

  constructor() {
    // Precarga los datos cuando se edita un elemento existente.
    queueMicrotask(() => this.loadExisting());
  }

  private loadExisting(): void {
    const { kind, id } = this.data();
    if (!id) {
      if (kind === 'episode') this.seriesId.set(this.data().seriesId ?? null);
      return;
    }
    if (kind === 'video') {
      const v = this.store.videoById(id);
      if (v) this.fillFromItem(v);
    } else if (kind === 'episode') {
      const e = this.store.episodeById(id);
      if (e) this.fillFromItem(e);
    } else if (kind === 'series') {
      const s = this.store.seriesById(id);
      if (s) {
        this.title.set(s.title);
        this.synopsis.set(s.synopsis);
        this.category.set(this.store.categoryById(s.categoryId)?.name ?? null);
        this.tags.set([...s.tags]);
        this.genre.set(s.genre);
        this.year.set(s.year);
        this.poster.set(s.poster);
        this.thumbnail.set(s.thumbnail);
      }
    } else if (kind === 'track') {
      const t = this.store.trackById(id);
      if (t) {
        this.title.set(t.title);
        this.artist.set(t.artistName);
        this.album.set(t.albumTitle);
        this.genre.set(t.genre);
        this.path.set(t.path);
        this.duration.set(String(t.duration));
      }
    }
  }

  private fillFromItem(item: Video | Episode): void {
    this.title.set(item.title);
    this.synopsis.set(item.synopsis);
    this.path.set(item.path);
    this.duration.set(String(item.duration));
    this.year.set(item.year);
    this.category.set(this.store.categoryById(item.categoryId)?.name ?? null);
    this.tags.set([...(item.tags ?? [])]);
    this.genre.set(item.genre);
    this.quality.set(item.quality);
    this.thumbnail.set(item.thumbnail);
    this.poster.set(item.poster);
  }

  /* --------------------------- explorador --------------------------- */

  async pickVideoFile(): Promise<void> {
    const { result } = this.dialogs.openWithResult<FileExplorerDialogComponent, ExplorerResult[]>(
      FileExplorerDialogComponent,
      { kind: 'video', title: 'Seleccionar vídeo' },
    );
    const picked = await result;
    if (!picked || !picked.length) return;
    const file = picked[0];
    this.path.set(file.path);
    if (!this.title()) this.title.set(file.name.replace(/\.[^.]+$/, ''));
  }

  async pickImage(kind: 'miniatura' | 'poster'): Promise<void> {
    const { result } = this.dialogs.openWithResult<FileExplorerDialogComponent, ExplorerResult[]>(
      FileExplorerDialogComponent,
      { kind: 'image', title: kind === 'poster' ? 'Seleccionar carátula' : 'Seleccionar miniatura' },
    );
    const picked = await result;
    if (!picked || !picked.length) return;
    if (kind === 'poster') this.poster.set(picked[0].path);
    else this.thumbnail.set(picked[0].path);
  }

  /* ----------------------------- guardado ----------------------------- */

  save(): void {
    const { kind } = this.data();
    const title = this.title().trim();
    if (!title) {
      this.toast.error('El título es obligatorio.');
      return;
    }

    if (kind === 'video') {
      const existing = this.data().id ? this.store.videoById(this.data()!.id!) : undefined;
      const payload = {
        title,
        synopsis: this.synopsis(),
        path: this.path(),
        duration: Number(this.duration()) || 0,
        year: this.year(),
        categoryId: this.resolveCategoryId(),
        tags: this.tags(),
        genre: this.genre() ?? '',
        quality: this.quality() ?? '1080p',
        poster: this.poster() || title,
        thumbnail: this.thumbnail() || title,
      };
      if (existing) {
        this.store.dispatch({ type: 'UpdateVideoCommand', payload: { id: existing.id, ...payload } });
      } else {
        const video: Video = {
          kind: 'video',
          id: 'v' + Date.now(),
          synopsis: payload.synopsis,
          categoryId: payload.categoryId,
          genre: payload.genre,
          year: payload.year,
          tags: payload.tags,
          poster: payload.poster,
          thumbnail: payload.thumbnail,
          duration: payload.duration,
          resolution: payload.quality,
          quality: payload.quality,
          videoCodec: 'H.264',
          audioCodec: 'AAC',
          sizeBytes: 0,
          path: payload.path,
          source: '/assets/media/clip-01.mp4',
          addedAt: new Date().toISOString(),
          watched: false,
          progress: 0,
          rating: 0,
          favorite: false,
          hidden: false,
          audioTracks: [],
          subtitleTracks: [],
          chapters: [],
          introStart: 0,
          introEnd: 0,
          creditsStart: 0,
          creditsEnd: payload.duration,
          sceneThumbs: [],
        };
        this.store.dispatch({ type: 'CreateVideoCommand', payload: video });
      }
    } else if (kind === 'episode') {
      const series = this.store.seriesById(this.seriesId() ?? '');
      if (!series) {
        this.toast.error('Selecciona la serie a la que pertenece el episodio.');
        return;
      }
      const season = this.seasonId()
        ? series.seasons.find((s) => s.id === this.seasonId())
        : series.seasons[series.seasons.length - 1];
      const episode: Episode = {
        kind: 'episode',
        id: (this.data().id ?? '') || `${series.id}-s${season?.number ?? 1}-e${Date.now()}`,
        title,
        number: (season?.episodes.length ?? 0) + 1,
        seriesId: series.id,
        seriesTitle: series.title,
        seasonNumber: season?.number ?? 1,
        synopsis: this.synopsis(),
        categoryId: series.categoryId,
        genre: this.genre() ?? series.genre,
        year: this.year(),
        tags: this.tags().length ? this.tags() : [...series.tags],
        poster: this.poster() || title,
        thumbnail: this.thumbnail() || title,
        duration: Number(this.duration()) || 0,
        resolution: this.quality() ?? '1080p',
        quality: this.quality() ?? '1080p',
        videoCodec: 'H.264',
        audioCodec: 'AAC',
        sizeBytes: 0,
        path: this.path(),
        source: '/assets/media/clip-01.mp4',
        addedAt: new Date().toISOString(),
        watched: false,
        progress: 0,
        rating: 0,
        favorite: false,
        hidden: false,
        audioTracks: [],
        subtitleTracks: [],
        chapters: [],
        introStart: 0,
        introEnd: 0,
        creditsStart: 0,
        creditsEnd: Number(this.duration()) || 0,
        sceneThumbs: [],
      };
      if (this.data().id) {
        this.store.dispatch({
          type: 'UpdateEpisodeCommand',
          payload: { seriesId: series.id, episode: episode as Episode },
        });
      } else {
        this.store.dispatch({
          type: 'AddEpisodeCommand',
          payload: { seriesId: series.id, seasonId: season?.id ?? series.id + '-s1', episode },
        });
      }
    } else if (kind === 'series') {
      const existing = this.data().id ? this.store.seriesById(this.data()!.id!) : undefined;
      const payload = {
        title,
        synopsis: this.synopsis(),
        categoryId: this.resolveCategoryId(),
        genre: this.genre() ?? '',
        year: this.year(),
        tags: this.tags(),
        poster: this.poster() || title,
        thumbnail: this.thumbnail() || title,
      };
      if (existing) {
        this.store.dispatch({ type: 'UpdateSeriesCommand', payload: { id: existing.id, ...payload } });
      } else {
        const series: Series = {
          id: 's' + Date.now(),
          title,
          synopsis: payload.synopsis,
          categoryId: payload.categoryId,
          genre: payload.genre,
          year: payload.year,
          tags: payload.tags,
          poster: payload.poster,
          thumbnail: payload.thumbnail,
          rating: 0,
          favorite: false,
          hidden: false,
          autoplayNext: true,
          createdAt: new Date().toISOString(),
          seasons: [],
        };
        this.store.dispatch({ type: 'CreateSeriesCommand', payload: series });
      }
    } else if (kind === 'track') {
      const artist = this.store.artists().find((a) => a.name === this.artist());
      const album = this.store.albums().find((a) => a.title === this.album());
      const track: Track = {
        id: (this.data().id ?? '') || 'tr' + Date.now(),
        title,
        albumId: album?.id ?? '',
        albumTitle: album?.title ?? '',
        artistId: artist?.id ?? '',
        artistName: artist?.name ?? '',
        trackNo: (album?.trackIds.length ?? 0) + 1,
        duration: Number(this.duration()) || 0,
        genre: this.genre() ?? artist?.genre ?? '',
        year: this.year(),
        source: '/assets/media/track-01.mp3',
        cover: album?.cover ?? title,
        path: this.path(),
        played: 0,
        plays: 0,
        rating: 0,
        addedAt: new Date().toISOString(),
        lyrics: null,
        replayGain: '0.0 dB',
      };
      this.store.dispatch({ type: 'AddTrackCommand', payload: track });
    }

    this.store.dispatch({
      type: 'LogActivityCommand',
      payload: {
        module: kind === 'series' ? 'Series' : kind === 'track' ? 'Musica' : 'Biblioteca',
        command: this.isEdit() ? 'UpdateMediaCommand' : 'AddMediaCommand',
        detail: title,
      },
    });
    this.toast.success(this.isEdit() ? 'Cambios guardados.' : 'Contenido agregado a la biblioteca.');
    this.close();
  }

  private resolveCategoryId(): string | null {
    const name = this.category();
    if (!name) return null;
    const found = this.store.categories().find((c) => c.name === name);
    if (found) return found.id;
    /* se crea la categoría al vuelo (combo con creación) */
    this.store.dispatch({ type: 'CreateCategoryCommand', payload: { name } });
    return this.store.categories().find((c) => c.name === name)?.id ?? null;
  }

  close(): void {
    this.dialogs.closeTop();
  }
}
