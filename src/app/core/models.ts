/**
 * Modelos de dominio de MediaHub.
 *
 * Las formas de estas interfaces reproducen los DTOs de CQRS que expone el
 * backend Spring Boot (commands / queries / events), de modo que el frontend
 * pueda migrar a HTTP sin tocar las vistas.
 */

/* ------------------------------- media ------------------------------- */

export interface AudioTrack {
  id: string;
  language: string;
  codec: string;
  channels: number;
  isDefault: boolean;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  format: 'embedded' | 'external';
  path: string | null;
  isDefault: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  start: number;
  end: number;
}

export interface SceneThumb {
  at: number;
  src: string;
}

/** Campos comunes a episodios y vídeos independientes. */
export interface MediaItem {
  id: string;
  title: string;
  synopsis: string;
  categoryId: string | null;
  genre: string;
  year: number;
  tags: string[];
  poster: string;
  thumbnail: string;
  duration: number;
  resolution: string;
  quality: string;
  videoCodec: string;
  audioCodec: string;
  sizeBytes: number;
  path: string;
  source: string;
  addedAt: string;
  watched: boolean;
  progress: number;
  rating: number;
  favorite: boolean;
  hidden: boolean;
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  chapters: Chapter[];
  introStart: number;
  introEnd: number;
  creditsStart: number;
  creditsEnd: number;
  sceneThumbs: SceneThumb[];
}

export interface Episode extends MediaItem {
  kind: 'episode';
  number: number;
  seriesId: string;
  seriesTitle: string;
  seasonNumber: number;
}

export interface Video extends MediaItem {
  kind: 'video';
  categoryLocked?: boolean;
}

export interface Season {
  id: string;
  number: number;
  title: string;
  episodes: Episode[];
}

export interface Series {
  id: string;
  title: string;
  synopsis: string;
  categoryId: string | null;
  genre: string;
  year: number;
  tags: string[];
  poster: string;
  thumbnail: string;
  rating: number;
  favorite: boolean;
  hidden: boolean;
  autoplayNext: boolean;
  createdAt: string;
  seasons: Season[];
}

/* ------------------------------- música ------------------------------- */

export interface Artist {
  id: string;
  name: string;
  genre: string;
  year: number;
  image: string;
  bio: string;
}

export interface Album {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  year: number;
  genre: string;
  cover: string;
  trackIds: string[];
  addedAt: string;
}

export interface Track {
  id: string;
  title: string;
  albumId: string;
  albumTitle: string;
  artistId: string;
  artistName: string;
  trackNo: number;
  duration: number;
  genre: string;
  year: number;
  source: string;
  cover: string;
  path: string;
  played: number;
  plays: number;
  rating: number;
  addedAt: string;
  lyrics: string | null;
  replayGain: string;
}

export interface PlaylistRules {
  type: 'notPlayed' | 'recentlyAdded';
  days: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  rules: PlaylistRules | null;
  cover: string | null;
}

/* --------------------------- taxonomía --------------------------- */

export interface Category {
  id: string;
  name: string;
  color: string;
}

/* ---------------------------- biblioteca ---------------------------- */

export interface LibraryFolder {
  id: string;
  name: string;
  path: string;
  scope: string;
  autoScan: boolean;
  lastScan: string | null;
  files: number;
  sizeBytes: number;
}

export interface IgnoredFile {
  id: string;
  name: string;
  path: string;
  reason: string;
}

export interface DuplicateFile {
  id: string;
  name: string;
  path: string;
  hash: string;
  size: string;
  copies: number;
}

export interface TrashEntry {
  id: string;
  videoId: string;
  name: string;
  path: string;
  at: string;
}

/* ----------------------------- usuarios ----------------------------- */

export type ProfileRole = 'admin' | 'user' | 'child';

export interface ProfilePreferences {
  hoverPreview: boolean;
  autoplayNext: boolean;
  imageAdjustments: Record<string, number | boolean> | null;
  lang: string;
  writeTagsToFile: boolean;
  keyboardShortcuts: boolean;
}

export interface Profile {
  id: string;
  name: string;
  role: ProfileRole;
  avatar: string;
  color: string;
  pin: string;
  parental: { enabled: boolean; maxRating: string };
  preferences: ProfilePreferences;
  libraryAccess: string[];
}

/* ----------------------------- sistema ----------------------------- */

export interface AppNotification {
  id: string;
  type: 'episode' | 'scan' | 'track' | 'backup' | string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  icon: string;
}

export interface ActivityEntry {
  id: string;
  at: string;
  module: string;
  user: string;
  command: string;
  detail: string;
}

export interface ServerSettings {
  transcode: { enabled: boolean; profile: string; bitrate: string; threads: number; cacheGb: number };
  scan: { intervalHours: number; watcher: boolean; autoAdd: boolean };
  bandwidth: { limitMbps: number; perClient: boolean };
  backup: { enabled: boolean; schedule: string; retention: number };
  remote: { enabled: boolean; twoFactor: boolean };
  api: { swagger: boolean; docs: boolean };
}

export interface ServerStatus {
  version: string;
  uptimeHours: number;
  cpu: number;
  memory: number;
  storageUsedBytes: number;
  storageTotalBytes: number;
  activeSessions: number;
  dbStatus: string;
  lastBackup: string;
}

/* --------------------------- estado global --------------------------- */

export type ThemeMode = 'auto' | 'light' | 'dark';
export type RepeatMode = 'off' | 'one' | 'all';

export interface EqualizerSettings {
  enabled: boolean;
  preset: string;
  gains: number[];
}

export interface ImageAdjustments {
  contrast: number;
  brightness: number;
  sharpness: number;
  saturation: number;
  shadows: number;
  highlights: number;
  gamma: number;
  denoise: number;
  toneMapping: boolean;
}

export interface SubtitleStyle {
  size: number;
  font: string;
  color: string;
  bg: string;
  position: 'bottom' | 'top';
  opacity: number;
  offset: number;
}

export interface MediaHubState {
  /* contenido */
  series: Series[];
  videos: Video[];
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
  playlists: Playlist[];
  categories: Category[];
  tags: string[];
  /* biblioteca */
  folders: LibraryFolder[];
  ignored: IgnoredFile[];
  duplicates: DuplicateFile[];
  trash: TrashEntry[];
  hiddenFolders: string[];
  favoriteFolders: string[];
  scanStatus: { running: boolean; progress: number; message: string; lastRun: string };
  /* usuarios */
  profiles: Profile[];
  currentProfileId: string;
  /* sistema */
  notifications: AppNotification[];
  activity: ActivityEntry[];
  settings: ServerSettings;
  serverStatus: ServerStatus;
  /* ui */
  theme: ThemeMode;
  lang: string;
  autoplayNext: boolean;
  hoverPreview: boolean;
  writeTagsToFile: boolean;
  repeatMode: RepeatMode;
  shuffle: boolean;
  crossfade: number;
  gapless: boolean;
  visualizer: boolean;
  equalizer: EqualizerSettings;
  imageAdjustments: ImageAdjustments;
  subtitleStyle: SubtitleStyle;
  skipIntro: boolean;
  skipCredits: boolean;
  playbackRate: number;
  volume: number;
  sleepTimer: number;
  seenOnboarding: boolean;
  menuOpen: boolean;
  menuCollapsed: boolean;
}

/* ----------------------- elementos derivados ----------------------- */

/** Episodio o vídeo independiente, normalizado para la biblioteca. */
export interface LibraryEntry extends MediaItem {
  kind: 'episode' | 'video';
  seriesId?: string;
  seriesTitle?: string;
  seasonNumber?: number;
  number?: number;
}

/**
 * Esquema completo del dataset exportado en JSON / XML.
 * Desacopla la capa de datos estáticos para facilitar la migración
 * a bases de datos (PostgreSQL, MySQL, SQLite, MongoDB, Firestore).
 */
export interface MediaHubDataset {
  version: string;
  description?: string;
  exportedAt?: string;
  categories: Category[];
  tags: string[];
  languages?: string[];
  qualities?: string[];
  sampleMedia?: string[];
  sampleAudio?: string[];
  series: Series[];
  videos: Video[];
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
  playlists: Playlist[];
  folders: LibraryFolder[];
  ignored: IgnoredFile[];
  duplicates: DuplicateFile[];
  profiles: Profile[];
  notifications: AppNotification[];
  activity: ActivityEntry[];
  settings: ServerSettings;
  serverStatus: ServerStatus;
}
