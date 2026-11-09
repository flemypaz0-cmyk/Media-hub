import {
  ApplicationRef,
  ComponentRef,
  EnvironmentInjector,
  Injectable,
  Type,
  createComponent,
  inject,
  signal,
} from '@angular/core';

interface DialogEntry {
  ref: ComponentRef<unknown>;
  resolve?: (value: unknown) => void;
}

/**
 * Gestión de diálogos apilados.
 *
 * Cada diálogo es un componente Angular independiente que se adjunta al
 * `document.body`; el servicio mantiene la pila para que un diálogo
 * secundario (por ejemplo, el explorador de archivos dentro del formulario de
 * alta) se superponga al anterior sin reemplazarlo.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly injector = inject(EnvironmentInjector);
  private readonly appRef = inject(ApplicationRef);
  private readonly stack: DialogEntry[] = [];
  private readonly _depth = signal(0);

  /** Número de diálogos abiertos (para el z-index y el foco). */
  readonly depth = this._depth.asReadonly();

  /**
   * Abre un diálogo. El componente puede declarar `data = input<T>()` para
   * recibir el contexto inicial.
   */
  open<T>(component: Type<T>, data?: unknown): ComponentRef<T> {
    const host = document.createElement('div');
    host.className = 'dialog-layer';
    document.body.appendChild(host);

    const ref = createComponent(component, {
      environmentInjector: this.injector,
      hostElement: host,
    });

    if (data !== undefined) {
      try {
        ref.setInput('data', data);
      } catch {
        /* el componente no declara la entrada `data` */
      }
    }

    this.appRef.attachView(ref.hostView);
    this.stack.push({ ref: ref as ComponentRef<unknown> });
    this._depth.set(this.stack.length);
    return ref;
  }

  /** Abre un diálogo que devuelve un resultado al abrirlo. */
  openWithResult<T, R>(component: Type<T>, data?: unknown): { ref: ComponentRef<T>; result: Promise<R> } {
    const ref = this.open(component, data);
    let resolve!: (value: R) => void;
    const result = new Promise<R>((r) => (resolve = r));
    const entry = this.stack[this.stack.length - 1];
    if (entry) entry.resolve = resolve as (value: unknown) => void;
    return { ref, result };
  }

  /** Cierra un diálogo concreto, opcionalmente con resultado. */
  close(ref: ComponentRef<unknown>, result?: unknown): void {
    const index = this.stack.findIndex((entry) => entry.ref === ref);
    if (index === -1) return;
    const [entry] = this.stack.splice(index, 1);
    entry.resolve?.(result);
    this.destroy(entry.ref);
    this._depth.set(this.stack.length);
  }

  /** Cierra el diálogo superior (usado por Escape). */
  closeTop(result?: unknown): boolean {
    const entry = this.stack[this.stack.length - 1];
    if (!entry) return false;
    this.stack.pop();
    entry.resolve?.(result);
    this.destroy(entry.ref);
    this._depth.set(this.stack.length);
    return true;
  }

  closeAll(): void {
    while (this.stack.length) {
      const entry = this.stack.pop();
      if (entry) {
        entry.resolve?.(undefined);
        this.destroy(entry.ref);
      }
    }
    this._depth.set(0);
  }

  get hasOpenDialog(): boolean {
    return this.stack.length > 0;
  }

  private destroy(ref: ComponentRef<unknown>): void {
    this.appRef.detachView(ref.hostView);
    ref.destroy();
    const host = ref.location.nativeElement as HTMLElement;
    host.remove();
  }
}
