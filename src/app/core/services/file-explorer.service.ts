import { Injectable } from '@angular/core';

export type ExplorerKind = 'video' | 'image' | 'subtitle' | 'folder' | 'audio';

export interface ExplorerRoot {
  name: string;
  path: string;
}

export interface ExplorerFile {
  name: string;
  path: string;
  kind: 'file' | 'folder';
  size: number;
  thumb?: string | null;
}

const MAX_TREE_DEPTH = 3;

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Explorador de archivos.
 *
 * IMPORTANTE: la app nunca copia ni mueve archivos. Este componente solo
 * captura la ruta original del archivo elegido (y sus metadatos) para
 * registrarla en la biblioteca.
 */
@Injectable({ providedIn: 'root' })
export class FileExplorerService {
  readonly roots: ExplorerRoot[] = [
    { name: 'Peliculas', path: 'D:\\Media\\Peliculas' },
    { name: 'Series', path: 'D:\\Media\\Series' },
    { name: 'Musica', path: 'D:\\Musica' },
    { name: 'Familia', path: 'E:\\Familia' },
    { name: 'Descargas', path: 'C:\\Users\\Frank\\Downloads' },
  ];

  /** Árbol de carpetas determinista derivado de la ruta. */
  buildTree(path: string, depth = 0): ExplorerFile[] {
    if (depth >= MAX_TREE_DEPTH) return [];
    const r = rng(hash(path));
    const names = [
      'Documentales',
      'Clásicos',
      'Facciones',
      'Temporadas',
      'Recitales',
      'Serie A',
      'Tesis',
      'Reportajes',
      'Originales',
      'Extras',
    ];
    return names
      .slice(0, 4 + Math.floor(r() * 5))
      .map((n) => ({
        name: n,
        path: path + '\\' + n,
        kind: 'folder' as const,
        size: 0,
        children: this.buildTree(path + '\\' + n, depth + 1),
      }));
  }

  /** Archivos de una carpeta para el tipo de contenido indicado. */
  fileListFor(path: string, kind: ExplorerKind): ExplorerFile[] {
    const r = rng(hash(path));
    const out: ExplorerFile[] = [];

    if (kind === 'folder') {
      this.buildTree(path).forEach((f) =>
        out.push({ name: f.name, path: f.path, kind: 'folder', size: 0 }),
      );
      return out;
    }

    const pools: Record<string, string[]> = {
      video: [
        'Pelicula 2024 1080p.mkv',
        'Documental.mkv',
        'Episodio S01E03.mkv',
        'Concierto.mp4',
        'Charla.mp4',
        'Receta corta.mp4',
        'Demo HDR.mp4',
      ],
      image: ['poster.png', 'caratula-vertical.jpg', 'thumbnail.jpg', 'banner.png', 'portada.jpg'],
      subtitle: ['subtitulos.es.srt', 'subtitulos.en.ass', 'forced.vtt', 'audio-described.srt'],
      audio: ['pista 01.flac', 'pista 02.flac', 'album track.mp3'],
    };
    const pool = pools[kind] ?? pools['video'];
    const n = 6 + Math.floor(r() * 8);
    for (let i = 0; i < n; i++) {
      const base = pool[Math.floor(r() * pool.length)];
      const name = i < pool.length ? base : base.replace(/\.[a-z0-9]+$/i, ' (' + (i + 1) + ')$&');
      out.push({
        name,
        path: path + '\\' + name,
        kind: 'file',
        size: Math.floor(r() * 9) * 1073741824 + Math.floor(r() * 900000000),
      });
    }
    return out;
  }

  labelFor(kind: ExplorerKind): string {
    return (
      { video: 'Vídeos', image: 'Imágenes', subtitle: 'Subtítulos', folder: 'Carpetas', audio: 'Audio' }[
        kind
      ] ?? 'Archivos'
    );
  }
}
