import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MediaHubStore } from '../../core/store/mediahub.store';
import { IconComponent } from '../../shared/icon.component';
import { formatBytes, formatDuration } from '../../core/util/format';

@Component({
  selector: 'mh-estadisticas',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">Estadísticas de la biblioteca</h1>
        <p class="page-sub">Métricas de almacenamiento, contenido y reproducción</p>
      </div>
    </div>

    <!-- Tarjetas principales -->
    <div class="stat-grid" style="margin-bottom: 28px">
      <div class="stat-card">
        <div class="stat-val">{{ totalVideos() }}</div>
        <div class="stat-lbl">Películas y vídeos</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">{{ totalSeries() }}</div>
        <div class="stat-lbl">Series ({{ totalEpisodes() }} episodios)</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">{{ totalTracks() }}</div>
        <div class="stat-lbl">Pistas de música</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">{{ watchedPercent() }}%</div>
        <div class="stat-lbl">Contenido visto</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">{{ storageUsed() }}</div>
        <div class="stat-lbl">Espacio ocupado ({{ storagePercent() }}%)</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">{{ totalHours() }}h</div>
        <div class="stat-lbl">Horas totales de contenido</div>
      </div>
    </div>

    <div class="grid-2" style="gap: 24px">
      <!-- Distribución por género -->
      <section style="background: var(--md-sys-color-surface-container-low); border-radius: 16px; padding: 20px;">
        <h2 style="font: var(--md-sys-typescale-title-medium); margin-bottom: 16px; display: flex; align-items: center; gap: 8px">
          <mh-icon name="tag" [size]="20" />
          <span>Distribución por géneros</span>
        </h2>
        <div style="display: flex; flex-direction: column; gap: 12px">
          @for (g of topGenres(); track g.name) {
            <div>
              <div style="display: flex; justify-content: space-between; font: var(--md-sys-typescale-body-small); margin-bottom: 4px">
                <span>{{ g.name }}</span>
                <span>{{ g.count }} títulos</span>
              </div>
              <div class="meter">
                <div class="meter-fill" [style.width.%]="g.percent"></div>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Calidades y códecs -->
      <section style="background: var(--md-sys-color-surface-container-low); border-radius: 16px; padding: 20px;">
        <h2 style="font: var(--md-sys-typescale-title-medium); margin-bottom: 16px; display: flex; align-items: center; gap: 8px">
          <mh-icon name="film" [size]="20" />
          <span>Calidad y resolución</span>
        </h2>
        <div style="display: flex; flex-direction: column; gap: 12px">
          @for (q of qualities(); track q.name) {
            <div>
              <div style="display: flex; justify-content: space-between; font: var(--md-sys-typescale-body-small); margin-bottom: 4px">
                <span>{{ q.name }}</span>
                <span>{{ q.count }} vídeos</span>
              </div>
              <div class="meter">
                <div class="meter-fill" [style.width.%]="q.percent" style="background: var(--md-sys-color-secondary)"></div>
              </div>
            </div>
          }
        </div>
      </section>
    </div>
  `,
})
export class EstadisticasComponent {
  private readonly store = inject(MediaHubStore);

  readonly totalVideos = computed(() => this.store.videoCount());
  readonly totalSeries = computed(() => this.store.series().length);
  readonly totalEpisodes = computed(() => this.store.episodeCount());
  readonly totalTracks = computed(() => this.store.tracks().length);
  readonly watchedCount = computed(() => this.store.watchedCount());
  readonly entryCount = computed(() => this.store.entryCount());

  readonly watchedPercent = computed(() => {
    const total = this.entryCount();
    return total > 0 ? Math.round((this.watchedCount() / total) * 100) : 0;
  });

  readonly storageUsed = computed(() => formatBytes(this.store.storageUsed()));
  readonly storagePercent = computed(() => this.store.storagePercent());

  readonly totalHours = computed(() => {
    const secs = this.store.totalDuration();
    return Math.round(secs / 3600);
  });

  readonly topGenres = computed(() => {
    const counts: Record<string, number> = {};
    this.store.allEntries().forEach((e) => {
      const g = e.genre || 'Sin clasificar';
      counts[g] = (counts[g] || 0) + 1;
    });
    const total = this.store.allEntries().length || 1;
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count, percent: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  });

  readonly qualities = computed(() => {
    const counts: Record<string, number> = {};
    this.store.allEntries().forEach((e) => {
      const q = e.quality || '1080p';
      counts[q] = (counts[q] || 0) + 1;
    });
    const total = this.store.allEntries().length || 1;
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count, percent: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  });
}
