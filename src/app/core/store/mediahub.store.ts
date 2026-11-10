/**
 * Store de MediaHub basado en señales.
 *
 * Reproduce el patrón CQRS del backend: los componentes despachan *comandos*
 * (lado write) y leen *selectores* derivados (lado read). El estado se persiste
 * en `localStorage` para que la biblioteca sobreviva a una recarga.
 */

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  Album,
  Artist,
  Category,
  Episode,
  LibraryEntry,
  MediaHubDataset,
  MediaHubState,
  Profile,
  Series,
  Track,
  Video,
} from '../models';
import { Command } from './commands';
import { MediaDataService } from '../services/media-data.service';
import {
  ACTIVITY_LOG,
  ALBUMS,
  ARTISTS,
  CATEGORIES,
  DUPLICATES,
  IGNORED_FILES,
  LIBRARY_FOLDERS,
  NOTIFICATIONS,
  PLAYLISTS,
  PROFILES,
  SERVER_SETTINGS,
  SERVER_STATUS,
  SERIES,
  TAGS,
  TRACKS,
  VIDEOS,
} from '../data/seed-data';

const STORAGE_KEY = 'mediahub.state.v5';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createInitialState(): MediaHubState {
  return {
    series: clone(SERIES),
    videos: clone(VIDEOS),
    artists: clone(ARTISTS),
    albums: clone(ALBUMS),
    tracks: clone(TRACKS),
    playlists: clone(PLAYLISTS),
    categories: clone(CATEGORIES),
    tags: clone(TAGS),
    folders: clone(LIBRARY_FOLDERS),
    ignored: clone(IGNORED_FILES),
    duplicates: clone(DUPLICATES),
    trash: [],
    hiddenFolders: [],
    favoriteFolders: ['lf2'],
    scanStatus: {
      running: false,
      progress: 0,
      message: 'Inactivo',
      lastRun: '2026-11-09T03:22:00Z',
    },
    profiles: clone(PROFILES),
    currentProfileId: 'u1',
    notifications: clone(NOTIFICATIONS),
    activity: clone(ACTIVITY_LOG),
    settings: clone(SERVER_SETTINGS),
    serverStatus: clone(SERVER_STATUS),
    theme: 'auto',
    lang: 'es',
    autoplayNext: true,
    hoverPreview: true,
    writeTagsToFile: false,
    repeatMode: 'off',
    shuffle: false,
    crossfade: 0,
    gapless: true,
    visualizer: false,
    equalizer: { enabled: false, preset: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
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
    subtitleStyle: { size: 100, font: 'Roboto', color: '#ffffff', bg: '#000000', position: 'bottom', opacity: 85, offset: 0 },
    skipIntro: true,
    skipCredits: true,
    playbackRate: 1,
    volume: 80,
    sleepTimer: 0,
    seenOnboarding: false,
    menuOpen: false,
    menuCollapsed: false,
  };
}

@Injectable({ providedIn: 'root' })
export class MediaHubStore {
  private readonly mediaData = inject(MediaDataService);
  private readonly _state = signal<MediaHubState>(createInitialState());
  private readonly _hiddenUnlocked = signal(false);
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  /** Estado completo (solo lectura). */
  readonly state = this._state.asReadonly();
  /** Desbloquea el contenido oculto desde el panel de usuarios. */
  readonly hiddenUnlocked = this._hiddenUnlocked.asReadonly();
  /** Referencia al servicio de datos desacoplado. */
  readonly dataService = this.mediaData;

  /* ------------------------- selectores básicos ------------------------- */

  readonly series = computed(() => this._state().series);
  readonly videos = computed(() => this._state().videos);
  readonly artists = computed(() => this._state().artists);
  readonly albums = computed(() => this._state().albums);
  readonly tracks = computed(() => this._state().tracks);
  readonly playlists = computed(() => this._state().playlists);
  readonly categories = computed(() => this._state().categories);
  readonly tags = computed(() => this._state().tags);
  readonly folders = computed(() => this._state().folders);
  readonly ignored = computed(() => this._state().ignored);
  readonly duplicates = computed(() => this._state().duplicates);
  readonly trash = computed(() => this._state().trash);
  readonly profiles = computed(() => this._state().profiles);
  readonly notifications = computed(() => this._state().notifications);
  readonly activity = computed(() => this._state().activity);
  readonly settings = computed(() => this._state().settings);
  readonly serverStatus = computed(() => this._state().serverStatus);
  readonly scanStatus = computed(() => this._state().scanStatus);
  readonly theme = computed(() => this._state().theme);

  readonly currentProfile = computed<Profile>(
    () => this._state().profiles.find((p) => p.id === this._state().currentProfileId) ?? this._state().profiles[0],
  );

  readonly unreadNotifications = computed(() => this._state().notifications.filter((n) => !n.read).length);

  readonly storageUsed = computed(() => this._state().serverStatus.storageUsedBytes);
  readonly storageTotal = computed(() => this._state().serverStatus.storageTotalBytes);
  readonly storagePercent = computed(() =>
    Math.round((this._state().serverStatus.storageUsedBytes / this._state().serverStatus.storageTotalBytes) * 100),
  );

  /* --------------------------- selectores de biblioteca --------------------------- */

  /** Episodios + vídeos independientes normalizados. */
  readonly allEntries = computed<LibraryEntry[]>(() => {
    const s = this._state();
    const out: LibraryEntry[] = [];
    s.series.forEach((ser) =>
      ser.seasons.forEach((sn) =>
        sn.episodes.forEach((e) =>
          out.push({
            ...e,
            kind: 'episode',
            seriesId: ser.id,
            seriesTitle: ser.title,
            seasonNumber: sn.number,
          }),
        ),
      ),
    );
    s.videos.forEach((v) => out.push({ ...v, kind: 'video' }));
    return out;
  });

  /** Entradas visibles según control parental y contenido oculto. */
  readonly visibleEntries = computed<LibraryEntry[]>(() => {
    const prof = this.currentProfile();
    const unlocked = this._hiddenUnlocked();
    return this.allEntries().filter((e) => {
      if (e.hidden && !unlocked) return false;
      if (prof?.role === 'child' && prof.parental.enabled) {
        if (e.tags?.some((t) => ['terror', 'adulto'].includes(t))) return false;
      }
      return true;
    });
  });

  readonly continueWatching = computed(() =>
    this.visibleEntries()
      .filter((e) => e.progress > 30 && e.progress < e.duration - 30)
      .slice(0, 12),
  );

  readonly recentlyAdded = computed(() =>
    this.visibleEntries()
      .slice()
      .sort((a, b) => +new Date(b.addedAt) - +new Date(a.addedAt))
      .slice(0, 16),
  );

  readonly favorites = computed(() => this.visibleEntries().filter((e) => e.favorite));

  readonly recommended = computed(() =>
    this.visibleEntries()
      .filter((e) => !e.watched && e.rating >= 4)
      .slice(0, 12),
  );

  readonly entryCount = computed(() => this.allEntries().length);
  readonly episodeCount = computed(
    () => this.allEntries().filter((e) => e.kind === 'episode').length,
  );
  readonly videoCount = computed(() => this._state().videos.length);
  readonly totalDuration = computed(() => this.allEntries().reduce((acc, e) => acc + (e.duration || 0), 0));
  readonly watchedCount = computed(() => this.visibleEntries().filter((e) => e.watched).length);

  /* ------------------------------- constructor ------------------------------- */

  constructor() {
    this.load();
    this.hydrateFromService();
    effect(() => {
      const snapshot = this._state();
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        } catch {
          /* cuota agotada: la sesión sigue funcionando en memoria */
        }
      }, 250);
    });
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<MediaHubState>;
        this._state.set({ ...this._state(), ...saved });
      }
    } catch {
      /* estado corrupto: se conserva la semilla */
    }
    this._state.update((s) => remapMedia(s));
  }

  /**
   * Carga asíncronamente el dataset desacoplado desde /assets/data/mediahub-seed.json.
   * Si localStorage no tiene datos previos, hidrata la tienda directamente.
   */
  private async hydrateFromService(): Promise<void> {
    try {
      const dataset = await this.mediaData.loadDataset();
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.applyDataset(dataset);
      }
    } catch (err) {
      console.warn('Hidratación desde servicio de datos completada con respaldo.', err);
    }
  }

  /**
   * Aplica un dataset completo importado (JSON o base de datos).
   */
  applyDataset(d: MediaHubDataset): void {
    this._state.update((s) => ({
      ...s,
      series: clone(d.series),
      videos: clone(d.videos),
      artists: clone(d.artists),
      albums: clone(d.albums),
      tracks: clone(d.tracks),
      playlists: clone(d.playlists),
      categories: clone(d.categories),
      tags: clone(d.tags),
      folders: clone(d.folders),
      ignored: clone(d.ignored),
      duplicates: clone(d.duplicates),
      profiles: clone(d.profiles),
      notifications: clone(d.notifications),
      activity: clone(d.activity),
      settings: clone(d.settings),
      serverStatus: clone(d.serverStatus),
    }));
    this._state.update((s) => remapMedia(s));
  }

  /**
   * Restablece la biblioteca al dataset estático JSON original.
   */
  async resetToSeedData(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
    const dataset = await this.mediaData.loadDataset();
    this.applyDataset(dataset);
  }

  /**
   * Exporta todo el contenido actual a un objeto MediaHubDataset para copias de seguridad
   * o para migrar directamente a una base de datos.
   */
  exportDataset(): MediaHubDataset {
    const s = this._state();
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      categories: clone(s.categories),
      tags: clone(s.tags),
      series: clone(s.series),
      videos: clone(s.videos),
      artists: clone(s.artists),
      albums: clone(s.albums),
      tracks: clone(s.tracks),
      playlists: clone(s.playlists),
      folders: clone(s.folders),
      ignored: clone(s.ignored),
      duplicates: clone(s.duplicates),
      profiles: clone(s.profiles),
      notifications: clone(s.notifications),
      activity: clone(s.activity),
      settings: clone(s.settings),
      serverStatus: clone(s.serverStatus),
    };
  }

  /* -------------------------------- despacho -------------------------------- */

  dispatch(command: Command): void {
    this._state.update((s) => applyCommand(s, command));
  }

  /* ------------------------------- consultas ------------------------------- */

  videoById(id: string): Video | undefined {
    return this._state().videos.find((v) => v.id === id);
  }

  seriesById(id: string): Series | undefined {
    return this._state().series.find((s) => s.id === id);
  }

  episodeById(id: string): Episode | undefined {
    for (const ser of this._state().series) {
      for (const sn of ser.seasons) {
        const e = sn.episodes.find((x) => x.id === id);
        if (e) return e;
      }
    }
    return undefined;
  }

  trackById(id: string): Track | undefined {
    return this._state().tracks.find((t) => t.id === id);
  }

  albumById(id: string): Album | undefined {
    return this._state().albums.find((a) => a.id === id);
  }

  artistById(id: string): Artist | undefined {
    return this._state().artists.find((a) => a.id === id);
  }

  categoryById(id: string | null): Category | undefined {
    if (!id) return undefined;
    return this._state().categories.find((c) => c.id === id);
  }

  /** Episodios de una serie (temporada opcional). */
  episodesOf(seriesId: string, seasonNumber?: number): Episode[] {
    const ser = this.seriesById(seriesId);
    if (!ser) return [];
    return ser.seasons
      .filter((sn) => seasonNumber === undefined || sn.number === seasonNumber)
      .flatMap((sn) => sn.episodes);
  }

  entriesByCategory(categoryId: string): LibraryEntry[] {
    return this.visibleEntries().filter((e) => e.categoryId === categoryId);
  }

  entriesByTags(tags: string[], mode: 'all' | 'any' = 'all'): LibraryEntry[] {
    const list = this.visibleEntries();
    if (!tags || !tags.length) return list;
    return list.filter((e) =>
      mode === 'all' ? tags.every((t) => e.tags?.includes(t)) : tags.some((t) => e.tags?.includes(t)),
    );
  }

  search(query: string): LibraryEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const s = this._state();
    const terms = q.split(/\s+/);
    const hit = (haystack: string[]) => {
      const text = haystack.join(' ').toLowerCase();
      return terms.every((t) => text.includes(t));
    };
    const out: LibraryEntry[] = [];
    this.visibleEntries().forEach((e) => {
      if (hit([e.title, e.genre, e.synopsis, ...(e.tags ?? [])])) out.push(e);
    });
    s.series.forEach((ser) => {
      if (hit([ser.title, ser.genre, ser.synopsis, ...(ser.tags ?? [])])) {
        out.push({
          ...ser,
          kind: 'video',
          duration: ser.seasons.reduce((a, sn) => a + sn.episodes.reduce((b, e) => b + e.duration, 0), 0),
          source: ser.seasons[0]?.episodes[0]?.source ?? '',
          path: ser.seasons[0]?.episodes[0]?.path ?? '',
          addedAt: ser.createdAt,
          progress: 0,
          watched: false,
          audioTracks: [],
          subtitleTracks: [],
          chapters: [],
          introStart: 0,
          introEnd: 0,
          creditsStart: 0,
          creditsEnd: 0,
          sceneThumbs: [],
        } as unknown as LibraryEntry);
      }
    });
    s.artists.forEach((a) => {
      if (hit([a.name, a.genre, a.bio])) out.push({ ...a, kind: 'video' } as unknown as LibraryEntry);
    });
    s.tracks.forEach((t) => {
      if (hit([t.title, t.artistName, t.albumTitle, t.genre])) out.push({ ...t, kind: 'video' } as unknown as LibraryEntry);
    });
    return out;
  }

  setHiddenUnlocked(value: boolean): void {
    this._hiddenUnlocked.set(value);
  }
}

/* ==================================================================== */
/*                        Reductor (applyCommand)                        */
/* ==================================================================== */

function applyCommand(s: MediaHubState, command: Command): MediaHubState {
  switch (command.type) {
    case 'SetStateCommand':
      return { ...s, ...command.payload };

    /* ------------------------------ contenido ------------------------------ */
    case 'CreateVideoCommand':
      return { ...s, videos: [command.payload, ...s.videos] };
    case 'UpdateVideoCommand':
      return {
        ...s,
        videos: s.videos.map((v) => (v.id === command.payload.id ? { ...v, ...command.payload } : v)),
      };
    case 'DeleteVideoCommand':
      return { ...s, videos: s.videos.filter((v) => v.id !== command.payload) };
    case 'MarkVideoWatchedCommand':
      return {
        ...s,
        videos: s.videos.map((v) =>
          v.id === command.payload ? { ...v, watched: true, progress: v.duration } : v,
        ),
      };
    case 'MarkVideoUnwatchedCommand':
      return {
        ...s,
        videos: s.videos.map((v) => (v.id === command.payload ? { ...v, watched: false, progress: 0 } : v)),
      };
    case 'RateVideoCommand':
      return {
        ...s,
        videos: s.videos.map((v) => (v.id === command.payload.id ? { ...v, rating: command.payload.rating } : v)),
      };
    case 'ToggleFavoriteCommand':
      return {
        ...s,
        videos: s.videos.map((v) => (v.id === command.payload.id ? { ...v, favorite: !v.favorite } : v)),
      };
    case 'UpdateProgressCommand':
      return {
        ...s,
        videos: s.videos.map((v) => {
          if (v.id !== command.payload.id) return v;
          const progress = command.payload.progress;
          const watched = progress >= v.duration - 20;
          return { ...v, progress: watched ? v.duration : progress, watched };
        }),
      };

    /* ------------------------------- series ------------------------------- */
    case 'CreateSeriesCommand':
      return { ...s, series: [command.payload, ...s.series] };
    case 'UpdateSeriesCommand':
      return {
        ...s,
        series: s.series.map((x) => (x.id === command.payload.id ? { ...x, ...command.payload } : x)),
      };
    case 'DeleteSeriesCommand':
      return {
        ...s,
        series: s.series.filter((ser) => ser.id !== command.payload),
      };
    case 'AddSeasonCommand':
      return {
        ...s,
        series: s.series.map((ser) => {
          if (ser.id !== command.payload.seriesId) return ser;
          const nextNum = ser.seasons.length + 1;
          const newSn = {
            id: 'sn' + Date.now(),
            number: nextNum,
            title: command.payload.title || `Temporada ${nextNum}`,
            episodes: [],
          };
          return { ...ser, seasons: [...ser.seasons, newSn] };
        }),
      };
    case 'DeleteEpisodeCommand':
      return {
        ...s,
        series: s.series.map((ser) => {
          if (ser.id !== command.payload.seriesId) return ser;
          return {
            ...ser,
            seasons: ser.seasons.map((sn) => ({
              ...sn,
              episodes: sn.episodes.filter((e) => e.id !== command.payload.episodeId),
            })),
          };
        }),
      };
    case 'AddEpisodeCommand':
      return {
        ...s,
        series: s.series.map((ser) => {
          if (ser.id !== command.payload.seriesId) return ser;
          const seasons = ser.seasons.map((sn) => ({ ...sn, episodes: [...sn.episodes] }));
          let season = seasons.find((sn) => sn.id === command.payload.seasonId);
          if (!season) {
            season = {
              id: command.payload.seasonId,
              number: seasons.length + 1,
              title: 'Temporada ' + (seasons.length + 1),
              episodes: [],
            };
            seasons.push(season);
          }
          season.episodes.push(command.payload.episode);
          season.episodes.sort((a, b) => a.number - b.number);
          return { ...ser, seasons };
        }),
      };
    case 'UpdateEpisodeCommand':
      return {
        ...s,
        series: s.series.map((ser) => {
          if (ser.id !== command.payload.seriesId) return ser;
          return {
            ...ser,
            seasons: ser.seasons.map((sn) => ({
              ...sn,
              episodes: sn.episodes.map((e) =>
                e.id === command.payload.episode.id ? { ...e, ...command.payload.episode } : e,
              ),
            })),
          };
        }),
      };
    case 'MarkEpisodeWatchedCommand':
      return {
        ...s,
        series: s.series.map((ser) => {
          if (ser.id !== command.payload.seriesId) return ser;
          return {
            ...ser,
            seasons: ser.seasons.map((sn) => ({
              ...sn,
              episodes: sn.episodes.map((e) =>
                e.id === command.payload.episodeId ? { ...e, watched: true, progress: e.duration } : e,
              ),
            })),
          };
        }),
      };
    case 'SetEpisodeOrderCommand':
      return {
        ...s,
        series: s.series.map((ser) => {
          if (ser.id !== command.payload.seriesId) return ser;
          return {
            ...ser,
            seasons: ser.seasons.map((sn) => {
              const episodes = sn.episodes.map((e) =>
                e.id === command.payload.episodeId ? { ...e, number: command.payload.number } : e,
              );
              episodes.sort((a, b) => a.number - b.number);
              return { ...sn, episodes };
            }),
          };
        }),
      };

    /* ------------------------------ taxonomía ------------------------------ */
    case 'CreateCategoryCommand':
      return {
        ...s,
        categories: [
          ...s.categories,
          { id: 'c' + Date.now(), name: command.payload.name, color: command.payload.color ?? '#4f5bd5' },
        ],
      };
    case 'UpdateCategoryCommand':
      return {
        ...s,
        categories: s.categories.map((c) => (c.id === command.payload.id ? { ...c, ...command.payload } : c)),
      };
    case 'DeleteCategoryCommand':
      return {
        ...s,
        categories: s.categories.filter((c) => c.id !== command.payload),
        videos: s.videos.map((v) => (v.categoryId === command.payload ? { ...v, categoryId: null } : v)),
      };
    case 'CreateTagCommand':
      return s.tags.includes(command.payload) ? s : { ...s, tags: [...s.tags, command.payload] };
    case 'DeleteTagCommand':
      return {
        ...s,
        tags: s.tags.filter((t) => t !== command.payload),
        videos: s.videos.map((v) => ({ ...v, tags: v.tags.filter((t) => t !== command.payload) })),
      };
    case 'AssignCategoryCommand':
      return {
        ...s,
        videos: s.videos.map((v) =>
          v.id === command.payload.id ? { ...v, categoryId: command.payload.categoryId } : v,
        ),
      };
    case 'AssignTagsCommand':
      return {
        ...s,
        videos: s.videos.map((v) => (v.id === command.payload.id ? { ...v, tags: [...command.payload.tags] } : v)),
      };

    /* -------------------------------- música -------------------------------- */
    case 'AddTrackCommand':
      return { ...s, tracks: [...s.tracks, command.payload] };
    case 'UpdateTrackCommand':
      return {
        ...s,
        tracks: s.tracks.map((t) => (t.id === command.payload.id ? { ...t, ...command.payload } : t)),
      };
    case 'DeleteTrackCommand':
      return {
        ...s,
        tracks: s.tracks.filter((t) => t.id !== command.payload),
        playlists: s.playlists.map((pl) => ({
          ...pl,
          trackIds: pl.trackIds.filter((tid) => tid !== command.payload),
        })),
      };
    case 'PlayTrackCommand':
      return {
        ...s,
        tracks: s.tracks.map((t) =>
          t.id === command.payload ? { ...t, plays: (t.plays || 0) + 1, played: Date.now() } : t,
        ),
      };
    case 'RateTrackCommand':
      return {
        ...s,
        tracks: s.tracks.map((t) => (t.id === command.payload.id ? { ...t, rating: command.payload.rating } : t)),
      };
    case 'CreateAlbumCommand':
      return { ...s, albums: [command.payload, ...s.albums] };
    case 'UpdateAlbumCommand':
      return {
        ...s,
        albums: s.albums.map((a) => (a.id === command.payload.id ? { ...a, ...command.payload } : a)),
      };
    case 'DeleteAlbumCommand':
      return {
        ...s,
        albums: s.albums.filter((a) => a.id !== command.payload),
        tracks: s.tracks.filter((t) => t.albumId !== command.payload),
      };
    case 'CreateArtistCommand':
      return { ...s, artists: [command.payload, ...s.artists] };
    case 'UpdateArtistCommand':
      return {
        ...s,
        artists: s.artists.map((ar) => (ar.id === command.payload.id ? { ...ar, ...command.payload } : ar)),
      };
    case 'DeleteArtistCommand':
      return {
        ...s,
        artists: s.artists.filter((ar) => ar.id !== command.payload),
        albums: s.albums.filter((al) => al.artistId !== command.payload),
      };
    case 'CreatePlaylistCommand':
      return { ...s, playlists: [command.payload, ...s.playlists] };
    case 'UpdatePlaylistCommand':
      return {
        ...s,
        playlists: s.playlists.map((pl) => (pl.id === command.payload.id ? { ...pl, ...command.payload } : pl)),
      };
    case 'DeletePlaylistCommand':
      return {
        ...s,
        playlists: s.playlists.filter((pl) => pl.id !== command.payload),
      };
    case 'AddToPlaylistCommand':
      return {
        ...s,
        playlists: s.playlists.map((pl) =>
          pl.id === command.payload.playlistId && !pl.trackIds.includes(command.payload.trackId)
            ? { ...pl, trackIds: [...pl.trackIds, command.payload.trackId] }
            : pl,
        ),
      };
    case 'RemoveFromPlaylistCommand':
      return {
        ...s,
        playlists: s.playlists.map((pl) =>
          pl.id === command.payload.playlistId
            ? { ...pl, trackIds: pl.trackIds.filter((t) => t !== command.payload.trackId) }
            : pl,
        ),
      };
    case 'ReorderPlaylistCommand':
      return {
        ...s,
        playlists: s.playlists.map((pl) =>
          pl.id === command.payload.playlistId ? { ...pl, trackIds: [...command.payload.trackIds] } : pl,
        ),
      };

    /* ------------------------------ carga masiva --------------------------- */
    case 'BulkImportFromFolderCommand': {
      const now = new Date().toISOString();
      const newVideos: Video[] = [];
      const newTracks: Track[] = [];

      command.payload.files.forEach((f, idx) => {
        if (f.kind === 'track') {
          newTracks.push({
            id: 'tr' + Date.now() + '-' + idx,
            title: f.title,
            albumId: 'al1-0',
            albumTitle: 'Colección ' + command.payload.folderPath.split(/[\\/]/).pop(),
            artistId: 'ar1',
            artistName: 'Artista varios',
            trackNo: idx + 1,
            duration: 210,
            genre: f.genre || 'Varios',
            year: 2025,
            source: '/assets/media/track-01.mp3',
            cover: f.title,
            path: f.path,
            played: 0,
            plays: 0,
            rating: 0,
            addedAt: new Date().toISOString(),
            lyrics: null,
            replayGain: '+0.0 dB',
          });
        } else {
          newVideos.push({
            kind: 'video',
            id: 'v' + Date.now() + '-' + idx,
            title: f.title,
            synopsis: 'Importado de forma masiva desde ' + f.path,
            categoryId: null,
            genre: f.genre || 'General',
            year: 2025,
            tags: ['importado', command.payload.folderPath.split(/[\\/]/).pop() || 'media'],
            poster: f.title,
            thumbnail: f.title,
            duration: 3600 + idx * 300,
            resolution: f.quality || '1080p',
            quality: f.quality || '1080p',
            videoCodec: 'H.264',
            audioCodec: 'AAC',
            sizeBytes: 1073741824 * (1 + (idx % 4)),
            path: f.path,
            source: '/assets/media/clip-01.mp4',
            addedAt: now,
            watched: false,
            progress: 0,
            rating: f.favorite ? 5 : 0,
            favorite: !!f.favorite,
            hidden: false,
            audioTracks: [
              { id: 'a1', language: 'Español', codec: 'AAC', channels: 2, isDefault: true }
            ],
            subtitleTracks: [],
            chapters: [],
            introStart: 0,
            introEnd: 0,
            creditsStart: 0,
            creditsEnd: 0,
            sceneThumbs: [],
          });
        }
      });

      return {
        ...s,
        videos: [...s.videos, ...newVideos],
        tracks: [...s.tracks, ...newTracks],
        activity: [
          {
            id: 'act' + Date.now(),
            at: now,
            module: 'Carga Masiva',
            user: s.profiles.find((p) => p.id === s.currentProfileId)?.name || 'Admin',
            command: 'BulkImportFromFolderCommand',
            detail: `${command.payload.files.length} archivos importados desde ${command.payload.folderPath}`,
          },
          ...s.activity,
        ],
        notifications: [
          {
            id: 'notif' + Date.now(),
            type: 'scan',
            title: 'Carga masiva completada',
            body: `Se han añadido ${command.payload.files.length} archivos desde ${command.payload.folderPath}.`,
            at: now,
            read: false,
            icon: 'folder-plus',
          },
          ...s.notifications,
        ],
      };
    }

    /* ------------------------------ biblioteca ------------------------------ */
    case 'RegisterFolderCommand':
      return { ...s, folders: [...s.folders, command.payload] };
    case 'RemoveFolderCommand':
      return { ...s, folders: s.folders.filter((f) => f.id !== command.payload) };
    case 'ScanLibraryCommand': {
      const folder = s.folders.find((f) => f.id === command.payload);
      return {
        ...s,
        folders: s.folders.map((f) => (f.id === command.payload ? { ...f, lastScan: new Date().toISOString() } : f)),
        scanStatus: {
          running: false,
          progress: 100,
          message: 'Escaneo completado: ' + (folder?.files ?? 0) + ' archivos',
          lastRun: new Date().toISOString(),
        },
      };
    }
    case 'IgnoreFileCommand':
      return {
        ...s,
        ignored: [
          ...s.ignored,
          {
            id: 'ig' + Date.now(),
            name: command.payload.name,
            path: command.payload.path,
            reason: command.payload.reason || 'Ignorado manualmente',
          },
        ],
      };
    case 'ResolveDuplicateCommand':
      return { ...s, duplicates: s.duplicates.filter((d) => d.id !== command.payload) };

    case 'MoveFilesCommand':
    case 'CopyFilesCommand': {
      if (command.type === 'CopyFilesCommand') return s;
      const dest = command.payload.dest.replace(/[\\/]+$/, '');
      return {
        ...s,
        videos: s.videos.map((v) => {
          if (!command.payload.ids.includes(v.id)) return v;
          const name = v.path.split(/[\\/]/).pop();
          return { ...v, path: dest + '\\' + name };
        }),
      };
    }
    case 'BatchRenameCommand':
      return {
        ...s,
        videos: s.videos.map((v) => {
          if (v.id !== command.payload.id) return v;
          const ext = (v.path.match(/\.[A-Za-z0-9]+$/) || ['.mkv'])[0];
          const base = command.payload.template
            .replace('{n}', String(command.payload.index).padStart(2, '0'))
            .replace('{title}', v.title);
          return { ...v, path: v.path.replace(/[\\/][^\\/]+$/, '\\' + base.replace(/[\\/:*?"<>|]/g, '') + ext) };
        }),
      };
    case 'TrashFilesCommand':
      return {
        ...s,
        trash: [
          ...s.trash,
          ...s.videos
            .filter((v) => command.payload.ids.includes(v.id))
            .map((v) => ({
              id: 'tr' + Date.now() + v.id,
              videoId: v.id,
              name: v.path.split(/[\\/]/).pop() ?? v.path,
              path: v.path,
              at: new Date().toISOString(),
            })),
        ],
      };
    case 'RestoreFileCommand': {
      const entry = s.trash.find((x) => x.id === command.payload);
      return {
        ...s,
        trash: s.trash.filter((x) => x.id !== command.payload),
        videos: entry
          ? s.videos.map((v) => (v.id === entry.videoId ? { ...v, path: entry.path } : v))
          : s.videos,
      };
    }
    case 'DeletePermanentCommand':
      return { ...s, trash: s.trash.filter((x) => x.id !== command.payload) };
    case 'CreateFolderCommand':
      return {
        ...s,
        folders: [
          ...s.folders,
          {
            id: 'lf' + Date.now(),
            name: command.payload.name,
            path: command.payload.path,
            scope: command.payload.scope || 'Personal',
            autoScan: false,
            lastScan: null,
            files: 0,
            sizeBytes: 0,
          },
        ],
      };
    case 'DeleteFolderCommand':
      return { ...s, folders: s.folders.filter((f) => f.id !== command.payload.id) };
    case 'ToggleHiddenCommand':
      return {
        ...s,
        videos: s.videos.map((v) => (v.id === command.payload.id ? { ...v, hidden: !v.hidden } : v)),
        hiddenFolders: s.hiddenFolders.includes(command.payload.id)
          ? s.hiddenFolders.filter((x) => x !== command.payload.id)
          : [...s.hiddenFolders, command.payload.id],
      };

    /* ------------------------------- usuarios ------------------------------- */
    case 'UpdateProfileCommand':
      return {
        ...s,
        profiles: s.profiles.map((p) => (p.id === command.payload.id ? { ...p, ...command.payload } : p)),
      };
    case 'CreateProfileCommand':
      return { ...s, profiles: [...s.profiles, command.payload] };
    case 'DeleteProfileCommand':
      return { ...s, profiles: s.profiles.filter((p) => p.id !== command.payload) };
    case 'SwitchProfileCommand':
      return { ...s, currentProfileId: command.payload };
    case 'SetPreferencesCommand': {
      const target = command.payload.id ?? s.currentProfileId;
      return {
        ...s,
        profiles: s.profiles.map((p) =>
          p.id === target ? { ...p, preferences: { ...p.preferences, ...command.payload.preferences } } : p,
        ),
      };
    }

    /* -------------------------------- sistema -------------------------------- */
    case 'ReadNotificationCommand':
      return {
        ...s,
        notifications: s.notifications.map((n) => (n.id === command.payload ? { ...n, read: true } : n)),
      };
    case 'DismissNotificationCommand':
      return { ...s, notifications: s.notifications.filter((n) => n.id !== command.payload) };
    case 'UpdateSettingsCommand':
      return { ...s, settings: { ...s.settings, ...command.payload } };
    case 'LogActivityCommand':
      return {
        ...s,
        activity: [
          {
            id: 'a' + Date.now(),
            at: new Date().toISOString(),
            module: command.payload.module,
            user: command.payload.user ?? s.profiles.find((p) => p.id === s.currentProfileId)?.name ?? 'sistema',
            command: command.payload.command,
            detail: command.payload.detail,
          },
          ...s.activity,
        ].slice(0, 200),
      };
    case 'ToggleThemeCommand': {
      const order: MediaHubState['theme'][] = ['auto', 'light', 'dark'];
      const current = order.indexOf(s.theme);
      return { ...s, theme: order[(current + 1) % order.length] };
    }
    case 'SetLangCommand':
      return { ...s, lang: command.payload };
    default:
      return s;
  }
}

/* ==================================================================== */
/*                   Saneo del estado persistido (remap)                 */
/* ==================================================================== */

/**
 * Mantiene las rutas y orígenes de medios coherentes aunque el estado
 * guardado venga de una versión anterior (o de otra ruta de despliegue).
 */
function remapMedia(s: MediaHubState): MediaHubState {
  let i = 0;
  const nextVideo = () => `/assets/media/clip-0${1 + (i++ % 4)}.mp4`;
  let a = 0;
  const nextAudio = () => `/assets/media/track-0${1 + (a++ % 4)}.mp3`;

  const videos = s.videos.map((v) => ({
    ...v,
    source: v.source && v.source.startsWith('/assets/media/') ? v.source : nextVideo(),
  }));

  const series = s.series.map((ser) => ({
    ...ser,
    seasons: ser.seasons.map((sn) => ({
      ...sn,
      episodes: sn.episodes.map((e) => ({
        ...e,
        source: e.source && e.source.startsWith('/assets/media/') ? e.source : nextVideo(),
        categoryId: e.categoryId ?? ser.categoryId,
        genre: e.genre || ser.genre,
        tags: e.tags && e.tags.length ? e.tags : (ser.tags || []).slice(),
      })),
    })),
  }));

  const tracks = s.tracks.map((t) => ({
    ...t,
    source: t.source && t.source.startsWith('/assets/media/') ? t.source : nextAudio(),
  }));

  return { ...s, videos, series, tracks };
}
