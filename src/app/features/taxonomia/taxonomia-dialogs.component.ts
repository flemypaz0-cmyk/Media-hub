import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Category } from '../../core/models';
import { DialogService } from '../../core/services/dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { MediaHubStore } from '../../core/store/mediahub.store';
import { ComboBoxComponent } from '../../shared/combo-box.component';
import { IconComponent } from '../../shared/icon.component';

export interface CategoryDialogData {
  /** Categoría a editar; `null` para crear una nueva. */
  category: Category | null;
  /** Nombres existentes: alimentan el combo con búsqueda y creación al vuelo. */
  names: string[];
}

/**
 * Alta y edición de categorías.
 *
 * El nombre es un valor categórico reutilizable (combo con búsqueda y
 * creación al vuelo); el color es texto libre.
 */
@Component({
  selector: 'mh-category-dialog',
  imports: [ComboBoxComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-scrim" (click)="close()">
      <div class="dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <div class="dlg-head">
          <h2>{{ isEdit() ? 'Editar categoría' : 'Nueva categoría' }}</h2>
          <button class="icon-btn" type="button" aria-label="Cerrar" (click)="close()"><mh-icon name="close" /></button>
        </div>
        <div class="dlg-body">
          <mh-combo-box
            label="Nombre"
            [values]="data().names"
            [value]="name()"
            placeholder="Nombre de la categoría"
            (valueChange)="onName($event)"
          />
          <div class="field">
            <label class="field-label" for="cat-color">Color</label>
            <input
              id="cat-color"
              class="input"
              type="text"
              autocomplete="off"
              [value]="color()"
              (input)="color.set(inputValue($event))"
              placeholder="#4f5bd5"
            />
            <span class="hint">Color en hexadecimal o cualquier texto libre.</span>
          </div>
        </div>
        <div class="dlg-foot">
          <button class="btn btn-text" type="button" (click)="close()">Cancelar</button>
          <button class="btn btn-filled" type="button" (click)="save()">{{ isEdit() ? 'Guardar' : 'Crear' }}</button>
        </div>
      </div>
    </div>
  `,
})
export class CategoryDialogComponent {
  readonly data = input.required<CategoryDialogData>();

  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(MediaHubStore);

  readonly name = signal('');
  readonly color = signal('#4f5bd5');
  readonly isEdit = computed(() => !!this.data().category);

  constructor() {
    queueMicrotask(() => this.load());
  }

  private load(): void {
    const cat = this.data().category;
    if (!cat) return;
    this.name.set(cat.name);
    this.color.set(cat.color);
  }

  onName(value: string | string[] | null): void {
    if (typeof value === 'string') this.name.set(value);
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  save(): void {
    const name = this.name().trim();
    if (!name) {
      this.toast.error('El nombre es obligatorio.');
      return;
    }
    const color = this.color().trim() || '#4f5bd5';
    const current = this.data().category;
    if (current) {
      this.store.dispatch({ type: 'UpdateCategoryCommand', payload: { id: current.id, name, color } });
    } else {
      this.store.dispatch({ type: 'CreateCategoryCommand', payload: { name, color } });
    }
    this.toast.success(current ? 'Categoría actualizada.' : 'Categoría creada.');
    this.close();
  }

  close(): void {
    this.dialogs.closeTop();
  }
}

export interface TagDialogData {
  /** Etiquetas ya existentes, para detectar duplicados. */
  existing: string[];
}

/** Alta de una etiqueta nueva. */
@Component({
  selector: 'mh-tag-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-scrim" (click)="close()">
      <div class="dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <div class="dlg-head">
          <h2>Nueva etiqueta</h2>
          <button class="icon-btn" type="button" aria-label="Cerrar" (click)="close()"><mh-icon name="close" /></button>
        </div>
        <div class="dlg-body">
          <div class="field">
            <label class="field-label" for="tag-name">Nombre</label>
            <input
              id="tag-name"
              class="input"
              type="text"
              autocomplete="off"
              [value]="name()"
              (input)="name.set(inputValue($event))"
              placeholder="ej. viajes-2026"
            />
          </div>
        </div>
        <div class="dlg-foot">
          <button class="btn btn-text" type="button" (click)="close()">Cancelar</button>
          <button class="btn btn-filled" type="button" (click)="save()">Crear</button>
        </div>
      </div>
    </div>
  `,
})
export class TagDialogComponent {
  readonly data = input.required<TagDialogData>();

  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(MediaHubStore);

  readonly name = signal('');

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  save(): void {
    const name = this.name().trim();
    if (!name) {
      this.toast.error('El nombre es obligatorio.');
      return;
    }
    if (this.data().existing.some((t) => t.toLowerCase() === name.toLowerCase())) {
      this.toast.error('La etiqueta ya existe.');
      return;
    }
    this.store.dispatch({ type: 'CreateTagCommand', payload: name });
    this.toast.success('Etiqueta creada.');
    this.close();
  }

  close(): void {
    this.dialogs.closeTop();
  }
}
