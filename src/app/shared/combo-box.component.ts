import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * Combo box reutilizable para valores categóricos reutilizables
 * (categoría, etiquetas, género, colección, calidad, idioma, artista, álbum).
 *
 * Incluye búsqueda incremental y creación "al vuelo" del valor escrito.
 * Uso:
 *   <mh-combo-box label="Categoría" [values]="categorias()" [value]="catId()" (valueChange)="catId.set($event)" />
 */
@Component({
  selector: 'mh-combo-box',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="combo">
      @if (label()) {
        <div class="field-label">{{ label() }}</div>
      }
      @if (multiple()) {
        <div class="multi-select">
          @if (selectedList().length === 0) {
            <span class="hint">{{ placeholder() }}</span>
          }
          @for (v of selectedList(); track v) {
            <span class="tag-chip primary">
              {{ v }}
              <button type="button" class="chip-x" (click)="remove(v)" aria-label="Quitar {{ v }}">✕</button>
            </span>
          }
        </div>
        <input
          class="input"
          type="text"
          role="combobox"
          [attr.aria-expanded]="open()"
          [attr.aria-label]="label() || placeholder()"
          [placeholder]="placeholder()"
          [value]="query()"
          autocomplete="off"
          (input)="onInput($event)"
          (focus)="open.set(true)"
        />
      } @else {
        <input
          class="input"
          type="text"
          role="combobox"
          [attr.aria-expanded]="open()"
          [attr.aria-label]="label() || placeholder()"
          [placeholder]="placeholder()"
          [value]="displayValue()"
          autocomplete="off"
          (input)="onInput($event)"
          (focus)="open.set(true)"
        />
      }

      @if (open()) {
        <div class="combo-list" (mouseleave)="open.set(false)">
          @for (v of filtered(); track v) {
            <button type="button" (click)="pick(v)">
              <span>{{ v }}</span>
              @if (isSelected(v)) {
                <span class="ck"><mh-icon name="check" [size]="16" /></span>
              }
            </button>
          }
          @if (canCreate()) {
            <button type="button" class="combo-new" (click)="create()">
              <mh-icon name="plus" [size]="16" />
              <span>Crear "{{ query() }}"</span>
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ComboBoxComponent {
  readonly label = input<string>('');
  readonly values = input<string[]>([]);
  /** Valor seleccionado: texto (simple) o lista de textos (múltiple). */
  readonly value = input<string | string[] | null>(null);
  readonly multiple = input(false);
  readonly placeholder = input<string>('Buscar o crear...');
  readonly allowCreate = input(true);
  readonly valueChange = output<string | string[] | null>();

  readonly query = signal('');
  readonly open = signal(false);

  readonly selectedList = computed<string[]>(() => {
    const v = this.value();
    if (v === null || v === undefined) return [];
    return Array.isArray(v) ? v : [v];
  });

  readonly displayValue = computed(() => {
    if (this.multiple()) return '';
    const v = this.value();
    return typeof v === 'string' ? v : '';
  });

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const values = this.values();
    return q ? values.filter((v) => v.toLowerCase().includes(q)) : values;
  });

  readonly canCreate = computed(() => {
    const q = this.query().trim();
    if (!this.allowCreate() || !q) return false;
    return !this.values().some((v) => v.toLowerCase() === q.toLowerCase());
  });

  onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.open.set(true);
  }

  isSelected(value: string): boolean {
    return this.selectedList().includes(value);
  }

  pick(value: string): void {
    this.open.set(false);
    this.query.set('');
    if (this.multiple()) {
      const current = this.selectedList();
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      this.valueChange.emit(next);
    } else {
      this.valueChange.emit(value);
    }
  }

  remove(value: string): void {
    this.valueChange.emit(this.selectedList().filter((v) => v !== value));
  }

  create(): void {
    const q = this.query().trim();
    if (!q) return;
    this.open.set(false);
    this.query.set('');
    if (this.multiple()) {
      const current = this.selectedList();
      if (!current.includes(q)) this.valueChange.emit([...current, q]);
    } else {
      this.valueChange.emit(q);
    }
  }
}
