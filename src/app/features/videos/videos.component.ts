import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MediaHubStore } from '../../core/store/mediahub.store';
import { PlayerService } from '../../core/services/player.service';
import { MediaFormService } from '../../core/services/media-form.service';
import { ToastService } from '../../core/services/toast.service';
import { PosterCardComponent } from '../inicio/poster-card.component';
import { IconComponent } from '../../shared/icon.component';
import { ArtComponent } from '../../shared/art.component';
import { LibraryEntry, Video } from '../../core/models';
import { formatBytes, formatDuration } from '../../core/util/format';

@Component({
  selector: 'mh-videos-list',
  standalone: true,
  imports: [PosterCardComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">Vídeos independientes</h1>
        <p class="page-sub">{{ videos().length }} películas y documentales</p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-filled" type="button" (click)="addVideo()">
          <mh-icon name="plus" [size]="18" />
          <span>Nuevo vídeo</span>
        </button>
      </div>
    </div>

    <!-- Filtros de categoría -->
    <div class="chips" style="margin-bottom: 20px">
      <button
        type="button"
        class="chip"
        [class.selected]="selectedCategory() === ''"
        (click)="selectedCategory.set('')"
      >
        Todas las categorías
      </button>
      @for (c of categories(); track c.id) {
        <button
          type="button"
          class="chip"
          [class.selected]="selectedCategory() === c.id"
          (click)="selectedCategory.set(c.id)"
        >
          {{ c.name }}
        </button>
      }
    </div>

    @if (filteredVideos().length === 0) {
      <div class="empty-state" style="padding: 48px; text-align: center; color: var(--md-sys-color-on-surface-variant)">
        <mh-icon name="film" [size]="48" />
        <p style="margin-top: 12px">No se encontraron vídeos con este filtro.</p>
      </div>
    } @else {
      <div class="grid poster">
        @for (item of filteredEntries(); track item.id) {
          <mh-poster-card
            [entry]="item"
            (opened)="openVideo($event)"
            (edited)="editMedia($event)"
            (favoriteToggled)="toggleFavorite($event)"
          />
        }
      </div>
    }
  `,
})
export class VideosListComponent {
  private readonly store = inject(MediaHubStore);
  private readonly player = inject(PlayerService);
  private readonly mediaForm = inject(MediaFormService);

  readonly videos = computed(() => this.store.videos());
  readonly categories = computed(() => this.store.categories());
  readonly selectedCategory = signal<string>('');

  readonly filteredVideos = computed(() => {
    const cat = this.selectedCategory();
    if (!cat) return this.videos();
    return this.videos().filter((v) => v.categoryId === cat);
  });

  readonly filteredEntries = computed<LibraryEntry[]>(() =>
    this.filteredVideos().map((v) => ({ ...v, kind: 'video' })),
  );

  addVideo(): void {
    this.mediaForm.open('video');
  }

  openVideo(entry: LibraryEntry): void {
    this.player.openItem(entry);
  }

  editMedia(entry: LibraryEntry): void {
    this.mediaForm.open('video', { id: entry.id });
  }

  toggleFavorite(entry: LibraryEntry): void {
    this.store.dispatch({ type: 'ToggleFavoriteCommand', payload: { id: entry.id } });
  }
}

@Component({
  selector: 'mh-video-detail',
  standalone: true,
  imports: [RouterLink, IconComponent, ArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (video(); as v) {
      <div style="margin-bottom: 16px">
        <a routerLink="/videos" class="btn btn-text" style="padding-left: 0">
          <mh-icon name="arrow-left" [size]="18" />
          <span>Volver a vídeos</span>
        </a>
      </div>

      <div class="detail-stage">
        <!-- Cinematic Wide Backdrop -->
        <div class="detail-backdrop-header">
          <div class="detail-backdrop-art">
            <mh-art [seed]="v.poster || v.title" kind="wide" />
          </div>
          <div class="detail-backdrop-scrim"></div>
        </div>

        <!-- Overlapping Main Info Grid -->
        <div class="detail-main-grid">
          <div class="detail-poster-wrap">
            <div class="ph">
              <mh-art [seed]="v.poster || v.title" />
              <span>{{ v.title }}</span>
            </div>
          </div>

          <div class="detail-header-info">
            <div class="detail-pills-row">
              <span class="detail-pill badge-accent">Vídeo / Película</span>
              @if (v.rating) {
                <span class="detail-pill badge-rating">
                  <mh-icon name="star" [size]="13" />
                  <span>{{ v.rating }}</span>
                </span>
              }
              <span class="detail-pill">{{ v.year }}</span>
              <span class="detail-pill">{{ v.genre }}</span>
              <span class="detail-pill">{{ formatDuration(v.duration) }}</span>
              <span class="detail-pill">{{ v.quality }} ({{ v.resolution }})</span>
            </div>

            <h1 class="detail-cinema-title">{{ v.title }}</h1>

            <div class="chips-inline">
              @for (t of v.tags; track t) {
                <span class="tag-chip primary">{{ t }}</span>
              }
            </div>

            <div class="detail-actions" style="margin-top: 14px">
              <button class="btn btn-filled" type="button" (click)="playVideo(v)">
                <mh-icon name="play" [size]="18" />
                <span>Reproducir ahora</span>
              </button>
              <button class="btn btn-tonal" type="button" (click)="editVideo(v.id)">
                <mh-icon name="edit" [size]="18" />
                <span>Editar metadatos</span>
              </button>
              <button class="btn btn-outlined" type="button" (click)="toggleWatched(v.id, v.watched)">
                <mh-icon [name]="v.watched ? 'check-circle' : 'circle'" [size]="18" />
                <span>{{ v.watched ? 'Visto' : 'Marcar visto' }}</span>
              </button>
              <button class="btn btn-text" type="button" (click)="toggleFavorite(v.id)">
                <mh-icon name="heart" [size]="18" />
                <span>{{ v.favorite ? 'En favoritos' : 'Favorito' }}</span>
              </button>
              <button class="btn btn-danger" type="button" (click)="deleteVideo(v)">
                <mh-icon name="trash" [size]="18" />
                <span>Eliminar vídeo</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Synopsis Box -->
        <div class="detail-synopsis-box">
          <h3 style="font: var(--md-sys-typescale-title-small); font-weight: 600; margin-bottom: 8px">Sinopsis</h3>
          <p style="margin: 0; line-height: 1.6; color: var(--md-sys-color-on-surface-variant)">
            {{ v.synopsis || 'Sin sinopsis disponible para este título.' }}
          </p>
        </div>

        <!-- Ficha técnica moderna -->
        <div class="detail-spec-card">
          <h3 style="font: var(--md-sys-typescale-title-small); font-weight: 600; margin-bottom: 12px">Especificaciones técnicas de transmisión</h3>
          <div class="spec-grid">
            <div class="spec-item">
              <span class="spec-lbl">Códec de vídeo</span>
              <span class="spec-val">{{ v.videoCodec || 'H.264 / AVC' }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-lbl">Códec de audio</span>
              <span class="spec-val">{{ v.audioCodec || 'AAC 5.1 Surround' }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-lbl">Resolución nativa</span>
              <span class="spec-val">{{ v.resolution || '1920x1080' }} ({{ v.quality || 'FHD' }})</span>
            </div>
            <div class="spec-item">
              <span class="spec-lbl">Tamaño de archivo</span>
              <span class="spec-val">{{ formatBytes(v.sizeBytes) }}</span>
            </div>
            <div class="spec-item" style="grid-column: 1 / -1">
              <span class="spec-lbl">Ubicación local en almacenamiento</span>
              <span class="spec-val" style="word-break: break-all; opacity: 0.8">{{ v.path }}</span>
            </div>
          </div>
        </div>
      </div>
    } @else {
      <div style="padding: 48px; text-align: center">
        <p>Vídeo no encontrado.</p>
        <a routerLink="/videos" class="btn btn-filled" style="margin-top: 16px; display: inline-flex">Volver</a>
      </div>
    }
  `,
})
export class VideoDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(MediaHubStore);
  private readonly player = inject(PlayerService);
  private readonly mediaForm = inject(MediaFormService);
  private readonly toast = inject(ToastService);

  readonly videoId = signal<string>('');

  readonly video = computed<Video | null>(() => {
    const id = this.videoId();
    return this.store.videoById(id) ?? null;
  });

  readonly formatDuration = formatDuration;
  readonly formatBytes = formatBytes;

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id') ?? '';
      this.videoId.set(id);
    });
  }

  playVideo(v: Video): void {
    const entry: LibraryEntry = { ...v, kind: 'video' };
    this.player.openItem(entry);
  }

  editVideo(id: string): void {
    this.mediaForm.open('video', { id });
  }

  deleteVideo(v: Video): void {
    if (confirm(`¿Estás seguro de eliminar el vídeo "${v.title}"?`)) {
      this.store.dispatch({ type: 'DeleteVideoCommand', payload: v.id });
      this.toast.show(`Vídeo "${v.title}" eliminado.`, 'info');
      this.router.navigate(['/videos']);
    }
  }

  toggleWatched(id: string, watched: boolean): void {
    if (watched) {
      this.store.dispatch({ type: 'MarkVideoUnwatchedCommand', payload: id });
    } else {
      this.store.dispatch({ type: 'MarkVideoWatchedCommand', payload: id });
    }
  }

  toggleFavorite(id: string): void {
    this.store.dispatch({ type: 'ToggleFavoriteCommand', payload: { id } });
  }
}
