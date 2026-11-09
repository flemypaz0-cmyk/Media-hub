import { Injectable, computed, signal } from '@angular/core';
import { LibraryEntry } from '../models';

export type RepeatMode = 'off' | 'one' | 'all';

/**
 * Estado del reproductor de vídeo.
 *
 * El componente `VideoPlayerComponent` se limita a pintar el estado y a
 * sincronizarse con el elemento `<video>`; toda la lógica (siguiente
 * episodio, A-B, velocidad…) vive aquí para que cualquier vista pueda abrir
 * el reproductor.
 */
@Injectable({ providedIn: 'root' })
export class PlayerService {
  readonly current = signal<LibraryEntry | null>(null);
  readonly isOpen = signal(false);
  readonly playing = signal(false);
  readonly position = signal(0);
  readonly duration = signal(0);
  readonly buffered = signal(0);
  readonly rate = signal(1);
  readonly volume = signal(80);
  readonly muted = signal(false);
  readonly repeatMode = signal<RepeatMode>('off');
  readonly abRange = signal<{ a: number; b: number } | null>(null);
  readonly queue = signal<LibraryEntry[]>([]);
  readonly nextUp = signal<LibraryEntry | null>(null);
  readonly nextCountdown = signal<number | null>(null);
  readonly chapters = signal<{ id: string; title: string; start: number; end: number }[]>([]);
  readonly activeChapter = computed(() => {
    const pos = this.position();
    return this.chapters().find((c) => pos >= c.start && pos < c.end) ?? null;
  });
  readonly progressPercent = computed(() => {
    const d = this.duration();
    return d > 0 ? (this.position() / d) * 100 : 0;
  });

  /** Elemento `<video>` gestionado por el componente de reproducción. */
  videoElement: HTMLVideoElement | null = null;

  openItem(item: LibraryEntry, queue?: LibraryEntry[]): void {
    this.current.set(item);
    this.chapters.set(item.chapters ?? []);
    this.abRange.set(null);
    this.nextCountdown.set(null);
    this.position.set(item.progress ?? 0);
    if (queue && queue.length) this.queue.set(queue);
    this.isOpen.set(true);
    this.playing.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.playing.set(false);
    this.nextCountdown.set(null);
    this.current.set(null);
  }

  toggle(): void {
    this.playing.update((v) => !v);
  }

  setPosition(seconds: number): void {
    this.position.set(Math.max(0, seconds));
  }

  setDuration(seconds: number): void {
    this.duration.set(seconds);
  }

  setRate(rate: number): void {
    this.rate.set(rate);
  }

  setVolume(value: number): void {
    this.volume.set(value);
    this.muted.set(value === 0);
  }

  toggleMute(): void {
    this.muted.update((v) => !v);
  }

  toggleRepeat(): void {
    const order: RepeatMode[] = ['off', 'one', 'all'];
    const next = order[(order.indexOf(this.repeatMode()) + 1) % order.length];
    this.repeatMode.set(next);
  }

  setAbRange(range: { a: number; b: number } | null): void {
    this.abRange.set(range);
  }

  setQueue(items: LibraryEntry[]): void {
    this.queue.set(items);
  }

  /** Reproduce el siguiente elemento de la cola. */
  next(): void {
    const q = this.queue();
    const current = this.current();
    if (!current) return;
    const index = q.findIndex((x) => x.id === current.id);
    const nextItem = index >= 0 ? q[index + 1] : q[0];
    if (!nextItem) {
      this.playing.set(false);
      return;
    }
    this.openItem(nextItem, q);
  }

  previous(): void {
    const q = this.queue();
    const current = this.current();
    if (!current) return;
    const index = q.findIndex((x) => x.id === current.id);
    const prevItem = index > 0 ? q[index - 1] : q[q.length - 1];
    if (prevItem) this.openItem(prevItem, q);
  }
}
