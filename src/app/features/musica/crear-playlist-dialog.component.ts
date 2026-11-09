import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DialogService } from '../../core/services/dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/icon.component';

/** Datos que devuelve el diálogo al crear una playlist. */
export interface PlaylistDraft {
  name: string;
  description: string;
  rules: { type: 'notPlayed' | 'recentlyAdded'; days: number } | null;
}

type PlaylistType = 'manual' | 'recent' | 'unplayed';

/**
 * Diálogo propio de la vista Música: alta de una lista de reproducción.
 * Se abre con `DialogService.openWithResult` y devuelve el borrador.
 */
@Component({
  selector: 'mh-crear-playlist-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-scrim" (click)="cancelar()">
      <div class="dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <div class="dlg-head">
          <h2>Nueva playlist</h2>
          <button class="icon-btn" type="button" aria-label="Cerrar" (click)="cancelar()">
            <mh-icon name="close" />
          </button>
        </div>
        <div class="dlg-body">
          <div class="field">
            <span class="field-label">Nombre</span>
            <input class="input" type="text" placeholder="Mi playlist" [value]="name()" (input)="onName($event)" />
          </div>
          <div class="field">
            <span class="field-label">Descripción</span>
            <input
              class="input"
              type="text"
              placeholder="Opcional"
              [value]="description()"
              (input)="onDescription($event)"
            />
          </div>
          <div class="field">
            <span class="field-label">Tipo</span>
            <select class="select" [value]="type()" (change)="onType($event)">
              <option value="manual">Manual</option>
              <option value="recent">Inteligente: añadidos en los últimos 30 días</option>
              <option value="unplayed">Inteligente: no escuchadas en 6 meses</option>
            </select>
          </div>
          <p class="hint">
            Las playlists inteligentes se rellenan solas a partir de las reglas; las manuales收纳 las pistas
            que añadas.
          </p>
        </div>
        <div class="dlg-foot">
          <button class="btn btn-text" type="button" (click)="cancelar()">Cancelar</button>
          <button class="btn btn-filled" type="button" (click)="crear()">Crear</button>
        </div>
      </div>
    </div>
  `,
})
export class CrearPlaylistDialogComponent {
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly name = signal('');
  readonly description = signal('');
  readonly type = signal<PlaylistType>('manual');

  onName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  onDescription(event: Event): void {
    this.description.set((event.target as HTMLInputElement).value);
  }

  onType(event: Event): void {
    this.type.set((event.target as HTMLSelectElement).value as PlaylistType);
  }

  crear(): void {
    const nombre = this.name().trim();
    if (!nombre) {
      this.toast.error('Escribe un nombre.');
      return;
    }
    const type = this.type();
    const draft: PlaylistDraft = {
      name: nombre,
      description: this.description().trim(),
      rules:
        type === 'recent'
          ? { type: 'recentlyAdded', days: 30 }
          : type === 'unplayed'
            ? { type: 'notPlayed', days: 180 }
            : null,
    };
    this.dialogs.closeTop(draft);
  }

  cancelar(): void {
    this.dialogs.closeTop();
  }
}
