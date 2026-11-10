import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MediaHubStore } from '../../core/store/mediahub.store';
import { PlayerService } from '../../core/services/player.service';
import { MediaFormService } from '../../core/services/media-form.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { ArtComponent } from '../../shared/art.component';
import { Episode, LibraryEntry, Season, Series } from '../../core/models';
import { formatDuration } from '../../core/util/format';

@Component({
  selector: 'mh-series-list',
  standalone: true,
  imports: [RouterLink, IconComponent, ArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">Series de TV</h1>
        <p class="page-sub">{{ seriesList().length }} series registradas</p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-filled" type="button" (click)="createSeries()">
          <mh-icon name="plus" [size]="18" />
          <span>Nueva serie</span>
        </button>
      </div>
    </div>

    <!-- Filtros de género -->
    <div class="chips" style="margin-bottom: 20px">
      <button
        type="button"
        class="chip"
        [class.selected]="selectedGenre() === ''"
        (click)="selectedGenre.set('')"
      >
        Todas
      </button>
      @for (g of genres(); track g) {
        <button
          type="button"
          class="chip"
          [class.selected]="selectedGenre() === g"
          (click)="selectedGenre.set(g)"
        >
          {{ g }}
        </button>
      }
    </div>

    @if (filteredSeries().length === 0) {
      <div class="empty-state" style="padding: 48px; text-align: center; color: var(--md-sys-color-on-surface-variant)">
        <mh-icon name="tv" [size]="48" />
        <p style="margin-top: 12px">No se encontraron series con este filtro.</p>
      </div>
    } @else {
      <div class="grid poster">
        @for (s of filteredSeries(); track s.id) {
          <article class="card" tabindex="0" [routerLink]="['/series', s.id]">
            <div class="card-poster">
              <div class="ph"><mh-art [seed]="s.poster || s.title" /><span>{{ s.title }}</span></div>
              <div class="badge badge-tl res">{{ s.seasons.length }} temp.</div>
              @if (s.favorite) {
                <div class="badge badge-br" style="color: #ff5252"><mh-icon name="heart" [size]="14" /></div>
              }
              <div class="hover-play-overlay">
                <div class="hpo-circle">
                  <mh-icon name="play" [size]="20" />
                </div>
              </div>
            </div>
            <div class="card-body">
              <div class="card-title">{{ s.title }}</div>
              <div class="card-meta">{{ s.genre }} · {{ s.year }}</div>
            </div>
          </article>
        }
      </div>
    }
  `,
})
export class SeriesListComponent {
  private readonly store = inject(MediaHubStore);
  private readonly mediaForm = inject(MediaFormService);

  readonly seriesList = computed(() => this.store.series());
  readonly selectedGenre = signal<string>('');

  readonly genres = computed(() => {
    const set = new Set<string>();
    this.seriesList().forEach((s) => {
      if (s.genre) set.add(s.genre);
    });
    return Array.from(set);
  });

  readonly filteredSeries = computed(() => {
    const g = this.selectedGenre();
    if (!g) return this.seriesList();
    return this.seriesList().filter((s) => s.genre === g);
  });

  createSeries(): void {
    this.mediaForm.open('series');
  }
}

@Component({
  selector: 'mh-series-detail',
  standalone: true,
  imports: [RouterLink, IconComponent, ArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (series(); as s) {
      <div style="margin-bottom: 16px">
        <a routerLink="/series" class="btn btn-text" style="padding-left: 0">
          <mh-icon name="arrow-left" [size]="18" />
          <span>Volver a series</span>
        </a>
      </div>

      <div class="detail-stage">
        <!-- Cinematic Wide Backdrop -->
        <div class="detail-backdrop-header">
          <div class="detail-backdrop-art">
            <mh-art [seed]="s.poster || s.title" kind="wide" />
          </div>
          <div class="detail-backdrop-scrim"></div>
        </div>

        <!-- Overlapping Main Info Grid -->
        <div class="detail-main-grid">
          <div class="detail-poster-wrap">
            <div class="ph">
              <mh-art [seed]="s.poster || s.title" />
              <span>{{ s.title }}</span>
            </div>
          </div>

          <div class="detail-header-info">
            <div class="detail-pills-row">
              <span class="detail-pill badge-accent">Serie de TV</span>
              @if (s.rating) {
                <span class="detail-pill badge-rating">
                  <mh-icon name="star" [size]="13" />
                  <span>{{ s.rating }}</span>
                </span>
              }
              <span class="detail-pill">{{ s.year }}</span>
              <span class="detail-pill">{{ s.genre }}</span>
              <span class="detail-pill">{{ s.seasons.length }} temporadas</span>
              <span class="detail-pill">{{ totalEpisodes() }} episodios</span>
            </div>

            <h1 class="detail-cinema-title">{{ s.title }}</h1>

            <div class="chips-inline">
              @for (t of s.tags; track t) {
                <span class="tag-chip primary">{{ t }}</span>
              }
            </div>

            <div class="detail-actions" style="margin-top: 14px">
              @if (firstEpisode(); as first) {
                <button class="btn btn-filled" type="button" (click)="playEpisode(first)">
                  <mh-icon name="play" [size]="18" />
                  <span>Reproducir S{{ first.seasonNumber }}E{{ first.number }}</span>
                </button>
              }
              <button class="btn btn-tonal" type="button" (click)="addEpisode(s.id)">
                <mh-icon name="plus" [size]="18" />
                <span>Agregar episodio</span>
              </button>
              <button class="btn btn-outlined" type="button" (click)="editSeries(s.id)">
                <mh-icon name="edit" [size]="18" />
                <span>Editar</span>
              </button>
              <button class="btn btn-text" type="button" (click)="toggleFavorite(s.id)">
                <mh-icon name="heart" [size]="18" />
                <span>{{ s.favorite ? 'En favoritos' : 'Favorito' }}</span>
              </button>
              <button class="btn btn-danger" type="button" (click)="deleteSeries(s)">
                <mh-icon name="trash" [size]="18" />
                <span>Eliminar serie</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Synopsis Box -->
        <div class="detail-synopsis-box">
          <h3 style="font: var(--md-sys-typescale-title-small); font-weight: 600; margin-bottom: 8px">Sinopsis</h3>
          <p style="margin: 0; line-height: 1.6; color: var(--md-sys-color-on-surface-variant)">
            {{ s.synopsis || 'Sin sinopsis disponible para esta serie.' }}
          </p>
        </div>
      </div>

      <!-- Temporadas y Episodios -->
      <section style="margin-top: 32px">
        <div class="section-head">
          <h2 class="section-title">Temporadas y episodios</h2>
          <div class="section-actions">
            <button class="btn btn-tonal" type="button" (click)="addSeason(s.id)">
              <mh-icon name="plus" [size]="16" />
              <span>Nueva temporada</span>
            </button>
          </div>
        </div>

        <div class="season-tabs">
          @for (sn of s.seasons; track sn.id) {
            <button
              type="button"
              class="chip"
              [class.selected]="activeSeasonNumber() === sn.number"
              (click)="activeSeasonNumber.set(sn.number)"
            >
              {{ sn.title || 'Temporada ' + sn.number }} ({{ sn.episodes.length }})
            </button>
          }
        </div>

        @if (currentSeason(); as curSn) {
          <div class="track-list" style="margin-top: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 10px;">
            @for (ep of curSn.episodes; track ep.id) {
              <div class="track-row" (click)="playEpisode(ep)">
                <div class="track-idx">E{{ ep.number }}</div>
                <div>
                  <div class="track-name">{{ ep.title }}</div>
                  <div class="track-artist">{{ formatDuration(ep.duration) }} · {{ ep.quality || '1080p' }}</div>
                </div>
                <div style="margin-left: auto; display: flex; align-items: center; gap: 8px">
                  @if (ep.watched) {
                    <span class="badge" style="position: static; background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container)">Visto</span>
                  }
                  <button class="icon-btn" type="button" aria-label="Editar episodio" (click)="$event.stopPropagation(); editEpisode(ep.id)">
                    <mh-icon name="edit" [size]="16" />
                  </button>
                  <button class="icon-btn" type="button" aria-label="Eliminar episodio" (click)="$event.stopPropagation(); deleteEpisode(s.id, ep)">
                    <mh-icon name="trash" [size]="16" />
                  </button>
                  <button class="icon-btn filled sm" type="button" aria-label="Reproducir" (click)="$event.stopPropagation(); playEpisode(ep)">
                    <mh-icon name="play" [size]="16" />
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </section>
    } @else {
      <div style="padding: 48px; text-align: center">
        <p>Serie no encontrada.</p>
        <a routerLink="/series" class="btn btn-filled" style="margin-top: 16px; display: inline-flex">Volver</a>
      </div>
    }
  `,
})
export class SeriesDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(MediaHubStore);
  private readonly player = inject(PlayerService);
  private readonly mediaForm = inject(MediaFormService);
  private readonly toast = inject(ToastService);

  readonly seriesId = signal<string>('');
  readonly activeSeasonNumber = signal<number>(1);

  readonly series = computed<Series | null>(() => {
    const id = this.seriesId();
    return this.store.seriesById(id) ?? null;
  });

  readonly totalEpisodes = computed(() => {
    const s = this.series();
    if (!s) return 0;
    return s.seasons.reduce((acc, sn) => acc + sn.episodes.length, 0);
  });

  readonly currentSeason = computed<Season | null>(() => {
    const s = this.series();
    if (!s) return null;
    return s.seasons.find((sn) => sn.number === this.activeSeasonNumber()) ?? s.seasons[0] ?? null;
  });

  readonly firstEpisode = computed<Episode | null>(() => {
    const s = this.series();
    if (!s) return null;
    for (const sn of s.seasons) {
      if (sn.episodes.length) return sn.episodes[0];
    }
    return null;
  });

  readonly formatDuration = formatDuration;

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id') ?? '';
      this.seriesId.set(id);
    });
  }

  playEpisode(ep: Episode): void {
    const s = this.series();
    const entry: LibraryEntry = {
      ...ep,
      kind: 'episode',
      seriesId: s?.id,
      seriesTitle: s?.title,
      seasonNumber: ep.seasonNumber ?? this.activeSeasonNumber(),
    };
    this.player.openItem(entry);
  }

  addEpisode(seriesId: string): void {
    this.mediaForm.open('episode', { seriesId });
  }

  editSeries(id: string): void {
    this.mediaForm.open('series', { id });
  }

  editEpisode(id: string): void {
    this.mediaForm.open('episode', { id });
  }

  deleteEpisode(seriesId: string, ep: Episode): void {
    if (confirm(`¿Eliminar el episodio "${ep.title}"?`)) {
      this.store.dispatch({
        type: 'DeleteEpisodeCommand',
        payload: { seriesId, episodeId: ep.id },
      });
      this.toast.show(`Episodio "${ep.title}" eliminado.`, 'info');
    }
  }

  addSeason(seriesId: string): void {
    const s = this.series();
    const nextNum = (s?.seasons.length ?? 0) + 1;
    const title = window.prompt(`Título de la nueva temporada:`, `Temporada ${nextNum}`);
    if (title === null) return;
    this.store.dispatch({
      type: 'AddSeasonCommand',
      payload: { seriesId, title: title.trim() || `Temporada ${nextNum}` },
    });
    this.activeSeasonNumber.set(nextNum);
    this.toast.success(`Temporada ${nextNum} añadida.`);
  }

  deleteSeries(s: Series): void {
    if (confirm(`¿Estás seguro de eliminar permanentemente la serie "${s.title}" y todos sus episodios?`)) {
      this.store.dispatch({ type: 'DeleteSeriesCommand', payload: s.id });
      this.toast.show(`Serie "${s.title}" eliminada.`, 'info');
      this.router.navigate(['/series']);
    }
  }

  toggleFavorite(id: string): void {
    this.store.dispatch({ type: 'ToggleFavoriteCommand', payload: { id } });
  }
}
