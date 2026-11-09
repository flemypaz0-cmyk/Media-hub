import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'warn' | 'error';

export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
  icon: string;
}

const ICONS: Record<ToastKind, string> = {
  info: 'info',
  success: 'check',
  warn: 'warning',
  error: 'warning',
};

/** Avisos efímeros (snackbar) apilados en la parte inferior. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(text: string, kind: ToastKind = 'info', duration = 3200): void {
    const toast: Toast = { id: this.nextId++, text, kind, icon: ICONS[kind] };
    this._toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), duration);
  }

  success(text: string): void {
    this.show(text, 'success');
  }

  error(text: string): void {
    this.show(text, 'error', 4600);
  }

  warn(text: string): void {
    this.show(text, 'warn');
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
