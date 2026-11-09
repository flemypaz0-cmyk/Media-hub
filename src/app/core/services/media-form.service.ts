import { Injectable, inject } from '@angular/core';
import { DialogService } from './dialog.service';
import { MediaFormComponent, MediaFormKind } from '../../shared/media-form.component';

export interface MediaFormContext {
  /** Id del elemento a editar (omitido para altas). */
  id?: string;
  /** Serie destino cuando se da de alta un episodio. */
  seriesId?: string;
}

/**
 * Punto de entrada único para dar de alta o editar contenido.
 *
 * Alta y edición son acciones puntuales dentro de la experiencia de biblioteca,
 * no una sección de administración.
 */
@Injectable({ providedIn: 'root' })
export class MediaFormService {
  private readonly dialogs = inject(DialogService);

  open(kind: MediaFormKind, context: MediaFormContext = {}): void {
    this.dialogs.open(MediaFormComponent, { kind, ...context });
  }

  /** Alta de una pista de música. */
  openTrack(context: MediaFormContext = {}): void {
    this.open('track', context);
  }
}
