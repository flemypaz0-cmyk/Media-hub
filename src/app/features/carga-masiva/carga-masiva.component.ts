import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MediaHubStore } from '../../core/store/mediahub.store';
import { FileExplorerService, ExplorerFile } from '../../core/services/file-explorer.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { ArtComponent } from '../../shared/art.component';
import { formatBytes } from '../../core/util/format';

export interface CandidateItem {
  id: string;
  name: string;
  path: string;
  title: string;
  genre: string;
  quality: string;
  size: number;
  selected: boolean;
  favorite: boolean;
  kind: 'video' | 'episode' | 'track';
}

@Component({
  selector: 'mh-carga-masiva',
  standalone: true,
  imports: [IconComponent, ArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">Carga masiva desde carpeta</h1>
        <p class="page-sub">
          Explora cualquier carpeta puntual de tu disco local e importa múltiples vídeos o canciones en bloque sin copiarlos
        </p>
      </div>
      @if (step() === 'list' && candidates().length > 0) {
        <div class="page-head-actions">
          <button class="btn btn-outlined" type="button" (click)="startQuickReview()">
            <mh-icon name="play" [size]="18" />
            <span>Modo revisión rápida</span>
          </button>
          <button class="btn btn-filled" type="button" (click)="confirmImport()" [disabled]="selectedCount() === 0">
            <mh-icon name="check" [size]="18" />
            <span>Importar {{ selectedCount() }} seleccionados</span>
          </button>
        </div>
      }
    </div>

    <!-- PASO 1: SELECCIÓN DE CARPETA -->
    @if (step() === 'folder') {
      <div style="background: var(--md-sys-color-surface-container-low); border-radius: 20px; padding: 24px; max-width: 800px; margin-bottom: 24px">
        <h2 style="font: var(--md-sys-typescale-title-medium); margin-bottom: 16px; display: flex; align-items: center; gap: 8px">
          <mh-icon name="folder" [size]="20" />
          <span>Seleccionar carpeta de origen</span>
        </h2>

        <div class="field" style="margin-bottom: 16px">
          <span class="field-label">Ruta de la carpeta a explorar</span>
          <div style="display: flex; gap: 8px">
            <input class="input" type="text" [value]="selectedPath()" (input)="onPathInput($event)" placeholder="Ej. D:\\Media\\Peliculas" />
            <button class="btn btn-tonal" type="button" (click)="exploreCandidates()">
              Explorar
            </button>
          </div>
        </div>

        <div style="margin-bottom: 16px">
          <span class="field-label" style="display: block; margin-bottom: 8px">Carpetas frecuentes del sistema:</span>
          <div class="chips">
            @for (r of explorer.roots; track r.path) {
              <button
                type="button"
                class="chip"
                [class.selected]="selectedPath() === r.path"
                (click)="selectRoot(r.path)"
              >
                {{ r.name }} ({{ r.path }})
              </button>
            }
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px; margin-top: 20px; border-top: 1px solid var(--md-sys-color-outline-variant); padding-top: 16px">
          <input
            type="checkbox"
            id="subfolders"
            [checked]="includeSubfolders()"
            (change)="includeSubfolders.set(!includeSubfolders())"
            style="width: 18px; height: 18px; cursor: pointer"
          />
          <label for="subfolders" style="font: var(--md-sys-typescale-body-medium); cursor: pointer">
            Incluir subcarpetas en la búsqueda recursiva (GetFolderVideoCandidatesQuery)
          </label>
        </div>

        <div style="margin-top: 24px; display: flex; justify-content: flex-end">
          <button class="btn btn-filled" type="button" (click)="exploreCandidates()">
            <mh-icon name="search" [size]="18" />
            <span>Buscar candidatos en la carpeta</span>
          </button>
        </div>
      </div>
    }

    <!-- PASO 2: LISTA DE CANDIDATOS -->
    @if (step() === 'list') {
      <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
        <button class="btn btn-text" type="button" (click)="step.set('folder')">
          <mh-icon name="arrow-left" [size]="18" />
          <span>Cambiar carpeta</span>
        </button>
        <span style="font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant)">
          Ruta: <code style="font-family: monospace">{{ selectedPath() }}</code> ({{ candidates().length }} archivos detectados)
        </span>
        <div style="margin-left: auto; display: flex; gap: 8px">
          <button class="btn btn-outlined" type="button" (click)="selectAll(true)">Seleccionar todos</button>
          <button class="btn btn-text" type="button" (click)="selectAll(false)">Deseleccionar</button>
        </div>
      </div>

      <div style="background: var(--md-sys-color-surface-container-low); border-radius: 16px; overflow: hidden; margin-bottom: 24px">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 40px">
                <input type="checkbox" [checked]="isAllSelected()" (change)="toggleAll()" />
              </th>
              <th>Título detectado</th>
              <th>Calidad</th>
              <th>Género estimado</th>
              <th>Tamaño</th>
              <th>Ruta original</th>
              <th>Favorito</th>
            </tr>
          </thead>
          <tbody>
            @for (c of candidates(); track c.id) {
              <tr [style.opacity]="c.selected ? '1' : '0.5'">
                <td>
                  <input type="checkbox" [checked]="c.selected" (change)="toggleSelect(c.id)" />
                </td>
                <td>
                  <b>{{ c.title }}</b>
                </td>
                <td><span class="badge res">{{ c.quality }}</span></td>
                <td><span class="tag-chip primary" style="font-size: 0.75rem">{{ c.genre }}</span></td>
                <td>{{ formatBytes(c.size) }}</td>
                <td style="font-family: monospace; font-size: 0.8rem; word-break: break-all">{{ c.path }}</td>
                <td>
                  <button class="icon-btn" type="button" (click)="toggleCandidateFavorite(c.id)">
                    <mh-icon name="heart" [size]="16" [style.color]="c.favorite ? '#ff5252' : 'inherit'" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <!-- PASO 3: MODO REVISIÓN RÁPIDA (PANTALLA COMPLETA / TARJETA INTERACTIVA) -->
    @if (step() === 'quickReview') {
      @if (currentReviewItem(); as item) {
        <div class="dialog-scrim" style="background: rgba(0,0,0,0.85); backdrop-filter: blur(8px)">
          <div class="dialog" style="max-width: 600px; padding: 24px" role="dialog" aria-modal="true">
            <div class="dlg-head" style="margin-bottom: 12px">
              <div>
                <h2>Revisión rápida de candidatos</h2>
                <p class="card-meta">
                  Candidato {{ reviewIndex() + 1 }} de {{ candidates().length }}
                </p>
              </div>
              <button class="icon-btn" aria-label="Cerrar revisión" (click)="step.set('list')">
                <mh-icon name="close" />
              </button>
            </div>

            <!-- Progreso superior -->
            <div class="meter" style="margin-bottom: 20px">
              <div class="meter-fill" [style.width.%]="reviewProgress()"></div>
            </div>

            <!-- Tarjeta del candidato -->
            <div style="position: relative; aspect-ratio: 16/9; border-radius: 16px; overflow: hidden; margin-bottom: 20px; box-shadow: var(--md-sys-elevation-3)">
              <mh-art [seed]="item.title" kind="wide" />
              <video
                src="/assets/media/clip-01.mp4"
                autoplay
                loop
                muted
                playsinline
                style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover"
              ></video>
              <div class="badge badge-tl res">{{ item.quality }}</div>
              @if (item.favorite) {
                <div class="badge badge-br" style="color: #ff5252">★ Favorito</div>
              }
            </div>

            <div style="margin-bottom: 20px">
              <h3 style="font: var(--md-sys-typescale-title-large); margin-bottom: 4px">{{ item.title }}</h3>
              <div class="card-meta" style="margin-bottom: 8px">
                Género: <b>{{ item.genre }}</b> · Tamaño: <b>{{ formatBytes(item.size) }}</b>
              </div>
              <div style="font-family: monospace; font-size: 0.8rem; color: var(--md-sys-color-on-surface-variant); word-break: break-all">
                {{ item.path }}
              </div>
            </div>

            <!-- Acciones de decisión rápida -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px">
              <button
                class="btn btn-outlined"
                type="button"
                style="height: 52px; font-size: 1rem"
                (click)="decisionDiscard()"
              >
                <mh-icon name="x" [size]="20" />
                <span>Descartar</span>
              </button>

              <button
                class="btn btn-tonal"
                type="button"
                style="height: 52px; font-size: 1rem; color: #ff5252"
                (click)="decisionFavorite()"
              >
                <mh-icon name="heart" [size]="20" />
                <span>Favorito</span>
              </button>

              <button
                class="btn btn-filled"
                type="button"
                style="height: 52px; font-size: 1rem"
                (click)="decisionInclude()"
              >
                <mh-icon name="check" [size]="20" />
                <span>Incluir</span>
              </button>
            </div>

            <div style="text-align: center; margin-top: 16px; font: var(--md-sys-typescale-body-small); color: var(--md-sys-color-on-surface-variant)">
              Atajos de teclado: <b>←</b> Descartar &nbsp;|&nbsp; <b>F</b> Favorito &nbsp;|&nbsp; <b>→</b> Incluir
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class CargaMasivaComponent {
  private readonly store = inject(MediaHubStore);
  readonly explorer = inject(FileExplorerService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly step = signal<'folder' | 'list' | 'quickReview'>('folder');
  readonly selectedPath = signal<string>('D:\\Media\\Peliculas');
  readonly includeSubfolders = signal<boolean>(true);
  readonly candidates = signal<CandidateItem[]>([]);
  readonly reviewIndex = signal<number>(0);

  readonly formatBytes = formatBytes;

  readonly selectedCount = computed(() => this.candidates().filter((c) => c.selected).length);

  readonly isAllSelected = computed(
    () => this.candidates().length > 0 && this.candidates().every((c) => c.selected),
  );

  readonly currentReviewItem = computed(() => {
    const list = this.candidates();
    const idx = this.reviewIndex();
    return list[idx] ?? null;
  });

  readonly reviewProgress = computed(() => {
    const total = this.candidates().length;
    if (total === 0) return 0;
    return Math.round(((this.reviewIndex() + 1) / total) * 100);
  });

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (this.step() !== 'quickReview') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.decisionDiscard();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.decisionInclude();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        this.decisionFavorite();
      } else if (e.key === 'Escape') {
        this.step.set('list');
      }
    });
  }

  selectRoot(path: string): void {
    this.selectedPath.set(path);
  }

  onPathInput(e: Event): void {
    this.selectedPath.set((e.target as HTMLInputElement).value);
  }

  exploreCandidates(): void {
    const path = this.selectedPath().trim();
    if (!path) {
      this.toast.error('Especifica una ruta de carpeta válida.');
      return;
    }

    const files = this.explorer.fileListFor(path, path.includes('Musica') ? 'audio' : 'video');
    const isAudio = path.includes('Musica');
    const genres = ['Acción', 'Drama', 'Comedia', 'Ciencia Ficción', 'Documental', 'Aventura', 'Animación'];

    const items: CandidateItem[] = files.map((f, i) => {
      const cleanTitle = f.name
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[-_.]+/g, ' ')
        .trim();
      return {
        id: 'cand-' + i,
        name: f.name,
        path: f.path,
        title: cleanTitle,
        genre: genres[i % genres.length],
        quality: i % 3 === 0 ? '4K UHD' : i % 2 === 0 ? '1080p' : '720p',
        size: f.size || (1.5 + (i % 3)) * 1073741824,
        selected: true,
        favorite: false,
        kind: isAudio ? 'track' : cleanTitle.toLowerCase().includes('s0') ? 'episode' : 'video',
      };
    });

    this.candidates.set(items);
    this.step.set('list');
    this.toast.success(`Se encontraron ${items.length} archivos multimedia en la carpeta.`);
  }

  toggleSelect(id: string): void {
    this.candidates.update((list) =>
      list.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)),
    );
  }

  toggleCandidateFavorite(id: string): void {
    this.candidates.update((list) =>
      list.map((c) => (c.id === id ? { ...c, favorite: !c.favorite } : c)),
    );
  }

  selectAll(selected: boolean): void {
    this.candidates.update((list) => list.map((c) => ({ ...c, selected })));
  }

  toggleAll(): void {
    const next = !this.isAllSelected();
    this.selectAll(next);
  }

  startQuickReview(): void {
    this.reviewIndex.set(0);
    this.step.set('quickReview');
  }

  decisionInclude(): void {
    const idx = this.reviewIndex();
    this.candidates.update((list) =>
      list.map((c, i) => (i === idx ? { ...c, selected: true } : c)),
    );
    this.advanceReview();
  }

  decisionDiscard(): void {
    const idx = this.reviewIndex();
    this.candidates.update((list) =>
      list.map((c, i) => (i === idx ? { ...c, selected: false } : c)),
    );
    this.advanceReview();
  }

  decisionFavorite(): void {
    const idx = this.reviewIndex();
    this.candidates.update((list) =>
      list.map((c, i) => (i === idx ? { ...c, selected: true, favorite: true } : c)),
    );
    this.advanceReview();
  }

  private advanceReview(): void {
    if (this.reviewIndex() + 1 < this.candidates().length) {
      this.reviewIndex.update((i) => i + 1);
    } else {
      this.toast.success('¡Has revisado todos los candidatos!');
      this.step.set('list');
    }
  }

  confirmImport(): void {
    const toImport = this.candidates().filter((c) => c.selected);
    if (!toImport.length) {
      this.toast.error('No hay archivos seleccionados para importar.');
      return;
    }

    this.store.dispatch({
      type: 'BulkImportFromFolderCommand',
      payload: {
        folderPath: this.selectedPath(),
        files: toImport.map((c) => ({
          path: c.path,
          title: c.title,
          genre: c.genre,
          quality: c.quality,
          favorite: c.favorite,
          kind: c.kind,
        })),
      },
    });

    this.toast.success(`${toImport.length} archivos importados exitosamente.`);
    this.router.navigate(['/inicio']);
  }
}
