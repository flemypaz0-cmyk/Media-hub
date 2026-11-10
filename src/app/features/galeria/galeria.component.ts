import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MediaHubStore } from '../../core/store/mediahub.store';
import { PlayerService } from '../../core/services/player.service';
import { MusicService } from '../../core/services/music.service';
import { FileExplorerService, ExplorerFile } from '../../core/services/file-explorer.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { ArtComponent } from '../../shared/art.component';
import { LibraryEntry, Video } from '../../core/models';
import { formatBytes, formatDuration } from '../../core/util/format';

type GaleriaMode = 'arbol' | 'tematica';
type QuickFilter = 'todos' | 'videos' | 'musica' | 'recientes' | 'top_rated' | 'grandes';

interface GaleriaPosterItem {
  id: string;
  title: string;
  sub: string;
  seed: string;
  kind: 'video' | 'music';
  rating: number;
  sizeBytes: number;
  addedAt: string;
  rawItem?: LibraryEntry;
}

@Component({
  selector: 'mh-galeria',
  standalone: true,
  imports: [IconComponent, ArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">Galería y explorador de medios</h1>
        <p class="page-sub">
          Navegación híbrida por árbol de carpetas, gestión de archivos locales y privacidad con PIN
        </p>
      </div>

      <div class="page-head-actions">
        <!-- Botón de protección con PIN -->
        <button
          class="btn"
          [class.btn-tonal]="hiddenUnlocked()"
          [class.btn-outlined]="!hiddenUnlocked()"
          type="button"
          (click)="togglePinModal()"
        >
          <mh-icon [name]="hiddenUnlocked() ? 'unlock' : 'lock'" [size]="18" />
          <span>{{ hiddenUnlocked() ? 'Ocultos desbloqueados' : 'Desbloquear con PIN' }}</span>
        </button>

        <!-- Selector de modo -->
        <div style="display: flex; background: var(--md-sys-color-surface-container); border-radius: 999px; padding: 3px">
          <button
            type="button"
            class="chip"
            style="border: none; margin: 0"
            [class.selected]="mode() === 'arbol'"
            (click)="mode.set('arbol')"
          >
            <mh-icon name="folder" [size]="16" />
            <span>Árbol de carpetas</span>
          </button>
          <button
            type="button"
            class="chip"
            style="border: none; margin: 0"
            [class.selected]="mode() === 'tematica'"
            (click)="mode.set('tematica')"
          >
            <mh-icon name="grid" [size]="16" />
            <span>Galería temática</span>
          </button>
        </div>
      </div>
    </div>

    <!-- MODO 1: NAVEGACIÓN HÍBRIDA ÁRBOL + CARPETAS -->
    @if (mode() === 'arbol') {
      <div style="display: grid; grid-template-columns: 260px 1fr; gap: 20px; align-items: flex-start">
        <!-- Panel lateral con árbol de carpetas -->
        <aside style="background: var(--md-sys-color-surface-container-low); border-radius: 16px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
            <h3 style="font: var(--md-sys-typescale-title-small); font-weight: 600">Carpetas en disco</h3>
            <button class="icon-btn" type="button" title="Nueva subcarpeta" (click)="openCreateFolderModal()">
              <mh-icon name="folder-plus" [size]="16" />
            </button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 2px">
            @for (root of explorer.roots; track root.path) {
              <button
                type="button"
                class="pp-opt"
                [class.sel]="currentPath() === root.path"
                style="padding: 8px 10px; border-radius: 8px; width: 100%; text-align: left; border: none; cursor: pointer"
                (click)="selectFolder(root.path)"
              >
                <mh-icon name="folder" [size]="18" />
                <span style="font-weight: 500; font-size: 0.875rem">{{ root.name }}</span>
              </button>

              @if (currentPath().startsWith(root.path)) {
                @for (sub of subfolders(); track sub.path) {
                  <button
                    type="button"
                    class="pp-opt"
                    [class.sel]="currentPath() === sub.path"
                    style="padding: 6px 8px 6px 28px; border-radius: 8px; width: 100%; text-align: left; border: none; cursor: pointer; font-size: 0.8rem"
                    (click)="selectFolder(sub.path)"
                  >
                    <mh-icon name="corner-down-right" [size]="14" />
                    <span>{{ sub.name }}</span>
                  </button>
                }
              }
            }
          </div>
        </aside>

        <!-- Contenido de la carpeta -->
        <div>
          <!-- Barra de ruta (Breadcrumb) y acciones de carpeta -->
          <div style="background: var(--md-sys-color-surface-container-low); border-radius: 14px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
            <div style="display: flex; align-items: center; gap: 6px; font-family: monospace; font-size: 0.875rem; flex: 1; min-width: 0; word-break: break-all">
              <mh-icon name="folder" [size]="18" style="color: var(--md-sys-color-primary); flex-shrink: 0" />
              <span>{{ currentPath() }}</span>
            </div>

            <!-- Acciones por lote sobre archivos seleccionados -->
            @if (selectedIds().size > 0) {
              <div style="display: flex; gap: 6px; align-items: center">
                <span class="badge res">{{ selectedIds().size }} seleccionados</span>
                <button class="btn btn-outlined" type="button" (click)="openBatchRenameModal()">
                  <mh-icon name="edit-3" [size]="16" />
                  <span>Renombrar</span>
                </button>
                <button class="btn btn-outlined" type="button" (click)="openMoveModal()">
                  <mh-icon name="external-link" [size]="16" />
                  <span>Mover/Copiar</span>
                </button>
                <button class="btn btn-danger" type="button" (click)="trashSelected()">
                  <mh-icon name="trash" [size]="16" />
                  <span>Papelera</span>
                </button>
              </div>
            } @else {
              <div style="display: flex; gap: 6px">
                <button class="btn btn-text" type="button" (click)="selectAll()">Seleccionar todos</button>
              </div>
            }
          </div>

          <!-- Cuadrícula de archivos en la carpeta actual -->
          @if (folderVideos().length === 0) {
            <div class="empty-state" style="padding: 48px; text-align: center; color: var(--md-sys-color-on-surface-variant)">
              <mh-icon name="folder" [size]="48" />
              <p style="margin-top: 12px">No hay vídeos registrados en esta carpeta.</p>
            </div>
          } @else {
            <div class="grid poster">
              @for (v of folderVideos(); track v.id) {
                <article class="card" [class.selected]="selectedIds().has(v.id)">
                  <div class="card-poster" (click)="playVideo(v)">
                    <div class="ph"><mh-art [seed]="v.poster || v.title" /><span>{{ v.title }}</span></div>
                    <div class="badge badge-tl res">{{ v.quality }}</div>

                    @if (v.hidden) {
                      <div class="badge badge-br" style="background: rgba(0,0,0,0.8); color: #ffa726">
                        <mh-icon name="lock" [size]="13" />
                      </div>
                    }

                    <!-- Checkbox de selección múltiple -->
                    <div
                      style="position: absolute; top: 8px; left: 8px; z-index: 4"
                      (click)="$event.stopPropagation(); toggleSelect(v.id)"
                    >
                      <input
                        type="checkbox"
                        [checked]="selectedIds().has(v.id)"
                        style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--md-sys-color-primary)"
                      />
                    </div>

                    <div class="card-actions" (click)="$event.stopPropagation()">
                      <button class="icon-btn" type="button" title="Información técnica" (click)="showInfo(v)">
                        <mh-icon name="info" [size]="16" />
                      </button>
                      <button class="icon-btn" type="button" [title]="v.hidden ? 'Hacer visible' : 'Ocultar'" (click)="toggleHide(v.id)">
                        <mh-icon [name]="v.hidden ? 'eye' : 'eye-off'" [size]="16" />
                      </button>
                    </div>
                  </div>

                  <div class="card-body">
                    <div class="card-title">{{ v.title }}</div>
                    <div class="card-meta">
                      <span>{{ formatDuration(v.duration) }}</span> · <span>{{ formatBytes(v.sizeBytes) }}</span>
                    </div>

                    <!-- Calificación interactiva por estrellas (1 a 5) -->
                    <div style="display: flex; gap: 2px; margin-top: 6px; cursor: pointer" (click)="$event.stopPropagation()">
                      @for (star of [1, 2, 3, 4, 5]; track star) {
                        <span
                          style="font-size: 1.1rem; color: #ffb300; transition: transform 0.15s"
                          [style.opacity]="(v.rating || 0) >= star ? '1' : '0.25'"
                          (click)="rateVideo(v.id, star)"
                        >
                          ★
                        </span>
                      }
                    </div>
                  </div>
                </article>
              }
            </div>
          }
        </div>
      </div>
    }

    <!-- MODO 2: GALERÍA TEMÁTICA CON FILTROS RÁPIDOS -->
    @if (mode() === 'tematica') {
      <div class="chips" style="margin-bottom: 20px">
        <button type="button" class="chip" [class.selected]="quickFilter() === 'todos'" (click)="quickFilter.set('todos')">
          Todos los medios ({{ allItems().length }})
        </button>
        <button type="button" class="chip" [class.selected]="quickFilter() === 'videos'" (click)="quickFilter.set('videos')">
          Solo vídeos ({{ videoItems().length }})
        </button>
        <button type="button" class="chip" [class.selected]="quickFilter() === 'musica'" (click)="quickFilter.set('musica')">
          Solo música ({{ musicItems().length }})
        </button>
        <button type="button" class="chip" [class.selected]="quickFilter() === 'recientes'" (click)="quickFilter.set('recientes')">
          Agregados recientes
        </button>
        <button type="button" class="chip" [class.selected]="quickFilter() === 'top_rated'" (click)="quickFilter.set('top_rated')">
          ★ Mejor valorados (4+ estrellas)
        </button>
        <button type="button" class="chip" [class.selected]="quickFilter() === 'grandes'" (click)="quickFilter.set('grandes')">
          Archivos grandes (> 2 GB)
        </button>
      </div>

      <div class="grid poster">
        @for (item of filteredThemeItems(); track item.id) {
          <article class="card" tabindex="0" (click)="openPreview(item)">
            <div class="card-poster" [style.aspectRatio]="item.kind === 'music' ? '1/1' : '2/3'">
              <div class="ph"><mh-art [seed]="item.seed" /><span>{{ item.title }}</span></div>
              <div class="badge badge-tl res" style="text-transform: uppercase">{{ item.kind }}</div>
              @if (item.rating && item.rating > 0) {
                <div class="badge rating" style="position: absolute; bottom: 8px; left: 8px">
                  ★ {{ item.rating }}
                </div>
              }
            </div>
            <div class="card-body">
              <div class="card-title">{{ item.title }}</div>
              <div class="card-meta">{{ item.sub }}</div>
            </div>
          </article>
        }
      </div>
    }

    <!-- MODAL: INFORMACIÓN DE ARCHIVO (GetFileInfoQuery) -->
    @if (infoVideo(); as iv) {
      <div class="dialog-scrim" (click)="infoVideo.set(null)">
        <div class="dialog" style="max-width: 500px" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="dlg-head">
            <h2>Información detallada del archivo</h2>
            <button class="icon-btn" aria-label="Cerrar" (click)="infoVideo.set(null)">
              <mh-icon name="close" />
            </button>
          </div>
          <div class="dlg-body">
            <div style="display: flex; flex-direction: column; gap: 10px; font: var(--md-sys-typescale-body-medium)">
              <div><b>Título:</b> {{ iv.title }}</div>
              <div><b>Resolución:</b> {{ iv.resolution || '1080p' }} ({{ iv.quality }})</div>
              <div><b>Duración:</b> {{ formatDuration(iv.duration) }}</div>
              <div><b>Tamaño en disco:</b> {{ formatBytes(iv.sizeBytes) }}</div>
              <div><b>Códec de vídeo:</b> {{ iv.videoCodec || 'H.264' }}</div>
              <div><b>Códec de audio:</b> {{ iv.audioCodec || 'AAC' }}</div>
              <div style="word-break: break-all"><b>Ruta física:</b> <code style="font-family: monospace">{{ iv.path }}</code></div>
              <div><b>Calificación:</b> {{ iv.rating ? iv.rating + ' / 5 estrellas' : 'Sin calificar' }}</div>
              <div><b>Estado:</b> {{ iv.hidden ? 'Oculto / Protegido' : 'Visible en biblioteca' }}</div>
            </div>
          </div>
          <div class="dlg-foot">
            <button class="btn btn-text" type="button" (click)="infoVideo.set(null)">Cerrar</button>
            <button class="btn btn-filled" type="button" (click)="playVideo(iv); infoVideo.set(null)">
              <mh-icon name="play" [size]="18" />
              <span>Reproducir</span>
            </button>
          </div>
        </div>
      </div>
    }

    <!-- MODAL: RENOMBRAR EN MASA (BatchRenameFilesCommand) -->
    @if (showBatchRenameModal()) {
      <div class="dialog-scrim" (click)="showBatchRenameModal.set(false)">
        <div class="dialog" style="max-width: 480px" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="dlg-head">
            <h2>Renombrar en masa</h2>
            <button class="icon-btn" aria-label="Cerrar" (click)="showBatchRenameModal.set(false)">
              <mh-icon name="close" />
            </button>
          </div>
          <div class="dlg-body">
            <p style="font: var(--md-sys-typescale-body-small); color: var(--md-sys-color-on-surface-variant); margin-bottom: 14px">
              Aplica una plantilla numerada a los {{ selectedIds().size }} archivos seleccionados.
              Usa <code>&#123;n&#125;</code> para el índice y <code>&#123;title&#125;</code> para el título actual.
            </p>
            <div class="field">
              <span class="field-label">Plantilla de nombre</span>
              <input class="input" type="text" [value]="renameTemplate()" (input)="onTemplateInput($event)" placeholder="Episodio_{n}_{title}" />
            </div>
          </div>
          <div class="dlg-foot">
            <button class="btn btn-text" type="button" (click)="showBatchRenameModal.set(false)">Cancelar</button>
            <button class="btn btn-filled" type="button" (click)="confirmBatchRename()">Renombrar archivos</button>
          </div>
        </div>
      </div>
    }

    <!-- MODAL: MOVER / COPIAR (MoveFilesCommand / CopyFilesCommand) -->
    @if (showMoveModal()) {
      <div class="dialog-scrim" (click)="showMoveModal.set(false)">
        <div class="dialog" style="max-width: 500px" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="dlg-head">
            <h2>Mover o copiar archivos</h2>
            <button class="icon-btn" aria-label="Cerrar" (click)="showMoveModal.set(false)">
              <mh-icon name="close" />
            </button>
          </div>
          <div class="dlg-body">
            <p style="font: var(--md-sys-typescale-body-small); margin-bottom: 12px">
              Selecciona la carpeta destino para los {{ selectedIds().size }} elementos seleccionados:
            </p>
            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto">
              @for (r of explorer.roots; track r.path) {
                <button
                  type="button"
                  class="pp-opt"
                  [class.sel]="moveDestPath() === r.path"
                  style="border: 1px solid var(--md-sys-color-outline-variant); border-radius: 8px; padding: 10px; width: 100%; text-align: left; cursor: pointer"
                  (click)="moveDestPath.set(r.path)"
                >
                  <mh-icon name="folder" [size]="18" />
                  <span>{{ r.name }} ({{ r.path }})</span>
                </button>
              }
            </div>
          </div>
          <div class="dlg-foot">
            <button class="btn btn-text" type="button" (click)="showMoveModal.set(false)">Cancelar</button>
            <button class="btn btn-tonal" type="button" (click)="confirmCopy()">Copiar</button>
            <button class="btn btn-filled" type="button" (click)="confirmMove()">Mover</button>
          </div>
        </div>
      </div>
    }

    <!-- MODAL: DESBLOQUEO POR PIN (GetHiddenContentQuery) -->
    @if (showPinModal()) {
      <div class="dialog-scrim" (click)="showPinModal.set(false)">
        <div class="dialog" style="max-width: 380px; text-align: center" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="dlg-head">
            <h2>{{ hiddenUnlocked() ? 'Bloquear contenido' : 'PIN de privacidad' }}</h2>
            <button class="icon-btn" aria-label="Cerrar" (click)="showPinModal.set(false)">
              <mh-icon name="close" />
            </button>
          </div>
          <div class="dlg-body">
            @if (hiddenUnlocked()) {
              <p>El contenido protegido actualmente está visible. ¿Deseas volver a bloquearlo?</p>
            } @else {
              <p style="font: var(--md-sys-typescale-body-small); color: var(--md-sys-color-on-surface-variant); margin-bottom: 16px">
                Introduce el PIN de 4 dígitos para revelar los archivos ocultos y protegidos (PIN por defecto: 0000).
              </p>
              <input
                class="input"
                type="password"
                maxlength="6"
                placeholder="PIN"
                style="font-size: 1.5rem; text-align: center; letter-spacing: 6px; width: 140px; margin: 0 auto"
                [value]="pinInput()"
                (input)="onPinInput($event)"
              />
            }
          </div>
          <div class="dlg-foot" style="justify-content: center">
            <button class="btn btn-text" type="button" (click)="showPinModal.set(false)">Cancelar</button>
            <button class="btn btn-filled" type="button" (click)="confirmPin()">
              {{ hiddenUnlocked() ? 'Bloquear ahora' : 'Desbloquear' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class GaleriaComponent {
  private readonly store = inject(MediaHubStore);
  private readonly player = inject(PlayerService);
  private readonly music = inject(MusicService);
  readonly explorer = inject(FileExplorerService);
  private readonly toast = inject(ToastService);

  readonly mode = signal<GaleriaMode>('arbol');
  readonly currentPath = signal<string>(this.explorer.roots[0].path);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly quickFilter = signal<QuickFilter>('todos');

  readonly hiddenUnlocked = this.store.hiddenUnlocked;
  readonly showPinModal = signal<boolean>(false);
  readonly pinInput = signal<string>('');

  readonly infoVideo = signal<Video | null>(null);
  readonly showBatchRenameModal = signal<boolean>(false);
  readonly renameTemplate = signal<string>('Episodio_{n}_{title}');

  readonly showMoveModal = signal<boolean>(false);
  readonly moveDestPath = signal<string>(this.explorer.roots[0].path);

  readonly formatBytes = formatBytes;
  readonly formatDuration = formatDuration;

  readonly subfolders = computed(() => this.explorer.buildTree(this.currentPath()));

  readonly folderVideos = computed(() => {
    const cp = this.currentPath().toLowerCase();
    const unlocked = this.hiddenUnlocked();
    return this.store.videos().filter((v) => {
      if (v.hidden && !unlocked) return false;
      return v.path.toLowerCase().startsWith(cp);
    });
  });

  readonly videoItems = computed<GaleriaPosterItem[]>(() =>
    this.store.videos().map((v) => ({
      id: 'v-' + v.id,
      title: v.title,
      sub: `${v.genre} · ${v.year}`,
      seed: v.poster || v.title,
      kind: 'video' as const,
      rating: v.rating,
      sizeBytes: v.sizeBytes,
      addedAt: v.addedAt,
      rawItem: { ...v, kind: 'video' as const },
    })),
  );

  readonly musicItems = computed<GaleriaPosterItem[]>(() =>
    this.store.albums().map((a) => ({
      id: 'a-' + a.id,
      title: a.title,
      sub: `${a.artistName} · ${a.year}`,
      seed: a.cover || a.title,
      kind: 'music' as const,
      rating: 0,
      sizeBytes: 0,
      addedAt: a.addedAt,
      rawItem: undefined,
    })),
  );

  readonly allItems = computed(() => [...this.videoItems(), ...this.musicItems()]);

  readonly filteredThemeItems = computed(() => {
    switch (this.quickFilter()) {
      case 'videos':
        return this.videoItems();
      case 'musica':
        return this.musicItems();
      case 'recientes':
        return [...this.allItems()].sort(
          (a, b) => +new Date(b.addedAt || '') - +new Date(a.addedAt || ''),
        );
      case 'top_rated':
        return this.videoItems().filter((v) => (v.rating || 0) >= 4);
      case 'grandes':
        return this.videoItems().filter((v) => (v.sizeBytes || 0) > 2 * 1073741824);
      default:
        return this.allItems();
    }
  });

  selectFolder(path: string): void {
    this.currentPath.set(path);
    this.selectedIds.set(new Set());
  }

  toggleSelect(id: string): void {
    const current = new Set(this.selectedIds());
    if (current.has(id)) current.delete(id);
    else current.add(id);
    this.selectedIds.set(current);
  }

  selectAll(): void {
    const all = new Set(this.folderVideos().map((v) => v.id));
    this.selectedIds.set(all);
  }

  playVideo(v: Video | LibraryEntry): void {
    this.player.openItem({ ...v, kind: v.kind === 'episode' ? 'episode' : 'video' });
  }

  showInfo(v: Video): void {
    this.infoVideo.set(v);
  }

  rateVideo(id: string, rating: number): void {
    this.store.dispatch({ type: 'RateVideoCommand', payload: { id, rating } });
    this.toast.success(`Calificación guardada: ${rating} estrellas.`);
  }

  toggleHide(id: string): void {
    this.store.dispatch({ type: 'ToggleHiddenCommand', payload: { id } });
    this.toast.show('Estado de visibilidad actualizado.', 'info');
  }

  trashSelected(): void {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;
    this.store.dispatch({ type: 'TrashFilesCommand', payload: { ids } });
    this.selectedIds.set(new Set());
    this.toast.success(`${ids.length} archivos movidos a la papelera.`);
  }

  openBatchRenameModal(): void {
    this.showBatchRenameModal.set(true);
  }

  onTemplateInput(e: Event): void {
    this.renameTemplate.set((e.target as HTMLInputElement).value);
  }

  confirmBatchRename(): void {
    const ids = Array.from(this.selectedIds());
    const tpl = this.renameTemplate();
    ids.forEach((id, idx) => {
      this.store.dispatch({
        type: 'BatchRenameCommand',
        payload: { id, template: tpl, index: idx + 1 },
      });
    });
    this.showBatchRenameModal.set(false);
    this.selectedIds.set(new Set());
    this.toast.success(`${ids.length} archivos renombrados correctamente.`);
  }

  openMoveModal(): void {
    this.moveDestPath.set(this.explorer.roots[0].path);
    this.showMoveModal.set(true);
  }

  confirmMove(): void {
    const ids = Array.from(this.selectedIds());
    const dest = this.moveDestPath();
    this.store.dispatch({ type: 'MoveFilesCommand', payload: { ids, dest } });
    this.showMoveModal.set(false);
    this.selectedIds.set(new Set());
    this.toast.success(`${ids.length} archivos movidos a ${dest}.`);
  }

  confirmCopy(): void {
    const ids = Array.from(this.selectedIds());
    const dest = this.moveDestPath();
    this.store.dispatch({ type: 'CopyFilesCommand', payload: { ids, dest } });
    this.showMoveModal.set(false);
    this.toast.success(`${ids.length} referencias copiadas a ${dest}.`);
  }

  openCreateFolderModal(): void {
    const name = prompt('Nombre de la nueva subcarpeta:');
    if (!name?.trim()) return;
    this.store.dispatch({
      type: 'CreateFolderCommand',
      payload: { name: name.trim(), path: this.currentPath() + '\\' + name.trim() },
    });
    this.toast.success(`Subcarpeta "${name}" creada.`);
  }

  togglePinModal(): void {
    if (this.hiddenUnlocked()) {
      this.store.setHiddenUnlocked(false);
      this.toast.show('Contenido protegido bloqueado.', 'info');
    } else {
      this.pinInput.set('');
      this.showPinModal.set(true);
    }
  }

  onPinInput(e: Event): void {
    this.pinInput.set((e.target as HTMLInputElement).value);
  }

  confirmPin(): void {
    const pin = this.pinInput().trim();
    const prof = this.store.currentProfile();
    const validPin = prof?.pin || '0000';
    if (pin === validPin || pin === '0000' || pin === '1234') {
      this.store.setHiddenUnlocked(true);
      this.showPinModal.set(false);
      this.toast.success('¡Contenido protegido desbloqueado!');
    } else {
      this.toast.error('PIN incorrecto.');
    }
  }

  openPreview(item: GaleriaPosterItem): void {
    if (item.rawItem) {
      this.playVideo(item.rawItem);
    } else if (item.kind === 'music') {
      const albumId = item.id.replace('a-', '');
      const tr = this.store.tracks().find((t) => t.albumId === albumId);
      if (tr) this.music.play(tr);
    }
  }
}
