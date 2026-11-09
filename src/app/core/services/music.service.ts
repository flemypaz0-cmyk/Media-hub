import { Injectable, computed, signal } from '@angular/core';
import { Track } from '../models';

export type MusicRepeat = 'off' | 'one' | 'all';

/**
 * Estado del reproductor de música (mini-player y vistas de audio).
 *
 * El elemento `<audio>` real vive aquí; los componentes solo leen el estado y
 * disparan acciones.
 */
@Injectable({ providedIn: 'root' })
export class MusicService {
  readonly queue = signal<Track[]>([]);
  readonly current = signal<Track | null>(null);
  readonly playing = signal(false);
  readonly position = signal(0);
  readonly duration = signal(0);
  readonly volume = signal(70);
  readonly muted = signal(false);
  readonly shuffle = signal(false);
  readonly repeat = signal<MusicRepeat>('off');
  readonly crossfade = signal(0);
  readonly gapless = signal(true);
  readonly visualizer = signal(false);
  readonly equalizerEnabled = signal(false);
  readonly equalizerPreset = signal('Flat');
  readonly panel = signal<'none' | 'queue' | 'equalizer'>('none');

  readonly progressPercent = computed(() => {
    const d = this.duration();
    return d > 0 ? (this.position() / d) * 100 : 0;
  });

  audioElement: HTMLAudioElement | null = null;

  /** Reproduce una pista (y opcionalmente reemplaza la cola). */
  play(track: Track, queue?: Track[]): void {
    if (queue && queue.length) this.queue.set(queue);
    this.current.set(track);
    this.position.set(0);
    this.playing.set(true);
  }

  toggle(): void {
    if (!this.current()) return;
    this.playing.update((v) => !v);
  }

  stop(): void {
    this.playing.set(false);
    this.position.set(0);
  }

  close(): void {
    this.playing.set(false);
    this.current.set(null);
    this.queue.set([]);
    this.position.set(0);
  }

  next(): void {
    const q = this.queue();
    const current = this.current();
    if (!q.length) return;
    const index = current ? q.findIndex((t) => t.id === current.id) : -1;
    const nextTrack = this.shuffle()
      ? q[Math.floor(Math.random() * q.length)]
      : q[index + 1] ?? (this.repeat() === 'all' ? q[0] : undefined);
    if (!nextTrack) {
      this.playing.set(false);
      return;
    }
    this.play(nextTrack);
  }

  previous(): void {
    const q = this.queue();
    const current = this.current();
    if (!current) return;
    const index = q.findIndex((t) => t.id === current.id);
    const prevTrack = index > 0 ? q[index - 1] : q[q.length - 1];
    if (prevTrack) this.play(prevTrack);
  }

  setPosition(seconds: number): void {
    this.position.set(Math.max(0, seconds));
  }

  setDuration(seconds: number): void {
    this.duration.set(seconds);
  }

  setVolume(value: number): void {
    this.volume.set(value);
    this.muted.set(value === 0);
  }

  toggleMute(): void {
    this.muted.update((v) => !v);
  }

  toggleShuffle(): void {
    this.shuffle.update((v) => !v);
  }

  cycleRepeat(): void {
    const order: MusicRepeat[] = ['off', 'one', 'all'];
    this.repeat.set(order[(order.indexOf(this.repeat()) + 1) % order.length]);
  }

  /** Reordena la cola (arrastrando una pista). */
  reorderQueue(from: number, to: number): void {
    const q = this.queue().slice();
    if (from < 0 || from >= q.length || to < 0 || to >= q.length) return;
    const [moved] = q.splice(from, 1);
    q.splice(to, 0, moved);
    this.queue.set(q);
  }

  removeFromQueue(id: string): void {
    const current = this.current();
    const q = this.queue().filter((t) => t.id !== id);
    this.queue.set(q);
    if (current?.id === id) this.stop();
  }
}
