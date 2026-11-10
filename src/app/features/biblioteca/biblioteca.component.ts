import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MediaHubStore } from '../../core/store/mediahub.store';
import { DialogService } from '../../core/services/dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { FileExplorerDialogComponent } from '../../shared/file-explorer-dialog.component';
import { IconComponent } from '../../shared/icon.component';
import { DuplicateFile, IgnoredFile, LibraryFolder, TrashEntry } from '../../core/models';
import { formatBytes } from '../../core/util/format';

type BibTab = 'carpetas' | 'duplicados' | 'ignorados' | 'papelera';

@Component({
  selector: 'mh-biblioteca',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">Gestión de biblioteca</h1>
        <p class="page-sub">Carpetas supervisadas, almacenamiento local, duplicados y papelera</p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-outlined" type="button" (click)="scanAll()">
          <mh-icon name="refresh-cw" [size]="18" />
          <span>Escanear todo</span>
        </button>
        <button class="btn btn-filled" type="button" (click)="addFolder()">
          <mh-icon name="folder-plus" [size]="18" />
          <span>Añadir carpeta</span>
        </button>
      </div>
    </div>

    <!-- Medidor de almacenamiento -->
    <div style="background: var(--md-sys-color-surface-container-low); border-radius: 16px; padding: 20px; margin-bottom: 24px">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
        <span style="font: var(--md-sys-typescale-title-small)">Almacenamiento del servidor local</span>
        <span style="font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant)">
          {{ formatBytes(storageUsed()) }} de {{ formatBytes(storageTotal()) }} ({{ storagePercent() }}%)
        </span>
      </div>
      <div class="meter" style="height: 10px">
        <div class="meter-fill" [style.width.%]="storagePercent()"></div>
      </div>
    </div>

    <!-- Pestañas -->
    <div class="chips" style="margin-bottom: 20px">
      <button type="button" class="chip" [class.selected]="tab() === 'carpetas'" (click)="tab.set('carpetas')">
        <mh-icon name="folder" [size]="16" />
        <span>Carpetas ({{ folders().length }})</span>
      </button>
      <button type="button" class="chip" [class.selected]="tab() === 'duplicados'" (click)="tab.set('duplicados')">
        <mh-icon name="copy" [size]="16" />
        <span>Duplicados ({{ duplicates().length }})</span>
      </button>
      <button type="button" class="chip" [class.selected]="tab() === 'ignorados'" (click)="tab.set('ignorados')">
        <mh-icon name="eye-off" [size]="16" />
        <span>Ignorados ({{ ignored().length }})</span>
      </button>
      <button type="button" class="chip" [class.selected]="tab() === 'papelera'" (click)="tab.set('papelera')">
        <mh-icon name="trash" [size]="16" />
        <span>Papelera ({{ trash().length }})</span>
      </button>
    </div>

    <!-- CARPETAS -->
    @if (tab() === 'carpetas') {
      <div style="background: var(--md-sys-color-surface-container-low); border-radius: 16px; overflow: hidden">
        <table class="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Ruta física</th>
              <th>Ámbito</th>
              <th>Archivos</th>
              <th>Tamaño</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (f of folders(); track f.id) {
              <tr>
                <td><b>{{ f.name }}</b></td>
                <td style="font-family: monospace; font-size: 0.85rem">{{ f.path }}</td>
                <td><span class="badge res">{{ f.scope }}</span></td>
                <td>{{ f.files }}</td>
                <td>{{ formatBytes(f.sizeBytes) }}</td>
                <td>
                  <div style="display: flex; gap: 4px">
                    <button class="icon-btn" type="button" title="Escanear carpeta" (click)="scanFolder(f.id)">
                      <mh-icon name="refresh-cw" [size]="16" />
                    </button>
                    <button class="icon-btn" type="button" title="Eliminar de biblioteca" (click)="removeFolder(f.id)">
                      <mh-icon name="trash" [size]="16" />
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <!-- DUPLICADOS -->
    @if (tab() === 'duplicados') {
      @if (duplicates().length === 0) {
        <div class="empty-state" style="padding: 48px; text-align: center; color: var(--md-sys-color-on-surface-variant)">
          <mh-icon name="check-circle" [size]="48" />
          <p style="margin-top: 12px">No se han detectado archivos duplicados en la biblioteca.</p>
        </div>
      } @else {
        <div style="background: var(--md-sys-color-surface-container-low); border-radius: 16px; overflow: hidden">
          <table class="table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Ruta</th>
                <th>Tamaño</th>
                <th>Copias</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              @for (d of duplicates(); track d.id) {
                <tr>
                  <td><b>{{ d.name }}</b></td>
                  <td style="font-family: monospace; font-size: 0.85rem">{{ d.path }}</td>
                  <td>{{ d.size }}</td>
                  <td><span class="badge res">{{ d.copies }} copias</span></td>
                  <td>
                    <button class="btn btn-tonal" type="button" (click)="resolveDuplicate(d.id)">
                      Resolver
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }

    <!-- IGNORADOS -->
    @if (tab() === 'ignorados') {
      @if (ignored().length === 0) {
        <div class="empty-state" style="padding: 48px; text-align: center; color: var(--md-sys-color-on-surface-variant)">
          <mh-icon name="check" [size]="48" />
          <p style="margin-top: 12px">No hay archivos en la lista de exclusiones.</p>
        </div>
      } @else {
        <div style="background: var(--md-sys-color-surface-container-low); border-radius: 16px; overflow: hidden">
          <table class="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Ruta</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              @for (ig of ignored(); track ig.id) {
                <tr>
                  <td><b>{{ ig.name }}</b></td>
                  <td style="font-family: monospace; font-size: 0.85rem">{{ ig.path }}</td>
                  <td><span class="badge warn">{{ ig.reason }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }

    <!-- PAPELERA -->
    @if (tab() === 'papelera') {
      @if (trash().length === 0) {
        <div class="empty-state" style="padding: 48px; text-align: center; color: var(--md-sys-color-on-surface-variant)">
          <mh-icon name="trash" [size]="48" />
          <p style="margin-top: 12px">La papelera está vacía.</p>
        </div>
      } @else {
        <div style="background: var(--md-sys-color-surface-container-low); border-radius: 16px; overflow: hidden">
          <table class="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Ruta original</th>
                <th>Fecha eliminado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (t of trash(); track t.id) {
                <tr>
                  <td><b>{{ t.name }}</b></td>
                  <td style="font-family: monospace; font-size: 0.85rem">{{ t.path }}</td>
                  <td>{{ t.at }}</td>
                  <td>
                    <div style="display: flex; gap: 6px">
                      <button class="btn btn-outlined" type="button" (click)="restoreTrash(t.id)">Restaurar</button>
                      <button class="btn btn-danger" type="button" (click)="deleteTrash(t.id)">Eliminar</button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }
  `,
})
export class BibliotecaComponent {
  private readonly store = inject(MediaHubStore);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly tab = signal<BibTab>('carpetas');

  readonly folders = computed(() => this.store.folders());
  readonly duplicates = computed(() => this.store.duplicates());
  readonly ignored = computed(() => this.store.ignored());
  readonly trash = computed(() => this.store.trash());
  readonly storageUsed = computed(() => this.store.storageUsed());
  readonly storageTotal = computed(() => this.store.storageTotal());
  readonly storagePercent = computed(() => this.store.storagePercent());

  readonly formatBytes = formatBytes;

  scanAll(): void {
    this.toast.show('Escaneo general iniciado en segundo plano...', 'info');
    setTimeout(() => {
      this.toast.success('Escaneo de biblioteca completado.');
    }, 1200);
  }

  scanFolder(id: string): void {
    this.store.dispatch({ type: 'ScanLibraryCommand', payload: id });
    this.toast.success('Carpeta escaneada correctamente.');
  }

  removeFolder(id: string): void {
    this.store.dispatch({ type: 'RemoveFolderCommand', payload: id });
    this.toast.show('Carpeta desvinculada de la biblioteca.', 'info');
  }

  addFolder(): void {
    this.dialogs.open(FileExplorerDialogComponent, {
      kind: 'video',
      title: 'Añadir carpeta a biblioteca',
      multiple: false,
    });
  }

  resolveDuplicate(id: string): void {
    this.store.dispatch({ type: 'ResolveDuplicateCommand', payload: id });
    this.toast.success('Duplicado resuelto.');
  }

  restoreTrash(id: string): void {
    this.store.dispatch({ type: 'RestoreFileCommand', payload: id });
    this.toast.success('Elemento restaurado a la biblioteca.');
  }

  deleteTrash(id: string): void {
    this.store.dispatch({ type: 'DeletePermanentCommand', payload: id });
    this.toast.show('Elemento eliminado definitivamente.', 'info');
  }
}
