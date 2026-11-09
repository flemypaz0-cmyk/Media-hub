import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DialogService } from '../core/services/dialog.service';
import { ExplorerFile, ExplorerKind, FileExplorerService } from '../core/services/file-explorer.service';
import { IconComponent } from './icon.component';
import { formatBytes } from '../core/util/format';

export interface ExplorerResult {
  path: string;
  name: string;
  size: number;
}

/**
 * Explorador de archivos reutilizable.
 *
 * La app NO copia ni mueve archivos: este diálogo solo captura la ruta
 * original del archivo seleccionado para registrarla en la biblioteca.
 */
@Component({
  selector: 'mh-file-explorer-dialog',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-scrim" (click)="close()">
      <div class="dialog wide" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <div class="dlg-head">
          <h2>{{ title() }} — {{ explorer.labelFor(kind()) }}</h2>
          <button class="icon-btn" aria-label="Cerrar" (click)="close()"><mh-icon name="close" /></button>
        </div>
        <div class="dlg-body">
          <div class="explorer">
            <div class="ex-tree">
              @for (root of explorer.roots; track root.path) {
                <button type="button" [class.sel]="currentPath() === root.path" (click)="select(root.path)">
                  <mh-icon name="folder" [size]="18" />
                  <span>{{ root.name }}</span>
                </button>
                @for (child of childrenOf(root.path); track child.path) {
                  <button type="button" [style.padding-left.px]="24" [class.sel]="currentPath() === child.path" (click)="select(child.path)">
                    <mh-icon name="folder" [size]="18" />
                    <span>{{ child.name }}</span>
                  </button>
                  @for (leaf of childrenOf(child.path); track leaf.path) {
                    <button type="button" [style.padding-left.px]="38" [class.sel]="currentPath() === leaf.path" (click)="select(leaf.path)">
                      <mh-icon name="folder" [size]="18" />
                      <span>{{ leaf.name }}</span>
                    </button>
                  }
                }
              }
            </div>
            <div>
              <div class="hint" style="margin-bottom: 8px">{{ currentPath() }}</div>
              <div class="ex-files">
                @for (file of files(); track file.path) {
                  <button type="button" class="ex-file" [class.sel]="isPicked(file.path)" (click)="toggle(file)">
                    <span class="ex-thumb" [style.background]="'linear-gradient(135deg,#4f5bd5,#8b5cf6)'">
                      <mh-icon [name]="kind() === 'subtitle' ? 'subtitle' : kind() === 'audio' ? 'music' : 'film'" [size]="26" />
                    </span>
                    <span class="ex-name">{{ file.name }}</span>
                    <span class="ex-name sub">{{ file.kind === 'folder' ? 'carpeta' : formatBytes(file.size) }}</span>
                  </button>
                }
              </div>
            </div>
          </div>
        </div>
        <div class="dlg-foot">
          <span class="hint" style="margin-right: auto">
            Solo se registra la ruta original: la app nunca copia ni mueve el archivo.
          </span>
          <button class="btn btn-text" type="button" (click)="close()">Cancelar</button>
          <button class="btn btn-filled" type="button" (click)="confirm()">
            {{ multiple() ? 'Agregar (' + picked().size + ')' : 'Seleccionar' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class FileExplorerDialogComponent {
  readonly data = input.required<{
    kind?: ExplorerKind;
    title?: string;
    multiple?: boolean;
  }>();

  readonly explorer = inject(FileExplorerService);
  private readonly dialogs = inject(DialogService);

  readonly currentPath = signal(this.explorer.roots[0].path);
  readonly picked = signal<Record<string, ExplorerFile>>({});

  readonly kind = computed<ExplorerKind>(() => this.data().kind ?? 'video');
  readonly multiple = computed(() => !!this.data().multiple);
  readonly title = computed(() => this.data().title ?? 'Explorar');

  readonly childrenOf = (path: string) => this.explorer.buildTree(path);
  readonly files = computed(() => this.explorer.fileListFor(this.currentPath(), this.kind()));
  readonly isPicked = (path: string) => !!this.picked()[path];

  select(path: string): void {
    this.currentPath.set(path);
  }

  toggle(file: ExplorerFile): void {
    const current = { ...this.picked() };
    if (current[file.path]) {
      delete current[file.path];
    } else {
      if (!this.multiple()) {
        Object.keys(current).forEach((k) => delete current[k]);
      }
      current[file.path] = file;
    }
    this.picked.set(current);
  }

  confirm(): void {
    const files = Object.values(this.picked());
    if (!files.length) return;
    const result: ExplorerResult[] = files.map((f) => ({ path: f.path, name: f.name, size: f.size }));
    this.dialogs.closeTop(result);
  }

  close(): void {
    this.dialogs.closeTop();
  }

  readonly formatBytes = formatBytes;
}
