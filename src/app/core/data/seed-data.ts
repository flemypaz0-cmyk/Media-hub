/**
 * Dataset semilla de la biblioteca local.
 *
 * Se genera con un PRNG determinista (mulberry32) para que el contenido sea
 * idéntico en cada arranque, igual que en la especificación original.
 * Los campos `poster` / `thumbnail` guardan la semilla del arte, no una URL:
 * el componente `ArtComponent` deriva el degradado a partir de ella.
 */

import {
  ActivityEntry,
  Album,
  AppNotification,
  Artist,
  AudioTrack,
  Category,
  Chapter,
  DuplicateFile,
  Episode,
  IgnoredFile,
  LibraryFolder,
  Playlist,
  Profile,
  ServerSettings,
  ServerStatus,
  Series,
  SubtitleTrack,
  Track,
  Video,
} from '../models';

/* ------------------- PRNG determinista ------------------- */

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20261109);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const int = (a: number, b: number): number => a + Math.floor(rnd() * (b - a + 1));
const chance = (p: number): boolean => rnd() < p;

/* ------------------- catálogos base ------------------- */

export const CATEGORIES: Category[] = [
  { id: 'c1', name: 'Cine', color: '#4f5bd5' },
  { id: 'c2', name: 'Series', color: '#8b5cf6' },
  { id: 'c3', name: 'Documental', color: '#10b981' },
  { id: 'c4', name: 'Animación', color: '#f59e0b' },
  { id: 'c5', name: 'Conciertos', color: '#ec4899' },
  { id: 'c6', name: 'Recetas', color: '#06b6d4' },
  { id: 'c7', name: 'Personal', color: '#ef4444' },
];

export const TAGS: string[] = [
  'accion',
  'drama',
  'comedia',
  'ciencia',
  'viaje',
  'clasico',
  '4k',
  'dolby',
  'subtitulado',
  'anime',
  'documental',
  'musical',
];

export const LANGUAGES: string[] = [
  'Español',
  'Inglés',
  'Francés',
  'Alemán',
  'Italiano',
  'Portugués',
  'Japonés',
  'Coreano',
  'Chino',
  'Ruso',
];

export const QUALITIES: string[] = ['2160p', '1440p', '1080p', '720p', '480p'];

/** Medios empaquetados en `public/assets/media`, servidos por la app. */
export const SAMPLE_MEDIA: string[] = [
  '/assets/media/clip-01.mp4',
  '/assets/media/clip-02.mp4',
  '/assets/media/clip-03.mp4',
  '/assets/media/clip-04.mp4',
];

export const SAMPLE_AUDIO: string[] = [
  '/assets/media/track-01.mp3',
  '/assets/media/track-02.mp3',
  '/assets/media/track-03.mp3',
  '/assets/media/track-04.mp3',
];

/* ------------------- helpers ------------------- */

function makeAudioTracks(n: number): AudioTrack[] {
  const langs = ['Español', 'Inglés', 'Original'];
  const out: AudioTrack[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: 'at' + i + '-' + Math.floor(rnd() * 1e6),
      language: langs[i % langs.length],
      codec: i === 0 ? 'AAC 5.1' : 'AC3 2.0',
      channels: i === 0 ? 6 : 2,
      isDefault: i === 0,
    });
  }
  return out;
}

function makeSubs(n: number, offset: number): SubtitleTrack[] {
  const langs = ['Español', 'Inglés', 'Español (LatAm)'];
  const out: SubtitleTrack[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: 'st' + i + '-' + Math.floor(rnd() * 1e6),
      language: langs[(i + (offset || 0)) % langs.length],
      format: i === 0 ? 'embedded' : chance(0.5) ? 'embedded' : 'external',
      path: null,
      isDefault: i === 0,
    });
  }
  return out;
}

function makeChapters(dur: number): Chapter[] {
  const names = ['Intro', 'Apertura', 'Desarrollo', 'Clímax', 'Consecuencias', 'Cierre', 'Créditos'];
  const n = int(3, 6);
  const out: Chapter[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const len = Math.round((dur / n) * (0.7 + rnd() * 0.6));
    out.push({ id: 'ch' + i, title: names[i % names.length], start: t, end: Math.min(t + len, dur) });
    t += len;
    if (t >= dur) break;
  }
  return out;
}

/* ------------------- series ------------------- */

const SERIES_FIX: [string, string, number, number, string][] = [
  ['Cielo de Ceniza', 'Cine', 3, 2023, 'Drama medieval sobre un reino que pierde la memoria de sus orígenes.'],
  ['Protocolo Faro', 'Series', 4, 2024, 'Un equipo de rescate atrapado en una estación submarina sin energía.'],
  ['La Cocina de Abuela', 'Series', 5, 2022, 'Recetas familiares heredadas de tres generaciones en un pueblo costero.'],
  ['Vector 9', 'Series', 2, 2025, 'Ciencia ficción: una estación orbital administra los recursos de la Tierra.'],
  ['Rutas del Norte', 'Documental', 3, 2024, 'Serie documental sobre caminos de peregrinación y montaña.'],
  ['Neon Crab', 'Animación', 2, 2025, 'Animación estilizada sobre una ciudad costera de neones y crime.'],
  ['El Jardín de las Máquinas', 'Documental', 4, 2023, 'Ingenieros, inventores y fábricas que cambiaron el mundo.'],
  ['Cielo de Ceniza: El Retorno', 'Cine', 2, 2025, 'Segunda parte de la saga medieval, con un winterffee durísimo.'],
  ['Órbita Nueve', 'Series', 3, 2023, 'Psicología espacial y dilemas morales a 400 km de la superficie.'],
  ['Baile de Fuego', 'Animación', 4, 2024, 'Competencia de baile en un barrio de musica electronica.'],
  ['Isla Silente', 'Documental', 2, 2025, 'Un archipiélago, trescientos años de aislamiento.'],
  ['Los Días Contados', 'Cine', 3, 2024, 'Tres siblingsKeyword heredan una casa y una deuda.'],
  ['Fábrica de Sueños', 'Series', 5, 2021, 'La historia de una imprenta clandestina durante la dictadura.'],
  ['Cónclave', 'Cine', 2, 2025, 'Un thriller de intriga sobre una sucesión papal.'],
  ['Kraftwerk: Crónicas', 'Documental', 3, 2024, 'Industrial music, factories y la invención del futuro.'],
  ['Semillas de Niebla', 'Series', 4, 2025, 'Misterio rural donde cada estación del año esconde un secreto.'],
];

const EPISODE_TITLES = [
  'El principio',
  'Cielo limpio',
  'Agua negra',
  'La llamada',
  'Punto de partida',
  'Sin nombre',
  'La cuenta',
  'Marea baja',
  'Herencia',
  'El último tren',
  'Glass House',
  'Fuga',
  'Ceniza',
  'El puente',
  'Interludio',
  'ElFisherman',
  'Cascada',
  'Luz de luna',
  'El pacto',
  'Umbral',
];

function buildSeries(): Series[] {
  const out: Series[] = [];
  SERIES_FIX.forEach(([title, cat, seasons, year, synopsis], si) => {
    const id = 's' + (si + 1);
    const genre =
      cat === 'Cine'
        ? 'Drama'
        : cat === 'Animación'
          ? 'Animación'
          : cat === 'Documental'
            ? 'Historia'
            : pick(['Ciencia ficción', 'Suspenso', 'Comedia', 'Aventura']);
    const categoryId = (CATEGORIES.find((c) => c.name === cat) || CATEGORIES[1]).id;
    const tags = Array.from(new Set([genre.toLowerCase(), pick(TAGS), pick(TAGS)]));

    const item: Series = {
      id,
      title,
      synopsis,
      categoryId,
      genre,
      year,
      tags,
      poster: title,
      thumbnail: title,
      rating: 4 + Math.round(rnd() * 9) / 10,
      favorite: chance(0.4),
      hidden: false,
      autoplayNext: true,
      createdAt: new Date(2026, 0, 1 + si * 9).toISOString(),
      seasons: [],
    };

    for (let sn = 1; sn <= seasons; sn++) {
      const season = { id: id + '-s' + sn, number: sn, title: 'Temporada ' + sn, episodes: [] as Episode[] };
      const eps = int(6, 10);
      for (let e = 1; e <= eps; e++) {
        const dur = int(1200, 5400);
        const et = EPISODE_TITLES[(si * 3 + e) % EPISODE_TITLES.length];
        const epId = id + '-s' + sn + '-e' + e;
        const watched = chance(0.55);
        season.episodes.push({
          kind: 'episode',
          id: epId,
          title: et,
          number: e,
          seriesId: id,
          seriesTitle: title,
          seasonNumber: sn,
          synopsis,
          categoryId,
          genre,
          year,
          tags: tags.slice(),
          poster: title + ' ' + et,
          thumbnail: title + ' ' + et,
          duration: dur,
          resolution: pick(['2160p', '1080p', '1080p', '720p']),
          quality: pick(['2160p', '1080p', '1080p', '720p']),
          videoCodec: pick(['HEVC', 'H.264', 'AV1']),
          audioCodec: pick(['AAC', 'AC3', 'E-AC3']),
          sizeBytes: int(2, 24) * 1073741824,
          path:
            'D:\\Media\\Series\\' +
            title.replace(/[^A-Za-z0-9 ]/g, '') +
            '\\S' +
            String(sn).padStart(2, '0') +
            'E' +
            String(e).padStart(2, '0') +
            '.mkv',
          source: SAMPLE_MEDIA[(si + e) % SAMPLE_MEDIA.length],
          addedAt: new Date(2026, 0, 1 + si * 9 + e).toISOString(),
          watched,
          progress: watched ? 0 : chance(0.5) ? int(60, dur - 60) : 0,
          rating: chance(0.6) ? int(3, 5) : 0,
          favorite: chance(0.15),
          hidden: false,
          audioTracks: makeAudioTracks(int(1, 3)),
          subtitleTracks: makeSubs(int(0, 3), si),
          chapters: makeChapters(dur),
          introStart: 0,
          introEnd: int(20, 70),
          creditsStart: Math.max(0, dur - int(60, 180)),
          creditsEnd: dur,
          sceneThumbs: [],
        });
      }
      item.seasons.push(season);
    }
    out.push(item);
  });
  return out;
}

export const SERIES: Series[] = buildSeries();

/* ------------------- vídeos independientes ------------------- */

const VIDEO_SEED: [string, string, number, string][] = [
  ['Aurora sobre el fiordo', 'Documental', 2024, 'Drone sobre un fiordo noruego en pleno ciclo solar.'],
  ['Cocina de autor: technique', 'Recetas', 2025, 'Masterclass de técnica de cocina mediterránea.'],
  ['Concierto en el hangar', 'Conciertos', 2023, 'Set completo de la banda en un hangar reconvertido.'],
  ['La deuda del rio', 'Cine', 2022, 'Thriller rural sobre unembalse y sus Secrets.'],
  ['Testimonios del hielo', 'Documental', 2025, 'Antarctica, 40 días de expedicion.'],
  ['Taller de cerámica', 'Personal', 2024, 'Un Artesano y su horno de leña.'],
  ['Rally de montaña', 'Documental', 2023, 'Tres etapas de rally enroads de montaña.'],
  ['Midnight drive', 'Personal', 2025, 'Recorrido nocturno por la costa en unaclassic 90.'],
  ['Exposición: formas del agua', 'Personal', 2024, 'Recorrido guiado por una exposición de escultura.'],
  ['Simulacro de emergencia', 'Documental', 2022, 'Cómo se prepara un hospital ante un terremoto.'],
  ['Festival de Verano', 'Conciertos', 2024, 'Directo desde el escenario principal.'],
  ['La casa de los espejos', 'Cine', 2021, 'Psic thriller en un edificio de muchas plantas.'],
  ['Panorama: Icelandic', 'Documental', 2025, 'Un viaje en time-lapse por Islandia.'],
  ['Curso de Photoshop', 'Personal', 2023, 'Curso intensivo de edicion de imagen.'],
  ['El sabor delPacifico', 'Recetas', 2024, 'Cocina costera chileana con ingredientes locales.'],
  ['Herencia del Marley', 'Conciertos', 2022, 'Documental musical sobre laWuWu discografica.'],
  ['Deep space live', 'Documental', 2026, 'Transmision en directo de un lanzamiento desde la ESA.'],
  ['Tecnologia del zoologico', 'Documental', 2026, 'Un documental sobre la zoo y su futuro.'],
];

function folderFor(categoryName: string): string {
  const map: Record<string, string> = {
    Cine: 'D:\\Media\\Peliculas',
    Series: 'D:\\Media\\Series',
    Documental: 'D:\\Media\\Peliculas\\Documentales',
    'Animación': 'D:\\Media\\Series\\Animacion',
    Conciertos: 'D:\\Media\\Peliculas\\Recitales',
    Recetas: 'D:\\Media\\Series\\Recetas',
    Personal: 'E:\\Familia',
  };
  return map[categoryName] || 'D:\\Media\\Peliculas';
}

export const VIDEOS: Video[] = VIDEO_SEED.map(([title, cat, year, syn], i) => {
  const dur = int(600, 10800);
  const q = pick(['2160p', '1080p', '1080p', '1440p', '720p']);
  const categoryId = (CATEGORIES.find((c) => c.name === cat) || CATEGORIES[2]).id;
  return {
    kind: 'video',
    id: 'v' + (i + 1),
    title,
    synopsis: syn,
    categoryId,
    genre: pick(['Naturaleza', 'Cocina', 'Música', 'Suspenso', 'Tecnología', 'Deporte', 'Arte']),
    year,
    tags: Array.from(new Set([pick(TAGS), pick(TAGS), cat.toLowerCase()])),
    poster: title,
    thumbnail: title,
    duration: dur,
    resolution: q,
    quality: q,
    videoCodec: pick(['HEVC', 'H.264', 'AV1']),
    audioCodec: pick(['AAC', 'AC3']),
    sizeBytes: int(1, 14) * 1073741824,
    path: folderFor(cat) + '\\' + title.replace(/[^A-Za-z0-9 ]/g, '') + '.mkv',
    source: SAMPLE_MEDIA[i % SAMPLE_MEDIA.length],
    addedAt: new Date(2026, 0, 3 + i * 11).toISOString(),
    watched: chance(0.4),
    progress: chance(0.5) ? int(30, dur - 30) : 0,
    rating: chance(0.7) ? int(3, 5) : 0,
    favorite: chance(0.3),
    hidden: chance(0.08),
    audioTracks: makeAudioTracks(int(1, 3)),
    subtitleTracks: makeSubs(int(0, 3), i),
    chapters: makeChapters(dur),
    introStart: 0,
    introEnd: int(15, 60),
    creditsStart: Math.max(0, dur - int(45, 150)),
    creditsEnd: dur,
    sceneThumbs: [],
    categoryLocked: false,
  };
});

/* ------------------- música ------------------- */

const ARTIST_SEED: [string, string, number][] = [
  ['ÓRBITA BAJA', 'Synth ambient', 2019],
  ['Marisol Vega', 'Bolero electrónico', 2016],
  ['The Copper Lines', 'Rock alternativo', 2014],
  ['Yuki Tanaka', 'Jazz fusión', 2021],
  ['Los Hermanos Paz', 'Folk andino', 2011],
  ['Neon Crab', 'Electro punk', 2023],
  ['Ana Fielding', 'Indie folk', 2018],
  ['Kilombo', 'Afrobeat', 2020],
];

const ALBUM_NAMES = ['Marea', 'Sessions Vol. 2', 'Nocturno', 'Cobre', 'Raíces', 'Grieta', 'Aurora', 'Cauce'];
const TRACK_TITLES = [
  'Marea',
  'Kilómetro cero',
  'Río',
  'Neón',
  'Sal',
  'Cuarto growing',
  'Estática',
  'Faro',
  'Ceniza',
  'Piedra',
  'Ámbar',
  'Bruma',
  'Tarde',
  'Norte',
  'Arena',
  'Fuego lento',
];

function buildMusic(): { artists: Artist[]; albums: Album[]; tracks: Track[] } {
  const artists: Artist[] = [];
  const albums: Album[] = [];
  const tracks: Track[] = [];

  ARTIST_SEED.forEach(([name, genre, year], ai) => {
    artists.push({
      id: 'ar' + (ai + 1),
      name,
      genre,
      year,
      image: name,
      bio: 'Artista local de ' + genre.toLowerCase() + ', activo desde ' + year + '.',
    });

    const albN = int(1, 3);
    for (let k = 0; k < albN; k++) {
      const albTitle = ALBUM_NAMES[(ai + k) % ALBUM_NAMES.length] + (k ? ' II' : '');
      const album: Album = {
        id: 'al' + (ai + 1) + '-' + k,
        title: albTitle,
        artistId: 'ar' + (ai + 1),
        artistName: name,
        year: year + k,
        genre,
        cover: albTitle,
        trackIds: [],
        addedAt: new Date(2025, ai % 12, 1 + k).toISOString(),
      };
      albums.push(album);

      const trN = int(6, 12);
      for (let t = 1; t <= trN; t++) {
        const tt = pick(TRACK_TITLES);
        const track: Track = {
          id: 'tr' + (ai + 1) + '-' + k + '-' + t,
          title: tt + (t > 1 ? ' (' + (t + 1) + ')' : ''),
          albumId: album.id,
          albumTitle: albTitle,
          artistId: artist.id,
          artistName: name,
          trackNo: t,
          duration: int(140, 420),
          genre,
          year: album.year,
          source: SAMPLE_AUDIO[(ai + k + t) % SAMPLE_AUDIO.length],
          cover: album.cover,
          path:
            'D:\\Musica\\' +
            name +
            '\\' +
            albTitle +
            '\\' +
            String(t).padStart(2, '0') +
            ' ' +
            tt +
            '.flac',
          played: int(0, 180),
          plays: int(0, 240),
          rating: chance(0.5) ? int(3, 5) : 0,
          addedAt: new Date(2025, ai % 12, 1 + t).toISOString(),
          lyrics: chance(0.5) ? 'Letra sincronizada de ' + tt + '\nSegunda línea del coro\n...' : null,
          replayGain: (int(-8, -1) / 10).toFixed(1) + ' dB',
        };
        tracks.push(track);
        album.trackIds.push(track.id);
      }
    }
  });

  return { artists, albums, tracks };
}

const MUSIC = buildMusic();
export const ARTISTS: Artist[] = MUSIC.artists;
export const ALBUMS: Album[] = MUSIC.albums;
export const TRACKS: Track[] = MUSIC.tracks;

export const PLAYLISTS: Playlist[] = [
  {
    id: 'pl1',
    name: 'Focus Machine',
    description: 'Instrumental para trabajar en profundidad.',
    trackIds: TRACKS.slice(0, 8).map((t) => t.id),
    rules: null,
    cover: TRACKS[0]?.cover ?? null,
  },
  {
    id: 'pl2',
    name: 'No escuchadas en 6 meses',
    description: 'Regla automática: pistas sin reproducción en 180 días.',
    trackIds: [],
    rules: { type: 'notPlayed', days: 180 },
    cover: TRACKS[9]?.cover ?? null,
  },
  {
    id: 'pl3',
    name: 'Añadidos en los últimos 30 días',
    description: 'Regla automática: agregados recientemente.',
    trackIds: [],
    rules: { type: 'recentlyAdded', days: 30 },
    cover: TRACKS[3]?.cover ?? null,
  },
];

/* ------------------- biblioteca ------------------- */

export const LIBRARY_FOLDERS: LibraryFolder[] = [
  {
    id: 'lf1',
    name: 'Peliculas',
    path: 'D:\\Media\\Peliculas',
    scope: 'Cine',
    autoScan: true,
    lastScan: '2026-11-06T03:10:00Z',
    files: 412,
    sizeBytes: 214748364800,
  },
  {
    id: 'lf2',
    name: 'Series',
    path: 'D:\\Media\\Series',
    scope: 'Series',
    autoScan: true,
    lastScan: '2026-11-06T03:22:00Z',
    files: 1780,
    sizeBytes: 536870912000,
  },
  {
    id: 'lf3',
    name: 'Musica personal',
    path: 'D:\\Musica',
    scope: 'Musica',
    autoScan: true,
    lastScan: '2026-11-05T23:40:00Z',
    files: 2841,
    sizeBytes: 107374182400,
  },
  {
    id: 'lf4',
    name: 'Videos familiares',
    path: 'E:\\Familia',
    scope: 'Personal',
    autoScan: false,
    lastScan: null,
    files: 96,
    sizeBytes: 8589934592,
  },
];

export const IGNORED_FILES: IgnoredFile[] = [
  {
    id: 'ig1',
    name: 'sample_4k_hdr_bug.mkv',
    path: 'D:\\Media\\Peliculas\\_tmp',
    reason: 'Archivo de prueba corrupto',
  },
  {
    id: 'ig2',
    name: 'trailer_final_v2_cut.mp4',
    path: 'D:\\Media\\Peliculas\\_tmp',
    reason: 'Duplicado de trabajo',
  },
];

export const DUPLICATES: DuplicateFile[] = [
  {
    id: 'dp1',
    name: 'Aurora sobre el fiordo.mkv',
    path: 'D:\\Media\\Peliculas\\Documentales\\',
    hash: 'e3b0c44298fc1c14',
    size: '8.4 GB',
    copies: 2,
  },
  {
    id: 'dp2',
    name: 'Concierto en el hangar.mp4',
    path: 'E:\\Familia\\Recitales\\',
    hash: 'a94a8fe5ccb19ba61',
    size: '4.1 GB',
    copies: 3,
  },
];

/* ------------------- usuarios ------------------- */

export const PROFILES: Profile[] = [
  {
    id: 'u1',
    name: 'Frank',
    role: 'admin',
    avatar: 'F',
    color: '#4f5bd5',
    pin: '1234',
    parental: { enabled: true, maxRating: 'PG-13' },
    preferences: {
      hoverPreview: true,
      autoplayNext: true,
      imageAdjustments: null,
      lang: 'es',
      writeTagsToFile: false,
      keyboardShortcuts: true,
    },
    libraryAccess: ['lf1', 'lf2', 'lf3', 'lf4'],
  },
  {
    id: 'u2',
    name: 'Ana',
    role: 'user',
    avatar: 'A',
    color: '#ec4899',
    pin: '4321',
    parental: { enabled: false, maxRating: 'G' },
    preferences: {
      hoverPreview: true,
      autoplayNext: true,
      imageAdjustments: null,
      lang: 'es',
      writeTagsToFile: false,
      keyboardShortcuts: true,
    },
    libraryAccess: ['lf2', 'lf3'],
  },
  {
    id: 'u3',
    name: 'Niños',
    role: 'child',
    avatar: 'N',
    color: '#10b981',
    pin: '0000',
    parental: { enabled: true, maxRating: 'G' },
    preferences: {
      hoverPreview: false,
      autoplayNext: false,
      imageAdjustments: null,
      lang: 'es',
      writeTagsToFile: false,
      keyboardShortcuts: false,
    },
    libraryAccess: ['lf3'],
  },
];

/* ------------------- sistema ------------------- */

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    type: 'episode',
    title: 'Nuevo episodio disponible',
    body: 'Cielo de Ceniza: El Retorno — Episodio 1 ya está en tu biblioteca.',
    at: '2026-11-09T08:12:00Z',
    read: false,
    icon: 'tv',
  },
  {
    id: 'n2',
    type: 'scan',
    title: 'Escaneo completado',
    body: 'Se indexaron 128 archivos nuevos en la carpeta Series.',
    at: '2026-11-09T03:22:00Z',
    read: false,
    icon: 'scan',
  },
  {
    id: 'n3',
    type: 'track',
    title: 'Nueva pista añadida',
    body: 'Kilombo — Cauce ya está disponible en tu biblioteca musical.',
    at: '2026-11-08T19:40:00Z',
    read: true,
    icon: 'music',
  },
  {
    id: 'n4',
    type: 'backup',
    title: 'Backup completado',
    body: 'Copia de metadatos y configuración guardada correctamente.',
    at: '2026-11-07T02:00:00Z',
    read: true,
    icon: 'backup',
  },
];

export const ACTIVITY_LOG: ActivityEntry[] = [
  { id: 'a1', at: '2026-11-09T08:12:04Z', module: 'Series', user: 'Frank', command: 'AddEpisodeCommand', detail: 's8-s1-e1' },
  { id: 'a2', at: '2026-11-09T03:22:41Z', module: 'Biblioteca', user: 'sistema', command: 'ScanLibraryCommand', detail: 'lf2 — 128 archivos' },
  { id: 'a3', at: '2026-11-08T19:40:10Z', module: 'Musica', user: 'Frank', command: 'AddTrackCommand', detail: 'tr8-0-4' },
  { id: 'a4', at: '2026-11-08T11:02:55Z', module: 'Galeria', user: 'Ana', command: 'MoveFilesCommand', detail: '4 archivos → /Ordenado' },
  { id: 'a5', at: '2026-11-07T02:00:00Z', module: 'Admin', user: 'Frank', command: 'TriggerBackupCommand', detail: 'metadata-backup-2026-11-07.zip' },
  { id: 'a6', at: '2026-11-06T18:20:31Z', module: 'Taxonomia', user: 'Ana', command: 'CreateTagCommand', detail: 'viajes-2026' },
];

export const SERVER_SETTINGS: ServerSettings = {
  transcode: { enabled: true, profile: '1080p-h264', bitrate: '4500', threads: 4, cacheGb: 20 },
  scan: { intervalHours: 6, watcher: true, autoAdd: false },
  bandwidth: { limitMbps: 0, perClient: false },
  backup: { enabled: true, schedule: '0 2 * * *', retention: 7 },
  remote: { enabled: false, twoFactor: false },
  api: { swagger: true, docs: true },
};

export const SERVER_STATUS: ServerStatus = {
  version: '1.0.0',
  uptimeHours: 412,
  cpu: 23,
  memory: 61,
  storageUsedBytes: 867483648000,
  storageTotalBytes: 2199023255552,
  activeSessions: 1,
  dbStatus: 'ok',
  lastBackup: '2026-11-07T02:00:00Z',
};
