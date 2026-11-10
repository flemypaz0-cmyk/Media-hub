import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MediaHubStore } from '../../core/store/mediahub.store';
import { MusicService } from '../../core/services/music.service';
import { MediaFormService } from '../../core/services/media-form.service';
import { DialogService } from '../../core/services/dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { CrearPlaylistDialogComponent, PlaylistDraft } from './crear-playlist-dialog.component';
import { IconComponent } from '../../shared/icon.component';
import { ArtComponent } from '../../shared/art.component';
import { Album, Artist, Playlist, Track } from '../../core/models';
import { formatDuration } from '../../core/util/format';

type TabType = 'pistas' | 'albumes' | 'artistas' | 'playlists';

@Component({
  selector: 'mh-musica',
  standalone: true,
  imports: [IconComponent, ArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">Música</h1>
        <p class="page-sub">{{ tracks().length }} canciones · {{ albums().length }} álbumes · {{ artists().length }} artistas</p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-outlined" type="button" (click)="openArtistModal()">
          <mh-icon name="user" [size]="18" />
          <span>Nuevo artista</span>
        </button>
        <button class="btn btn-outlined" type="button" (click)="openAlbumModal()">
          <mh-icon name="disc" [size]="18" />
          <span>Nuevo álbum</span>
        </button>
        <button class="btn btn-tonal" type="button" (click)="createPlaylist()">
          <mh-icon name="list" [size]="18" />
          <span>Nueva playlist</span>
        </button>
        <button class="btn btn-filled" type="button" (click)="addTrack()">
          <mh-icon name="plus" [size]="18" />
          <span>Agregar pista</span>
        </button>
      </div>
    </div>

    <!-- Pestañas -->
    <div class="chips" style="margin-bottom: 20px">
      <button type="button" class="chip" [class.selected]="tab() === 'pistas'" (click)="tab.set('pistas')">
        <mh-icon name="music" [size]="16" />
        <span>Pistas ({{ tracks().length }})</span>
      </button>
      <button type="button" class="chip" [class.selected]="tab() === 'albumes'" (click)="tab.set('albumes')">
        <mh-icon name="disc" [size]="16" />
        <span>Álbumes ({{ albums().length }})</span>
      </button>
      <button type="button" class="chip" [class.selected]="tab() === 'artistas'" (click)="tab.set('artistas')">
        <mh-icon name="user" [size]="16" />
        <span>Artistas ({{ artists().length }})</span>
      </button>
      <button type="button" class="chip" [class.selected]="tab() === 'playlists'" (click)="tab.set('playlists')">
        <mh-icon name="list" [size]="16" />
        <span>Listas ({{ playlists().length }})</span>
      </button>
    </div>

    <!-- PISTAS -->
    @if (tab() === 'pistas') {
      <div class="track-list" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 10px;">
        @for (tr of tracks(); track tr.id) {
          <div class="track-row" [class.playing]="currentTrack()?.id === tr.id" (click)="play(tr)">
            <div class="track-idx" style="width: 32px; display: grid; place-items: center">
              @if (currentTrack()?.id === tr.id && isPlaying()) {
                <div class="soundwave">
                  <div class="sw-bar"></div>
                  <div class="sw-bar"></div>
                  <div class="sw-bar"></div>
                  <div class="sw-bar"></div>
                </div>
              } @else {
                <mh-icon [name]="currentTrack()?.id === tr.id ? 'pause' : 'music'" [size]="16" />
              }
            </div>
            <div>
              <div class="track-name" style="font-weight: 500">{{ tr.title }}</div>
              <div class="track-artist">{{ tr.artistName }} · {{ tr.albumTitle }} ({{ tr.year }})</div>
            </div>
            <div class="card-meta" style="font-variant-numeric: tabular-nums">{{ formatDuration(tr.duration) }}</div>
            <div style="display: flex; gap: 4px; align-items: center" (click)="$event.stopPropagation()">
              <button class="icon-btn" type="button" title="Editar pista" (click)="editTrack(tr)">
                <mh-icon name="edit" [size]="16" />
              </button>
              <button class="icon-btn" type="button" title="Eliminar pista" (click)="deleteTrack(tr)">
                <mh-icon name="trash" [size]="16" />
              </button>
              <button class="icon-btn filled sm" type="button" title="Reproducir" (click)="play(tr)">
                <mh-icon [name]="currentTrack()?.id === tr.id && isPlaying() ? 'pause' : 'play'" [size]="16" />
              </button>
            </div>
          </div>
        }
      </div>
    }

    <!-- ÁLBUMES -->
    @if (tab() === 'albumes') {
      <div class="grid poster">
        @for (al of albums(); track al.id) {
          <article class="card" tabindex="0" (click)="playAlbum(al)">
            <div class="card-poster" style="aspect-ratio: 1/1">
              <div class="ph"><mh-art [seed]="al.cover || al.title" /><span>{{ al.title }}</span></div>
              <div class="badge badge-tl res">{{ al.trackIds.length }} pistas</div>
              <div class="hover-play-overlay">
                <div class="hpo-circle">
                  <mh-icon name="play" [size]="20" />
                </div>
              </div>
            </div>
            <div class="card-body">
              <div class="card-title">{{ al.title }}</div>
              <div class="card-meta">{{ al.artistName }} · {{ al.year }}</div>
            </div>
            <div class="card-actions" (click)="$event.stopPropagation()">
              <button class="icon-btn" type="button" title="Editar álbum" (click)="openAlbumModal(al)">
                <mh-icon name="edit" [size]="16" />
              </button>
              <button class="icon-btn" type="button" title="Eliminar álbum" (click)="deleteAlbum(al)">
                <mh-icon name="trash" [size]="16" />
              </button>
            </div>
          </article>
        }
      </div>
    }

    <!-- ARTISTAS -->
    @if (tab() === 'artistas') {
      <div class="grid poster">
        @for (ar of artists(); track ar.id) {
          <article class="card" tabindex="0" (click)="playArtist(ar)">
            <div class="card-poster" style="aspect-ratio: 1/1; border-radius: 50%; box-shadow: 0 8px 24px rgba(0,0,0,0.35);">
              <div class="ph"><mh-art [seed]="ar.image || ar.name" /><span>{{ ar.name }}</span></div>
              <div class="hover-play-overlay" style="border-radius: 50%">
                <div class="hpo-circle">
                  <mh-icon name="play" [size]="20" />
                </div>
              </div>
            </div>
            <div class="card-body" style="text-align: center">
              <div class="card-title">{{ ar.name }}</div>
              <div class="card-meta">{{ ar.genre }} · {{ ar.year }}</div>
            </div>
            <div class="card-actions" (click)="$event.stopPropagation()">
              <button class="icon-btn" type="button" title="Editar artista" (click)="openArtistModal(ar)">
                <mh-icon name="edit" [size]="16" />
              </button>
              <button class="icon-btn" type="button" title="Eliminar artista" (click)="deleteArtist(ar)">
                <mh-icon name="trash" [size]="16" />
              </button>
            </div>
          </article>
        }
      </div>
    }

    <!-- PLAYLISTS -->
    @if (tab() === 'playlists') {
      <div class="grid row">
        @for (pl of playlists(); track pl.id) {
          <article class="card" style="background: rgba(255, 255, 255, 0.035); border: 1px solid rgba(255, 255, 255, 0.08); padding: 18px; border-radius: 18px; backdrop-filter: blur(12px);" (click)="playPlaylist(pl)">
            <div style="display: flex; gap: 16px; align-items: center">
              <div style="width: 64px; height: 64px; border-radius: 14px; position: relative; overflow: hidden; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.35);">
                <mh-art [seed]="pl.name" />
              </div>
              <div style="flex: 1; min-width: 0">
                <div class="card-title" style="font-weight: 600; font-size: 1.05rem">{{ pl.name }}</div>
                <div class="card-meta" style="margin-top: 3px">{{ pl.description || 'Lista de reproducción personalizada' }}</div>
                <div class="card-meta" style="color: #818cf8; font-weight: 500; margin-top: 4px">{{ pl.trackIds.length }} canciones</div>
              </div>
              <div style="display: flex; gap: 6px; align-items: center" (click)="$event.stopPropagation()">
                <button class="icon-btn" type="button" title="Eliminar lista" (click)="deletePlaylist(pl)">
                  <mh-icon name="trash" [size]="18" />
                </button>
                <button class="icon-btn filled" type="button" aria-label="Reproducir playlist" (click)="playPlaylist(pl)">
                  <mh-icon name="play" [size]="20" />
                </button>
              </div>
            </div>
          </article>
        }
      </div>
    }

    <!-- Modal CRUD Álbum -->
    @if (showAlbumModal()) {
      <div class="dialog-scrim" (click)="showAlbumModal.set(false)">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dlg-head">
            <h2>{{ editingAlbumId() ? 'Editar álbum' : 'Nuevo álbum' }}</h2>
            <button class="icon-btn" aria-label="Cerrar" (click)="showAlbumModal.set(false)">
              <mh-icon name="close" />
            </button>
          </div>
          <div class="dlg-body">
            <div class="field">
              <span class="field-label">Título del álbum *</span>
              <input class="input" type="text" placeholder="Ej. Dark Side of the Moon" [value]="albumTitle()" (input)="albumTitle.set($any($event.target).value)" />
            </div>
            <div class="field">
              <span class="field-label">Artista</span>
              <select class="select" [value]="albumArtistId()" (change)="onAlbumArtistSelect($event)">
                @for (ar of artists(); track ar.id) {
                  <option [value]="ar.id">{{ ar.name }}</option>
                }
              </select>
            </div>
            <div class="grid-2">
              <div class="field">
                <span class="field-label">Año</span>
                <input class="input" type="number" [value]="albumYear()" (input)="albumYear.set(+$any($event.target).value)" />
              </div>
              <div class="field">
                <span class="field-label">Portada / Semilla de arte</span>
                <input class="input" type="text" placeholder="Semilla de arte" [value]="albumCover()" (input)="albumCover.set($any($event.target).value)" />
              </div>
            </div>
          </div>
          <div class="dlg-foot">
            <button class="btn btn-text" type="button" (click)="showAlbumModal.set(false)">Cancelar</button>
            <button class="btn btn-filled" type="button" (click)="saveAlbum()">Guardar álbum</button>
          </div>
        </div>
      </div>
    }

    <!-- Modal CRUD Artista -->
    @if (showArtistModal()) {
      <div class="dialog-scrim" (click)="showArtistModal.set(false)">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dlg-head">
            <h2>{{ editingArtistId() ? 'Editar artista' : 'Nuevo artista' }}</h2>
            <button class="icon-btn" aria-label="Cerrar" (click)="showArtistModal.set(false)">
              <mh-icon name="close" />
            </button>
          </div>
          <div class="dlg-body">
            <div class="field">
              <span class="field-label">Nombre del artista o grupo *</span>
              <input class="input" type="text" placeholder="Ej. Pink Floyd, Daft Punk..." [value]="artistName()" (input)="artistName.set($any($event.target).value)" />
            </div>
            <div class="grid-2">
              <div class="field">
                <span class="field-label">Género principal</span>
                <input class="input" type="text" placeholder="Ej. Rock progresivo, Electrónica..." [value]="artistGenre()" (input)="artistGenre.set($any($event.target).value)" />
              </div>
              <div class="field">
                <span class="field-label">Año de inicio / debut</span>
                <input class="input" type="number" [value]="artistYear()" (input)="artistYear.set(+$any($event.target).value)" />
              </div>
            </div>
          </div>
          <div class="dlg-foot">
            <button class="btn btn-text" type="button" (click)="showArtistModal.set(false)">Cancelar</button>
            <button class="btn btn-filled" type="button" (click)="saveArtist()">Guardar artista</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class MusicaComponent {
  private readonly store = inject(MediaHubStore);
  private readonly music = inject(MusicService);
  private readonly mediaForm = inject(MediaFormService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly tab = signal<TabType>('pistas');

  readonly tracks = computed(() => this.store.tracks());
  readonly albums = computed(() => this.store.albums());
  readonly artists = computed(() => this.store.artists());
  readonly playlists = computed(() => this.store.playlists());
  readonly currentTrack = computed(() => this.music.current());
  readonly isPlaying = computed(() => this.music.playing());

  readonly formatDuration = formatDuration;

  /* Estados para Modal Álbum */
  readonly showAlbumModal = signal(false);
  readonly editingAlbumId = signal<string | null>(null);
  readonly albumTitle = signal('');
  readonly albumArtistId = signal('');
  readonly albumArtistName = signal('');
  readonly albumYear = signal(new Date().getFullYear());
  readonly albumCover = signal('');

  /* Estados para Modal Artista */
  readonly showArtistModal = signal(false);
  readonly editingArtistId = signal<string | null>(null);
  readonly artistName = signal('');
  readonly artistGenre = signal('');
  readonly artistYear = signal(new Date().getFullYear());

  play(track: Track): void {
    this.music.play(track, this.tracks());
  }

  playAlbum(album: Album): void {
    const albumTracks = this.tracks().filter((t) => t.albumId === album.id);
    if (albumTracks.length) {
      this.music.play(albumTracks[0], albumTracks);
      this.toast.show(`Reproduciendo álbum ${album.title}`);
    }
  }

  playArtist(artist: Artist): void {
    const artistTracks = this.tracks().filter((t) => t.artistId === artist.id);
    if (artistTracks.length) {
      this.music.play(artistTracks[0], artistTracks);
      this.toast.show(`Reproduciendo temas de ${artist.name}`);
    }
  }

  playPlaylist(playlist: Playlist): void {
    const pTracks = this.tracks().filter((t) => playlist.trackIds.includes(t.id));
    if (pTracks.length) {
      this.music.play(pTracks[0], pTracks);
      this.toast.show(`Reproduciendo playlist ${playlist.name}`);
    } else {
      this.toast.show('La lista está vacía', 'info');
    }
  }

  addTrack(): void {
    this.mediaForm.openTrack();
  }

  editTrack(tr: Track): void {
    this.mediaForm.open('track', { id: tr.id });
  }

  deleteTrack(tr: Track): void {
    if (confirm(`¿Eliminar la pista "${tr.title}"?`)) {
      this.store.dispatch({ type: 'DeleteTrackCommand', payload: tr.id });
      this.toast.show(`Pista "${tr.title}" eliminada.`, 'info');
    }
  }

  deletePlaylist(pl: Playlist): void {
    if (confirm(`¿Eliminar la playlist "${pl.name}"?`)) {
      this.store.dispatch({ type: 'DeletePlaylistCommand', payload: pl.id });
      this.toast.show(`Playlist "${pl.name}" eliminada.`, 'info');
    }
  }

  /* CRUD Álbum */
  openAlbumModal(al?: Album): void {
    if (al) {
      this.editingAlbumId.set(al.id);
      this.albumTitle.set(al.title);
      this.albumArtistId.set(al.artistId);
      this.albumArtistName.set(al.artistName);
      this.albumYear.set(al.year);
      this.albumCover.set(al.cover || al.title);
    } else {
      const firstArtist = this.artists()[0];
      this.editingAlbumId.set(null);
      this.albumTitle.set('');
      this.albumArtistId.set(firstArtist?.id || '');
      this.albumArtistName.set(firstArtist?.name || '');
      this.albumYear.set(new Date().getFullYear());
      this.albumCover.set('');
    }
    this.showAlbumModal.set(true);
  }

  onAlbumArtistSelect(e: Event): void {
    const id = (e.target as HTMLSelectElement).value;
    const ar = this.artists().find((a) => a.id === id);
    this.albumArtistId.set(id);
    this.albumArtistName.set(ar?.name || '');
  }

  saveAlbum(): void {
    const title = this.albumTitle().trim();
    if (!title) {
      this.toast.error('Introduce el título del álbum.');
      return;
    }
    const ar = this.artists().find((a) => a.id === this.albumArtistId()) || this.artists()[0];

    const albumData: Album = {
      id: this.editingAlbumId() || 'al-' + Date.now(),
      title,
      artistId: ar?.id || 'ar1',
      artistName: ar?.name || 'Artista desconocido',
      year: this.albumYear(),
      genre: ar?.genre || 'Música',
      cover: this.albumCover().trim() || title,
      trackIds: [],
      addedAt: new Date().toISOString(),
    };

    if (this.editingAlbumId()) {
      this.store.dispatch({ type: 'UpdateAlbumCommand', payload: albumData });
      this.toast.success(`Álbum "${title}" actualizado.`);
    } else {
      this.store.dispatch({ type: 'CreateAlbumCommand', payload: albumData });
      this.toast.success(`Álbum "${title}" creado exitosamente.`);
    }
    this.showAlbumModal.set(false);
  }

  deleteAlbum(al: Album): void {
    if (confirm(`¿Eliminar el álbum "${al.title}" y sus pistas asociadas?`)) {
      this.store.dispatch({ type: 'DeleteAlbumCommand', payload: al.id });
      this.toast.show(`Álbum "${al.title}" eliminado.`, 'info');
    }
  }

  /* CRUD Artista */
  openArtistModal(ar?: Artist): void {
    if (ar) {
      this.editingArtistId.set(ar.id);
      this.artistName.set(ar.name);
      this.artistGenre.set(ar.genre);
      this.artistYear.set(ar.year);
    } else {
      this.editingArtistId.set(null);
      this.artistName.set('');
      this.artistGenre.set('Pop / Rock');
      this.artistYear.set(new Date().getFullYear());
    }
    this.showArtistModal.set(true);
  }

  saveArtist(): void {
    const name = this.artistName().trim();
    if (!name) {
      this.toast.error('Introduce el nombre del artista.');
      return;
    }

    const artistData: Artist = {
      id: this.editingArtistId() || 'ar-' + Date.now(),
      name,
      genre: this.artistGenre().trim() || 'General',
      year: this.artistYear(),
      image: name,
      bio: `Artista de ${this.artistGenre().trim() || 'Música'}.`,
    };

    if (this.editingArtistId()) {
      this.store.dispatch({ type: 'UpdateArtistCommand', payload: artistData });
      this.toast.success(`Artista "${name}" actualizado.`);
    } else {
      this.store.dispatch({ type: 'CreateArtistCommand', payload: artistData });
      this.toast.success(`Artista "${name}" creado exitosamente.`);
    }
    this.showArtistModal.set(false);
  }

  deleteArtist(ar: Artist): void {
    if (confirm(`¿Eliminar el artista "${ar.name}" y todos sus álbumes?`)) {
      this.store.dispatch({ type: 'DeleteArtistCommand', payload: ar.id });
      this.toast.show(`Artista "${ar.name}" eliminado.`, 'info');
    }
  }

  createPlaylist(): void {
    this.dialogs
      .openWithResult<CrearPlaylistDialogComponent, PlaylistDraft | null>(CrearPlaylistDialogComponent)
      .result.then((result: PlaylistDraft | null) => {
        if (!result) return;
        const newPlaylist: Playlist = {
          id: 'pl-' + Date.now(),
          name: result.name,
          description: result.description,
          rules: result.rules,
          trackIds: [],
          cover: null,
        };
        this.store.dispatch({ type: 'CreatePlaylistCommand', payload: newPlaylist });
        this.toast.success(`Playlist "${result.name}" creada.`);
      });
  }
}
