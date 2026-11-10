import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MediaHubStore } from '../../core/store/mediahub.store';
import { PlayerService } from '../../core/services/player.service';
import { MusicService } from '../../core/services/music.service';
import { MediaFormService } from '../../core/services/media-form.service';
import { PosterCardComponent } from '../inicio/poster-card.component';
import { IconComponent } from '../../shared/icon.component';
import { ArtComponent } from '../../shared/art.component';
import { LibraryEntry, Track } from '../../core/models';
import { formatDuration } from '../../core/util/format';

@Component({
  selector: 'mh-buscar',
  standalone: true,
  imports: [PosterCardComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">Búsqueda global</h1>
        <p class="page-sub">Encuentra vídeos, series, música, artistas y episodios</p>
      </div>
    </div>

    <!-- Barra de búsqueda local -->
    <div style="margin-bottom: 24px; max-width: 600px">
      <div class="search-box" style="width: 100%; border: 1px solid var(--md-sys-color-outline-variant)">
        <span class="sb-ic"><mh-icon name="search" /></span>
        <input
          type="search"
          placeholder="Escribe título, género, artista, etiqueta..."
          [value]="query()"
          (input)="onInput($event)"
          autofocus
        />
        @if (query()) {
          <button class="icon-btn" type="button" aria-label="Limpiar" (click)="clear()">
            <mh-icon name="close" [size]="16" />
          </button>
        }
      </div>
    </div>

    @if (!query().trim()) {
      <div class="empty-state" style="padding: 48px; text-align: center; color: var(--md-sys-color-on-surface-variant)">
        <mh-icon name="search" [size]="48" />
        <p style="margin-top: 12px">Escribe algo para buscar en toda la biblioteca.</p>
      </div>
    } @else if (results().length === 0 && matchingTracks().length === 0) {
      <div class="empty-state" style="padding: 48px; text-align: center; color: var(--md-sys-color-on-surface-variant)">
        <mh-icon name="alert-circle" [size]="48" />
        <p style="margin-top: 12px">No se encontraron resultados para "{{ query() }}".</p>
      </div>
    } @else {
      <!-- Resultados en vídeo / series -->
      @if (results().length > 0) {
        <section style="margin-bottom: 32px">
          <div class="page-head" style="margin-bottom: 12px">
            <h2 class="page-title" style="font-size: 1.25rem">Vídeos y episodios ({{ results().length }})</h2>
          </div>
          <div class="grid poster">
            @for (item of results(); track item.id) {
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

      <!-- Resultados en música -->
      @if (matchingTracks().length > 0) {
        <section style="margin-bottom: 32px">
          <div class="page-head" style="margin-bottom: 12px">
            <h2 class="page-title" style="font-size: 1.25rem">Pistas de música ({{ matchingTracks().length }})</h2>
          </div>
          <div class="track-list" style="background: var(--md-sys-color-surface-container-low); border-radius: 12px; padding: 8px;">
            @for (tr of matchingTracks(); track tr.id) {
              <div class="track-row" (click)="playMusic(tr)">
                <div class="track-idx"><mh-icon name="music" [size]="16" /></div>
                <div>
                  <div class="track-name">{{ tr.title }}</div>
                  <div class="track-artist">{{ tr.artistName }} · {{ tr.albumTitle }}</div>
                </div>
                <div class="card-meta">{{ formatDuration(tr.duration) }}</div>
                <button class="icon-btn" type="button" aria-label="Reproducir" (click)="$event.stopPropagation(); playMusic(tr)">
                  <mh-icon name="play" [size]="16" />
                </button>
              </div>
            }
          </div>
        </section>
      }
    }
  `,
})
export class BuscarComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(MediaHubStore);
  private readonly player = inject(PlayerService);
  private readonly music = inject(MusicService);
  private readonly mediaForm = inject(MediaFormService);

  readonly query = signal<string>('');

  readonly results = computed<LibraryEntry[]>(() => {
    const q = this.query().trim();
    if (!q) return [];
    return this.store.search(q);
  });

  readonly matchingTracks = computed<Track[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return [];
    return this.store.tracks().filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artistName.toLowerCase().includes(q) ||
        t.albumTitle.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q),
    );
  });

  readonly formatDuration = formatDuration;

  constructor() {
    this.route.queryParams.subscribe((params) => {
      if (params['q']) {
        this.query.set(params['q']);
      }
    });
  }

  onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  clear(): void {
    this.query.set('');
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
    this.music.play(track, this.matchingTracks());
  }
}
