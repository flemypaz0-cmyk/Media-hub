import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MediaHubStore } from '../../core/store/mediahub.store';
import { PlayerService } from '../../core/services/player.service';
import { MusicService } from '../../core/services/music.service';
import { MediaFormService } from '../../core/services/media-form.service';
import { PosterCardComponent } from './poster-card.component';
import { IconComponent } from '../../shared/icon.component';
import { ArtComponent } from '../../shared/art.component';
import { LibraryEntry, Track } from '../../core/models';
import { formatBytes, formatDuration } from '../../core/util/format';

interface CategoryFilterOption {
  key: 'todos' | 'videos' | 'series' | 'musica' | 'favoritos' | '4k';
  label: string;
  icon: string;
  count?: number;
}

@Component({
  selector: 'mh-inicio',
  standalone: true,
  imports: [RouterLink, PosterCardComponent, IconComponent, ArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Encabezado de bienvenida -->
    <div class="page-head" style="margin-bottom: 24px">
      <div>
        <h1 class="page-title">{{ greeting() }}, {{ profile()?.name || 'Usuario' }}</h1>
        <p class="page-sub">Centro multimedia de transmisión local de alta definición</p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-filled" type="button" (click)="addContent()">
          <mh-icon name="plus" [size]="18" />
          <span>Agregar contenido</span>
        </button>
      </div>
    </div>

    <!-- ==================== HERO BILLBOARD SPOTLIGHT ==================== -->
    @if (heroItem(); as hero) {
      <section class="hero-billboard" aria-label="Contenido destacado">
        <div class="hero-backdrop">
          <mh-art [seed]="hero.poster || hero.title" kind="wide" />
        </div>
        <div class="hero-scrim"></div>

        <div class="hero-content">
          <div class="hero-kicker">
            <span class="hero-badge-pill">
              <mh-icon name="sparkles" [size]="14" />
              <span>Destacado de la biblioteca</span>
            </span>
            <span class="hero-badge-rank">★ Colección Premium</span>
          </div>

          <h2 class="hero-title">{{ hero.title }}</h2>

          <div class="hero-meta-row">
            <span class="hero-rating"><mh-icon name="star" [size]="16" /> {{ hero.rating || 4.9 }}</span>
            <span class="hero-sep">·</span>
            <span class="hero-tag-pill">{{ hero.genre }}</span>
            <span class="hero-sep">·</span>
            <span class="hero-year">{{ hero.year }}</span>
            <span class="hero-sep">·</span>
            <span class="hero-dur">{{ formatDuration(hero.duration) }}</span>
            <span class="hero-badge-res">{{ hero.quality || '4K UHD' }}</span>
            <span class="hero-badge-audio">Dolby Atmos</span>
          </div>

          <p class="hero-synopsis">{{ hero.synopsis }}</p>

          <div class="hero-actions">
            <button class="btn btn-filled hero-play-btn" type="button" (click)="openVideo(hero)">
              <mh-icon name="play" [size]="20" />
              <span>Reproducir ahora</span>
            </button>
            <button class="btn btn-tonal" type="button" (click)="editMedia(hero)">
              <mh-icon name="info" [size]="18" />
              <span>Detalles</span>
            </button>
            <button
              class="icon-btn hero-fav-btn"
              type="button"
              [title]="hero.favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'"
              (click)="toggleFavorite(hero)"
            >
              <mh-icon name="heart" [size]="20" [style.color]="hero.favorite ? '#ff5252' : 'inherit'" />
            </button>
          </div>
        </div>

        <!-- Selector de destacados -->
        @if (spotlightItems().length > 1) {
          <div class="hero-carousel-nav">
            <span class="hcn-label">Selección destacada:</span>
            <div class="hcn-thumbs">
              @for (item of spotlightItems(); track item.id; let idx = $index) {
                <button
                  type="button"
                  class="hcn-thumb"
                  [class.active]="heroIndex() === idx"
                  (click)="setHeroIndex(idx)"
                  [title]="item.title"
                >
                  <div class="hcn-art">
                    <mh-art [seed]="item.poster || item.title" kind="wide" />
                  </div>
                  <div class="hcn-info">
                    <span class="hcn-title">{{ item.title }}</span>
                    <span class="hcn-sub">{{ item.genre }}</span>
                  </div>
                </button>
              }
            </div>
          </div>
        }
      </section>
    }

    <!-- ==================== STRIP DE MÉTRICAS DEL HUB ==================== -->
    <div class="hub-metrics-grid">
      <div class="metric-card">
        <div class="mc-icon film"><mh-icon name="film" [size]="22" /></div>
        <div class="mc-data">
          <div class="mc-val">{{ videoCount() }} <span class="mc-unit">vídeos</span></div>
          <div class="mc-label">{{ totalVideoHours() }} horas de contenido</div>
        </div>
      </div>
      <div class="metric-card">
        <div class="mc-icon tv"><mh-icon name="tv" [size]="22" /></div>
        <div class="mc-data">
          <div class="mc-val">{{ series().length }} <span class="mc-unit">series</span></div>
          <div class="mc-label">{{ episodeCount() }} episodios organizados</div>
        </div>
      </div>
      <div class="metric-card">
        <div class="mc-icon music"><mh-icon name="music" [size]="22" /></div>
        <div class="mc-data">
          <div class="mc-val">{{ musicTracks().length }} <span class="mc-unit">pistas</span></div>
          <div class="mc-label">{{ albumsCount() }} álbumes sin pérdida</div>
        </div>
      </div>
      <div class="metric-card">
        <div class="mc-icon storage"><mh-icon name="server" [size]="22" /></div>
        <div class="mc-data">
          <div class="mc-row">
            <span class="mc-val">{{ storagePercent() }}% <span class="mc-unit">disco</span></span>
            <span class="mc-sub-free">{{ storageFree() }} libres</span>
          </div>
          <div class="mc-meter"><div class="mc-fill" [style.width.%]="storagePercent()"></div></div>
          <div class="mc-label">{{ storageUsed() }} de {{ storageTotal() }}</div>
        </div>
      </div>
    </div>

    <!-- ==================== CINTA DE FILTRO RÁPIDO ==================== -->
    <div class="category-ribbon" role="tablist" aria-label="Filtro rápido de categorías">
      @for (f of categoryFilters(); track f.key) {
        <button
          type="button"
          class="ribbon-chip"
          [class.active]="categoryFilter() === f.key"
          (click)="categoryFilter.set(f.key)"
        >
          <mh-icon [name]="f.icon" [size]="16" />
          <span>{{ f.label }}</span>
          @if (f.count !== undefined) {
            <span class="rc-badge">{{ f.count }}</span>
          }
        </button>
      }
    </div>

    <!-- ==================== SHELVES DE CONTENIDO ==================== -->

    <!-- CONTINUAR VIENDO -->
    @if ((categoryFilter() === 'todos' || categoryFilter() === 'videos') && continueWatching().length > 0) {
      <section style="margin-bottom: 32px">
        <div class="page-head" style="margin-bottom: 14px">
          <div style="display: flex; align-items: center; gap: 8px">
            <mh-icon name="history" [size]="20" style="color: var(--md-sys-color-primary)" />
            <h2 class="page-title" style="font-size: 1.3rem">Continuar viendo</h2>
          </div>
        </div>
        <div class="grid poster">
          @for (item of continueWatching(); track item.id) {
            <mh-poster-card
              [entry]="item"
              (opened)="openVideo($event)"
              (edited)="editMedia($event)"
              (favoriteToggled)="toggleFavorite($event)"
            />
          }
        </div>
      </section>
    }

    <!-- FAVORITOS (cuando filtro 'favoritos') -->
    @if (categoryFilter() === 'favoritos') {
      <section style="margin-bottom: 32px">
        <div class="page-head" style="margin-bottom: 14px">
          <div style="display: flex; align-items: center; gap: 8px">
            <mh-icon name="heart" [size]="20" style="color: #ff5252" />
            <h2 class="page-title" style="font-size: 1.3rem">Mis favoritos</h2>
          </div>
        </div>
        @if (favoriteEntries().length === 0) {
          <div class="empty-state" style="padding: 36px 20px">
            <p>No tienes elementos marcados como favoritos aún. Haz clic en el corazón de cualquier portada.</p>
          </div>
        } @else {
          <div class="grid poster">
            @for (item of favoriteEntries(); track item.id) {
              <mh-poster-card
                [entry]="item"
                (opened)="openVideo($event)"
                (edited)="editMedia($event)"
                (favoriteToggled)="toggleFavorite($event)"
              />
            }
          </div>
        }
      </section>
    }

    <!-- CALIDAD 4K (cuando filtro '4k') -->
    @if (categoryFilter() === '4k') {
      <section style="margin-bottom: 32px">
        <div class="page-head" style="margin-bottom: 14px">
          <div style="display: flex; align-items: center; gap: 8px">
            <mh-icon name="sparkles" [size]="20" style="color: #fbbf24" />
            <h2 class="page-title" style="font-size: 1.3rem">Contenido 4K Ultra HD</h2>
          </div>
        </div>
        <div class="grid poster">
          @for (item of uhdEntries(); track item.id) {
            <mh-poster-card
              [entry]="item"
              (opened)="openVideo($event)"
              (edited)="editMedia($event)"
              (favoriteToggled)="toggleFavorite($event)"
            />
          }
        </div>
      </section>
    }

    <!-- AGREGADOS RECIENTEMENTE (todos o videos) -->
    @if ((categoryFilter() === 'todos' || categoryFilter() === 'videos') && recentlyAdded().length > 0) {
      <section style="margin-bottom: 32px">
        <div class="page-head" style="margin-bottom: 14px">
          <div style="display: flex; align-items: center; gap: 8px">
            <mh-icon name="film" [size]="20" style="color: #818cf8" />
            <h2 class="page-title" style="font-size: 1.3rem">Agregados recientemente</h2>
          </div>
          <div class="page-head-actions">
            <a routerLink="/videos" class="btn btn-text">Ver todos ({{ videoCount() }})</a>
          </div>
        </div>
        <div class="grid poster">
          @for (item of recentlyAdded().slice(0, 10); track item.id) {
            <mh-poster-card
              [entry]="item"
              (opened)="openVideo($event)"
              (edited)="editMedia($event)"
              (favoriteToggled)="toggleFavorite($event)"
            />
          }
        </div>
      </section>
    }

    <!-- SERIES DE TV (todos o series) -->
    @if ((categoryFilter() === 'todos' || categoryFilter() === 'series') && series().length > 0) {
      <section style="margin-bottom: 32px">
        <div class="page-head" style="margin-bottom: 14px">
          <div style="display: flex; align-items: center; gap: 8px">
            <mh-icon name="tv" [size]="20" style="color: #c084fc" />
            <h2 class="page-title" style="font-size: 1.3rem">Series en emisión y completas</h2>
          </div>
          <div class="page-head-actions">
            <a routerLink="/series" class="btn btn-text">Explorar todas las series</a>
          </div>
        </div>
        <div class="grid poster">
          @for (s of series().slice(0, 8); track s.id) {
            <article class="card" tabindex="0" [routerLink]="['/series', s.id]">
              <div class="card-poster">
                <div class="ph"><mh-art [seed]="s.poster || s.title" /><span>{{ s.title }}</span></div>
                <div class="hover-play-overlay" aria-hidden="true">
                  <div class="hpo-circle"><mh-icon name="play" [size]="24" /></div>
                </div>
                <div class="badge badge-tl res">{{ s.seasons.length }} temp.</div>
                @if (s.rating && s.rating > 0) {
                  <div class="badge rating">★ {{ s.rating }}</div>
                }
              </div>
              <div class="card-body">
                <div class="card-title">{{ s.title }}</div>
                <div class="card-meta">{{ s.genre }} · {{ s.year }}</div>
              </div>
            </article>
          }
        </div>
      </section>
    }

    <!-- MÚSICA DESTACADA (todos o musica) -->
    @if ((categoryFilter() === 'todos' || categoryFilter() === 'musica') && musicTracks().length > 0) {
      <section style="margin-bottom: 32px">
        <div class="page-head" style="margin-bottom: 14px">
          <div style="display: flex; align-items: center; gap: 8px">
            <mh-icon name="music" [size]="20" style="color: #f472b6" />
            <h2 class="page-title" style="font-size: 1.3rem">Música destacada y álbumes</h2>
          </div>
          <div class="page-head-actions">
            <a routerLink="/musica" class="btn btn-text">Ir a música completa</a>
          </div>
        </div>
        <div class="track-list" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 10px; backdrop-filter: blur(12px)">
          @for (tr of musicTracks().slice(0, 6); track tr.id) {
            <div
              class="track-row"
              [class.playing]="currentMusicTrack()?.id === tr.id"
              (click)="playMusic(tr)"
              tabindex="0"
              style="padding: 10px 14px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 14px; transition: background 160ms ease;"
            >
              <div class="track-idx" style="width: 24px; display: grid; place-items: center">
                @if (currentMusicTrack()?.id === tr.id && isMusicPlaying()) {
                  <div class="soundwave">
                    <span class="sw-bar"></span>
                    <span class="sw-bar"></span>
                    <span class="sw-bar"></span>
                    <span class="sw-bar"></span>
                  </div>
                } @else {
                  <mh-icon name="music" [size]="16" style="color: var(--md-sys-color-on-surface-variant)" />
                }
              </div>
              <div style="flex: 1; min-width: 0">
                <div class="track-name" style="font-weight: 500; font-size: 0.9375rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ tr.title }}</div>
                <div class="track-artist" style="font-size: 0.8125rem; color: var(--md-sys-color-on-surface-variant); white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ tr.artistName }} · {{ tr.albumTitle }}</div>
              </div>
              <div class="card-meta" style="font-size: 0.8125rem">{{ formatDuration(tr.duration) }}</div>
              <button class="icon-btn sm" type="button" aria-label="Reproducir pista" (click)="$event.stopPropagation(); playMusic(tr)">
                <mh-icon [name]="currentMusicTrack()?.id === tr.id && isMusicPlaying() ? 'pause' : 'play'" [size]="16" />
              </button>
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class InicioComponent {
  private readonly store = inject(MediaHubStore);
  private readonly player = inject(PlayerService);
  private readonly music = inject(MusicService);
  private readonly mediaForm = inject(MediaFormService);

  readonly heroIndex = signal<number>(0);
  readonly categoryFilter = signal<'todos' | 'videos' | 'series' | 'musica' | 'favoritos' | '4k'>('todos');

  readonly continueWatching = computed(() => this.store.continueWatching());
  readonly recentlyAdded = computed(() => this.store.recentlyAdded());
  readonly series = computed(() => this.store.series());
  readonly musicTracks = computed(() => this.store.tracks());
  readonly profile = computed(() => this.store.currentProfile());
  readonly currentMusicTrack = computed(() => this.music.current());
  readonly isMusicPlaying = computed(() => this.music.playing());

  readonly videoCount = computed(() => this.store.videos().length);
  readonly episodeCount = computed(() => this.store.episodeCount());
  readonly albumsCount = computed(() => this.store.albums().length);
  readonly storagePercent = computed(() => this.store.storagePercent());
  readonly storageUsed = computed(() => formatBytes(this.store.storageUsed()));
  readonly storageTotal = computed(() => formatBytes(this.store.storageTotal()));
  readonly storageFree = computed(() =>
    formatBytes(Math.max(0, this.store.storageTotal() - this.store.storageUsed())),
  );

  readonly totalVideoHours = computed(() => {
    const totalSecs = this.store.videos().reduce((acc, v) => acc + (v.duration || 0), 0);
    return Math.round(totalSecs / 3600);
  });

  readonly favoriteEntries = computed(() => this.store.favorites());

  readonly uhdEntries = computed(() =>
    this.store.visibleEntries().filter((e) => e.quality === '2160p' || e.tags?.includes('4k')),
  );

  readonly spotlightItems = computed<LibraryEntry[]>(() => {
    const all = this.store.visibleEntries();
    if (!all.length) return [];
    // Prioritize high-rated or top videos/series
    const candidates = all.filter((e) => (e.rating || 0) >= 4.5 || e.favorite);
    return candidates.length >= 3 ? candidates.slice(0, 4) : all.slice(0, 4);
  });

  readonly heroItem = computed<LibraryEntry | null>(() => {
    const list = this.spotlightItems();
    if (!list.length) return null;
    return list[this.heroIndex() % list.length];
  });

  readonly categoryFilters = computed<CategoryFilterOption[]>(() => [
    { key: 'todos', label: 'Todos los medios', icon: 'home' },
    { key: 'videos', label: 'Películas y Vídeos', icon: 'film', count: this.videoCount() },
    { key: 'series', label: 'Series de TV', icon: 'tv', count: this.series().length },
    { key: 'musica', label: 'Música y Álbumes', icon: 'music', count: this.musicTracks().length },
    { key: 'favoritos', label: 'Favoritos', icon: 'heart', count: this.favoriteEntries().length },
    { key: '4k', label: 'Calidad 4K UHD', icon: 'sparkles', count: this.uhdEntries().length },
  ]);

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
  });

  readonly formatDuration = formatDuration;

  setHeroIndex(idx: number): void {
    this.heroIndex.set(idx);
  }

  openVideo(entry: LibraryEntry): void {
    this.player.openItem(entry);
  }

  editMedia(entry: LibraryEntry): void {
    this.mediaForm.open(entry.kind === 'video' ? 'video' : 'episode', { id: entry.id });
  }

  toggleFavorite(entry: LibraryEntry): void {
    this.store.dispatch({ type: 'ToggleFavoriteCommand', payload: { id: entry.id } });
  }

  playMusic(track: Track): void {
    this.music.play(track, this.musicTracks());
  }

  addContent(): void {
    this.mediaForm.open('video');
  }
}
