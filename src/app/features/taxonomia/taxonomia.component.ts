import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Category, Video } from '../../core/models';
import { DialogService } from '../../core/services/dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { MediaHubStore } from '../../core/store/mediahub.store';
import { ComboBoxComponent } from '../../shared/combo-box.component';
import { IconComponent } from '../../shared/icon.component';
import { CategoryDialogComponent, TagDialogComponent } from './taxonomia-dialogs.component';

interface CategoryRow {
  category: Category;
  /** Elementos (episodios + vídeos) que usan la categoría. */
  count: number;
}

interface TagRow {
  tag: string;
  /** Elementos que usan la etiqueta. */
  count: number;
}

/**
 * Taxonomía: categorías (una por vídeo) y etiquetas (múltiples).
 *
 * Además del CRUD, permite asignar la taxonomía a un vídeo concreto.
 */
@Component({
  selector: 'mh-taxonomia',
  imports: [ComboBoxComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">Taxonomía</h1>
        <p class="page-sub">Categorías (una por video) y etiquetas (múltiples)</p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-outlined" type="button" (click)="openTagDialog()">
          <mh-icon name="tag" [size]="18" />Nueva etiqueta
        </button>
        <button class="btn btn-filled" type="button" (click)="openCategoryDialog()">
          <mh-icon name="plus" [size]="18" />Nueva categoría
        </button>
      </div>
    </div>

    <section class="section">
      <div class="section-head">
        <h2 class="section-title">Categorías</h2>
        <span class="section-count">{{ categoryRows().length }}</span>
      </div>
      @if (categoryRows().length) {
        <div class="grid wide">
          @for (row of categoryRows(); track row.category.id) {
            <article class="card card-wide">
              <span class="cat-swatch" [style.background]="row.category.color"></span>
              <div class="cw-meta">
                <div class="cw-title">{{ row.category.name }}</div>
                <div class="cw-sub">{{ row.count }} video(s)</div>
              </div>
              <button
                class="icon-btn"
                type="button"
                title="Editar"
                [attr.aria-label]="'Editar ' + row.category.name"
                (click)="openCategoryDialog(row.category)"
              >
                <mh-icon name="edit" [size]="18" />
              </button>
              <button
                class="icon-btn"
                type="button"
                title="Eliminar"
                [attr.aria-label]="'Eliminar ' + row.category.name"
                (click)="removeCategory(row.category)"
              >
                <mh-icon name="delete" [size]="18" />
              </button>
            </article>
          }
        </div>
      } @else {
        <div class="empty-state">
          <div class="es-ic"><mh-icon name="tag" [size]="32" /></div>
          <h3>Sin categorías</h3>
          <p>Crea la primera categoría para clasificar tu biblioteca.</p>
        </div>
      }
    </section>

    <section class="section">
      <div class="section-head">
        <h2 class="section-title">Etiquetas</h2>
        <span class="section-count">{{ tagRows().length }}</span>
        <div class="section-actions">
          <button class="btn btn-tonal" type="button" (click)="openTagDialog()">
            <mh-icon name="plus" [size]="18" />Nueva etiqueta
          </button>
        </div>
      </div>
      @if (tagRows().length) {
        <div class="chips">
          @for (row of tagRows(); track row.tag) {
            <span class="tag-chip primary">
              {{ row.tag }} ({{ row.count }})
              <button
                class="chip-x"
                type="button"
                [attr.aria-label]="'Eliminar etiqueta ' + row.tag"
                (click)="removeTag(row.tag)"
              >
                ✕
              </button>
            </span>
          }
        </div>
      } @else {
        <div class="empty-state">
          <div class="es-ic"><mh-icon name="tag" [size]="32" /></div>
          <h3>Sin etiquetas</h3>
          <p>Las etiquetas permiten clasificar un mismo contenido con varios descriptores.</p>
        </div>
      }
    </section>

    <section class="section">
      <div class="section-head">
        <h2 class="section-title">Asignar taxonomía a un vídeo</h2>
      </div>
      <div class="grid-2">
        <div class="field">
          <label class="field-label" for="tx-video">Vídeo</label>
          <select id="tx-video" class="select" [value]="selectedVideoId() ?? ''" (change)="onVideoChange($event)">
            <option value="">Selecciona un vídeo…</option>
            @for (video of videos(); track video.id) {
              <option [value]="video.id">{{ video.title }}</option>
            }
          </select>
        </div>
        <mh-combo-box
          label="Categoría"
          [values]="categoryNames()"
          [value]="selectedCategoryName()"
          placeholder="Sin categoría"
          (valueChange)="onCategoryPicked($event)"
        />
      </div>
      <div class="field">
        <mh-combo-box
          label="Etiquetas"
          [values]="store.tags()"
          [value]="selectedTags()"
          [multiple]="true"
          placeholder="Añade etiquetas"
          (valueChange)="onTagsPicked($event)"
        />
        <span class="hint">Puedes crear etiquetas nuevas al vuelo: se registran en la taxonomía.</span>
      </div>
      <div class="assign-actions">
        <button class="btn btn-filled" type="button" [disabled]="!selectedVideoId()" (click)="applyTaxonomy()">
          <mh-icon name="check" [size]="18" />Aplicar taxonomía
        </button>
        <button class="btn btn-text" type="button" [disabled]="!selectedVideoId()" (click)="clearCategory()">
          Quitar categoría
        </button>
      </div>
    </section>
  `,
  styles: [
    `
      .cat-swatch {
        width: 12px;
        height: 44px;
        border-radius: 6px;
        flex: 0 0 12px;
      }
      .assign-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .chip-x {
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        margin-left: 6px;
      }
    `,
  ],
})
export class TaxonomiaComponent {
  readonly store = inject(MediaHubStore);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly videos = computed<Video[]>(() => this.store.videos());

  readonly categoryRows = computed<CategoryRow[]>(() => {
    const entries = this.store.allEntries();
    return this.store.categories().map((category) => ({
      category,
      count: entries.filter((e) => e.categoryId === category.id).length,
    }));
  });

  readonly tagRows = computed<TagRow[]>(() =>
    this.store.tags().map((tag) => ({
      tag,
      count: this.store.entriesByTags([tag], 'any').length,
    })),
  );

  readonly categoryNames = computed<string[]>(() => this.store.categories().map((c) => c.name));

  /* ---------------------------- asignación ---------------------------- */

  readonly selectedVideoId = signal<string | null>(null);
  readonly selectedCategoryName = signal<string | null>(null);
  readonly selectedTags = signal<string[]>([]);

  onVideoChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedVideoId.set(id || null);
    const video = this.videos().find((v) => v.id === id);
    this.selectedCategoryName.set(
      video ? (this.store.categoryById(video.categoryId)?.name ?? null) : null,
    );
    this.selectedTags.set(video ? [...video.tags] : []);
  }

  onCategoryPicked(value: string | string[] | null): void {
    this.selectedCategoryName.set(typeof value === 'string' ? value : null);
  }

  onTagsPicked(value: string | string[] | null): void {
    if (Array.isArray(value)) {
      this.selectedTags.set([...value]);
      return;
    }
    if (typeof value === 'string') {
      this.selectedTags.update((tags) => (tags.includes(value) ? tags : [...tags, value]));
    }
  }

  clearCategory(): void {
    this.selectedCategoryName.set(null);
  }

  applyTaxonomy(): void {
    const id = this.selectedVideoId();
    if (!id) return;

    const name = this.selectedCategoryName();
    let categoryId: string | null = null;
    if (name) {
      const found = this.store.categories().find((c) => c.name === name);
      if (found) {
        categoryId = found.id;
      } else {
        this.store.dispatch({ type: 'CreateCategoryCommand', payload: { name } });
        categoryId = this.store.categories().find((c) => c.name === name)?.id ?? null;
      }
    }

    const tags = this.selectedTags();
    tags.forEach((tag) => {
      if (!this.store.tags().includes(tag)) {
        this.store.dispatch({ type: 'CreateTagCommand', payload: tag });
      }
    });

    this.store.dispatch({ type: 'AssignCategoryCommand', payload: { id, categoryId } });
    this.store.dispatch({ type: 'AssignTagsCommand', payload: { id, tags } });
    this.toast.success('Taxonomía aplicada.');
  }

  /* ------------------------------ acciones ------------------------------ */

  openCategoryDialog(category?: Category): void {
    this.dialogs.open(CategoryDialogComponent, {
      category: category ?? null,
      names: this.categoryNames(),
    });
  }

  removeCategory(category: Category): void {
    this.store.dispatch({ type: 'DeleteCategoryCommand', payload: category.id });
    this.toast.success('Categoría eliminada. Los vídeos quedan sin categoría.');
  }

  openTagDialog(): void {
    this.dialogs.open(TagDialogComponent, { existing: this.store.tags() });
  }

  removeTag(tag: string): void {
    this.store.dispatch({ type: 'DeleteTagCommand', payload: tag });
    this.toast.success('Etiqueta eliminada.');
  }
}
