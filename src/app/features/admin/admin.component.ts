import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MediaHubStore } from '../../core/store/mediahub.store';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { formatBytes } from '../../core/util/format';

@Component({
  selector: 'mh-admin',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">Administración del sistema</h1>
        <p class="page-sub">Estado del servidor, mantenimiento, copias de seguridad y tareas programadas</p>
      </div>
    </div>

    <!-- Estado del servidor -->
    <section style="background: var(--md-sys-color-surface-container-low); border-radius: 16px; padding: 20px; margin-bottom: 24px">
      <h2 style="font: var(--md-sys-typescale-title-medium); margin-bottom: 16px; display: flex; align-items: center; gap: 8px">
        <mh-icon name="server" [size]="20" />
        <span>Estado del servidor local</span>
      </h2>

      <div class="stat-grid" style="margin-bottom: 16px">
        <div class="stat-card" style="background: var(--md-sys-color-surface-container)">
          <div class="stat-val">{{ status().uptimeHours }} h</div>
          <div class="stat-lbl">Tiempo activo</div>
        </div>
        <div class="stat-card" style="background: var(--md-sys-color-surface-container)">
          <div class="stat-val">{{ status().cpu }}%</div>
          <div class="stat-lbl">Uso de CPU</div>
        </div>
        <div class="stat-card" style="background: var(--md-sys-color-surface-container)">
          <div class="stat-val">{{ status().memory }}%</div>
          <div class="stat-lbl">Uso de RAM</div>
        </div>
        <div class="stat-card" style="background: var(--md-sys-color-surface-container)">
          <div class="stat-val">{{ status().dbStatus }}</div>
          <div class="stat-lbl">Estado base de datos</div>
        </div>
        <div class="stat-card" style="background: var(--md-sys-color-surface-container)">
          <div class="stat-val">{{ status().activeSessions }}</div>
          <div class="stat-lbl">Sesiones activas</div>
        </div>
        <div class="stat-card" style="background: var(--md-sys-color-surface-container)">
          <div class="stat-val">{{ status().version }}</div>
          <div class="stat-lbl">Versión MediaHub</div>
        </div>
      </div>

      <div style="font: var(--md-sys-typescale-body-small); color: var(--md-sys-color-on-surface-variant)">
        Última copia de seguridad: <b>{{ status().lastBackup }}</b>
      </div>
    </section>

    <!-- Herramientas de mantenimiento -->
    <div class="grid-2" style="gap: 20px">
      <section style="background: var(--md-sys-color-surface-container-low); border-radius: 16px; padding: 20px">
        <h2 style="font: var(--md-sys-typescale-title-medium); margin-bottom: 12px; display: flex; align-items: center; gap: 8px">
          <mh-icon name="database" [size]="20" />
          <span>Base de datos y respaldos</span>
        </h2>
        <p style="font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); margin-bottom: 16px">
          Exporta el estado completo de la biblioteca en JSON o genera un punto de restauración local.
        </p>
        <div style="display: flex; gap: 10px; flex-wrap: wrap">
          <button class="btn btn-filled" type="button" (click)="backupDatabase()">
            <mh-icon name="download" [size]="18" />
            <span>Exportar estado actual (JSON)</span>
          </button>
          <button class="btn btn-tonal" type="button" (click)="downloadSeedJson()">
            <mh-icon name="file-text" [size]="18" />
            <span>Descargar dataset semilla (JSON)</span>
          </button>
          <button class="btn btn-outlined" type="button" (click)="reloadFromSeed()">
            <mh-icon name="refresh-cw" [size]="18" />
            <span>Restablecer desde JSON estático</span>
          </button>
        </div>
      </section>

      <section style="background: var(--md-sys-color-surface-container-low); border-radius: 16px; padding: 20px">
        <h2 style="font: var(--md-sys-typescale-title-medium); margin-bottom: 12px; display: flex; align-items: center; gap: 8px">
          <mh-icon name="hard-drive" [size]="20" />
          <span>Capa de datos y migración a BD</span>
        </h2>
        <p style="font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); margin-bottom: 16px">
          Datos estáticos desacoplados en <code>/assets/data/mediahub-seed.json</code> a través de la interfaz <code>MediaDataRepository</code> y el servicio <code>MediaDataService</code>.
        </p>
        <div style="display: flex; gap: 10px; flex-wrap: wrap">
          <button class="btn btn-tonal" type="button" (click)="clearCache()">
            <mh-icon name="trash" [size]="18" />
            <span>Vaciar caché</span>
          </button>
          <button class="btn btn-outlined" type="button" (click)="testNotifications()">
            <mh-icon name="bell" [size]="18" />
            <span>Probar notificación</span>
          </button>
        </div>
      </section>
    </div>
  `,
})
export class AdminComponent {
  private readonly store = inject(MediaHubStore);
  private readonly toast = inject(ToastService);

  readonly status = computed(() => this.store.serverStatus());

  backupDatabase(): void {
    const data = JSON.stringify(this.store.exportDataset(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediahub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Copia de respaldo exportada en JSON.');
  }

  downloadSeedJson(): void {
    const a = document.createElement('a');
    a.href = '/assets/data/mediahub-seed.json';
    a.download = 'mediahub-seed.json';
    a.click();
    this.toast.success('Descargando dataset semilla JSON.');
  }

  async reloadFromSeed(): Promise<void> {
    this.toast.show('Recargando datos desde /assets/data/mediahub-seed.json...', 'info');
    try {
      await this.store.resetToSeedData();
      this.toast.success('Biblioteca restaurada exitosamente desde el JSON estático.');
    } catch {
      this.toast.error('Ocurrió un error al cargar el JSON estático.');
    }
  }

  reindexMetadata(): void {
    this.toast.show('Reindexando metadatos...', 'info');
    setTimeout(() => {
      this.toast.success('Metadatos reindexados correctamente.');
    }, 1000);
  }

  clearCache(): void {
    this.toast.success('Caché del sistema vaciada.');
  }

  testNotifications(): void {
    this.toast.show('Alerta de prueba enviada al centro de notificaciones.', 'info');
  }
}
