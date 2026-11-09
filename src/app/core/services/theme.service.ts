import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { MediaHubStore } from '../store/mediahub.store';

export type ThemeMode = 'auto' | 'light' | 'dark';

/**
 * Tema de la interfaz. Modo `auto` sigue la preferencia del sistema operativo
 * mediante `matchMedia`, el resto fija el tema de forma explícita.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly store = inject(MediaHubStore);
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');

  readonly mode = signal<ThemeMode>('auto');
  readonly resolved = signal<'light' | 'dark'>('dark');

  constructor() {
    this.mode.set(this.store.theme());
    effect(() => {
      const mode = this.mode();
      this.store.dispatch({ type: 'SetStateCommand', payload: { theme: mode } });
      this.apply();
    });

    const listener = () => {
      if (this.mode() === 'auto') this.apply();
    };
    this.media?.addEventListener?.('change', listener);
    this.apply();
  }

  /** Fija el tema explícitamente. */
  set(mode: ThemeMode): void {
    this.mode.set(mode);
    this.apply();
  }

  /** Alterna auto → claro → oscuro → auto. */
  cycle(): void {
    const order: ThemeMode[] = ['auto', 'light', 'dark'];
    const next = order[(order.indexOf(this.mode()) + 1) % order.length];
    this.set(next);
  }

  apply(): void {
    const mode = this.mode();
    const dark = mode === 'dark' || (mode === 'auto' && !!this.media?.matches);
    const resolved = dark ? 'dark' : 'light';
    this.resolved.set(resolved);
    const root = this.document.documentElement;
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-mode', mode);
    root.style.colorScheme = resolved;
  }
}
