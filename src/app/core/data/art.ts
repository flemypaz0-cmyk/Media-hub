/**
 * Arte de portada determinista.
 *
 * Antes era una imagen SVG codificada como data-URI; en Angular se renderiza
 * como SVG en línea (componente `ArtComponent`), lo que evita el escapado
 * frágil de `url()` en CSS y mantiene el archivo de estado mucho más ligero.
 */

export type ArtKind = 'poster' | 'wide';

export interface ArtCircle {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

export interface ArtSpec {
  from: string;
  to: string;
  angle: number;
  circles: ArtCircle[];
  width: number;
  height: number;
}

const PALETTES: [string, string][] = [
  ['#4f5bd5', '#8b5cf6'],
  ['#0ea5e9', '#22d3ee'],
  ['#f59e0b', '#ef4444'],
  ['#10b981', '#14b8a6'],
  ['#ec4899', '#8b5cf6'],
  ['#6366f1', '#06b6d4'],
  ['#f43f5e', '#fb923c'],
  ['#059669', '#84cc16'],
  ['#7c3aed', '#db2777'],
  ['#0891b2', '#3b82f6'],
];

export function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Construye la especificación del degradado a partir de una semilla estable. */
export function artSpec(seed: string, kind: ArtKind = 'poster'): ArtSpec {
  const h = hashString(seed + (kind === 'wide' ? 'w' : ''));
  const [from, to] = PALETTES[h % PALETTES.length];
  const angle = h % 360;

  if (kind === 'wide') {
    return {
      from,
      to,
      angle,
      width: 640,
      height: 360,
      circles: [{ cx: 150 + (h % 340), cy: 80 + (h % 200), r: 70 + (h % 60), opacity: 0.12 }],
    };
  }

  return {
    from,
    to,
    angle,
    width: 480,
    height: 720,
    circles: [
      { cx: 120 + (h % 240), cy: 180 + (h % 300), r: 90 + (h % 70), opacity: 0.1 },
      { cx: 60 + (h % 120), cy: 520 + (h % 160), r: 60 + (h % 50), opacity: 0.07 },
    ],
  };
}
