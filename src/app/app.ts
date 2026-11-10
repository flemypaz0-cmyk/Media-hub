import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MediaHubStore } from './core/store/mediahub.store';
import { ThemeService } from './core/services/theme.service';
import { DialogService } from './core/services/dialog.service';
import { ToastService } from './core/services/toast.service';
import { IconComponent } from './shared/icon.component';
import { ToastHostComponent } from './shared/toast-host.component';
import { VideoPlayerComponent } from './player/video-player.component';
import { MusicPlayerComponent } from './player/music-player.component';
import { formatBytes } from './core/util/format';

interface NavEntry {
  path: string;
  label: string;
  icon: string;
}

interface NavGroup {
  title: string;
  items: NavEntry[];
}

/**
 * Shell de la aplicación: rail lateral, barra superior y área de contenido.
 * La barra lateral se colapsa a iconos en escritorio y se comporta como cajón
 * fuera de pantalla en pantallas estrechas.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, ToastHostComponent, VideoPlayerComponent, MusicPlayerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  private readonly store = inject(MediaHubStore);
  private readonly theme = inject(ThemeService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly NARROW = 900;

  readonly groups: NavGroup[] = [
    {
      title: '',
      items: [
        { path: '/inicio', label: 'Inicio', icon: 'home' },
        { path: '/series', label: 'Series', icon: 'tv' },
        { path: '/videos', label: 'Vídeos', icon: 'film' },
        { path: '/musica', label: 'Música', icon: 'music' },
        { path: '/galeria', label: 'Galería', icon: 'folder' },
      ],
    },
    {
      title: 'Explorar',
      items: [
        { path: '/buscar', label: 'Buscar', icon: 'search' },
        { path: '/taxonomia', label: 'Taxonomía', icon: 'tag' },
        { path: '/estadisticas', label: 'Estadísticas', icon: 'chart' },
      ],
    },
    {
      title: 'Sistema',
      items: [
        { path: '/biblioteca', label: 'Biblioteca', icon: 'server' },
        { path: '/usuarios', label: 'Usuarios', icon: 'users' },
        { path: '/notificaciones', label: 'Notificaciones', icon: 'bell' },
        { path: '/admin', label: 'Administración', icon: 'settings' },
      ],
    },
  ];

  readonly search = signal('');
  readonly narrow = signal(false);
  readonly menuOpen = signal(false);
  readonly menuCollapsed = signal(false);

  readonly profile = computed(() => this.store.currentProfile());
  readonly unread = computed(() => this.store.unreadNotifications());
  readonly storagePercent = computed(() => this.store.storagePercent());
  readonly storageUsed = computed(() => formatBytes(this.store.storageUsed()));
  readonly storageTotal = computed(() => formatBytes(this.store.storageTotal()));
  readonly themeLabel = computed(() => {
    const mode = this.theme.mode();
    return mode === 'auto' ? 'Automático' : mode === 'light' ? 'Claro' : 'Oscuro';
  });

  constructor() {
    this.narrow.set(window.innerWidth <= this.NARROW);
    this.menuCollapsed.set(this.store.state().menuCollapsed);
    this.applyMenuState();

    window.addEventListener('resize', () => {
      const narrow = window.innerWidth <= this.NARROW;
      const changed = narrow !== this.narrow();
      this.narrow.set(narrow);
      if (changed) this.closeMenu();
      this.applyMenuState();
    });

    document.addEventListener('keydown', (event) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (event.key === '/' && !typing) {
        event.preventDefault();
        document.getElementById('globalSearch')?.focus();
      }
      if (event.key === 'Escape') {
        if (this.dialogs.closeTop()) return;
        if (this.narrow()) this.closeMenu();
        else this.expandRail();
      }
    });
  }

  /* ----------------------------- menú lateral ----------------------------- */

  toggleMenu(): void {
    if (this.narrow()) {
      this.menuOpen.update((v) => !v);
    } else {
      this.menuCollapsed.update((v) => !v);
    }
    this.applyMenuState();
  }

  closeMenu(): void {
    if (!this.narrow()) return;
    this.menuOpen.set(false);
    this.applyMenuState();
  }

  expandRail(): void {
    if (this.narrow()) return;
    this.menuCollapsed.set(false);
    this.applyMenuState();
  }

  private applyMenuState(): void {
    const collapsed = !this.narrow() && this.menuCollapsed();
    document.body.classList.toggle('nav-collapsed', collapsed);
    document.body.classList.toggle('nav-open', this.narrow() && this.menuOpen());
    this.store.dispatch({
      type: 'SetStateCommand',
      payload: { menuCollapsed: this.menuCollapsed(), menuOpen: this.narrow() ? this.menuOpen() : false },
    });
  }

  /* ------------------------------- acciones ------------------------------- */

  onSearch(value: string): void {
    this.search.set(value);
    this.router.navigate(['/buscar'], { queryParams: value ? { q: value } : {} });
  }

  cycleTheme(): void {
    this.theme.cycle();
    this.toast.show('Tema: ' + this.themeLabel(), 'info');
  }

  toggleLang(): void {
    const next = this.store.state().lang === 'es' ? 'en' : 'es';
    this.store.dispatch({ type: 'SetLangCommand', payload: next });
    this.toast.show(next === 'es' ? 'Idioma: Español' : 'Language: English (UI completa en español en esta demo)', 'info');
  }

  openNotifications(): void {
    this.router.navigate(['/notificaciones']);
  }

  /** Menú "Agregar contenido": altas y operaciones de biblioteca. */
  openAddMenu(): void {
    const options: { id: string; title: string; detail: string; icon: string; route: string }[] = [
      {
        id: 'video',
        title: 'Vídeo suelto',
        detail: 'Agregar un vídeo independiente a la biblioteca',
        icon: 'film',
        route: '/videos',
      },
      {
        id: 'episode',
        title: 'Episodio de serie',
        detail: 'Agregar un episodio a una serie existente',
        icon: 'tv',
        route: '/series',
      },
      {
        id: 'serie',
        title: 'Serie nueva',
        detail: 'Crear la ficha de una serie sin episodios',
        icon: 'playlist',
        route: '/series',
      },
      {
        id: 'track',
        title: 'Pista de música',
        detail: 'Agregar una pista a tu biblioteca musical',
        icon: 'music',
        route: '/musica',
      },
      {
        id: 'bulk',
        title: 'Carga masiva desde carpeta',
        detail: 'Explorar una carpeta e importar varios vídeos',
        icon: 'server',
        route: '/carga-masiva',
      },
    ];

    this.dialogs.open(AddContentDialogComponent, { options });
  }

  /** Cambio de perfil de usuario. */
  openProfileMenu(): void {
    this.dialogs.open(ProfileMenuDialogComponent, { profiles: this.store.profiles(), currentId: this.store.state().currentProfileId });
  }
}

/* ==================================================================== */
/*                    Diálogos auxiliares del shell                      */
/* ==================================================================== */

@Component({
  selector: 'mh-add-content-dialog',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-scrim" (click)="close()">
      <div class="dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <div class="dlg-head">
          <h2>Agregar contenido</h2>
          <button class="icon-btn" aria-label="Cerrar" (click)="close()"><mh-icon name="close" /></button>
        </div>
        <div class="dlg-body">
          <div class="pp-list">
            @for (opt of data().options; track opt.id) {
              <button class="pp-opt" type="button" (click)="pick(opt.route)">
                <mh-icon [name]="opt.icon" [size]="20" />
                <span class="pp-opt-tx">
                  <b>{{ opt.title }}</b>
                  <span>{{ opt.detail }}</span>
                </span>
              </button>
            }
          </div>
        </div>
        <div class="dlg-foot">
          <button class="btn btn-text" type="button" (click)="close()">Cerrar</button>
        </div>
      </div>
    </div>
  `,
})
export class AddContentDialogComponent {
  readonly data = input.required<{ options: { id: string; title: string; detail: string; icon: string; route: string }[] }>();
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);

  close(): void {
    this.dialogs.closeTop();
  }

  pick(route: string): void {
    this.close();
    this.router.navigateByUrl(route);
  }
}

@Component({
  selector: 'mh-profile-menu-dialog',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-scrim" (click)="close()">
      <div class="dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <div class="dlg-head">
          <h2>Perfiles</h2>
          <button class="icon-btn" aria-label="Cerrar" (click)="close()"><mh-icon name="close" /></button>
        </div>
        <div class="dlg-body">
          <div class="pp-list">
            @for (p of data().profiles; track p.id) {
              <button class="pp-opt" [class.sel]="p.id === data().currentId" type="button" (click)="switchTo(p.id)">
                <span class="avatar" [style.background]="p.color" style="color: #fff">{{ p.avatar }}</span>
                <span class="pp-opt-tx">
                  <b>{{ p.name }}</b>
                  <span>{{ roleLabel(p.role) }}</span>
                </span>
              </button>
            }
          </div>
        </div>
        <div class="dlg-foot">
          <button class="btn btn-text" type="button" (click)="close()">Cerrar</button>
        </div>
      </div>
    </div>
  `,
})
export class ProfileMenuDialogComponent {
  readonly data = input.required<{ profiles: { id: string; name: string; role: string; avatar: string; color: string }[]; currentId: string }>();
  private readonly dialogs = inject(DialogService);
  private readonly store = inject(MediaHubStore);

  roleLabel(role: string): string {
    return role === 'admin' ? 'Administrador' : role === 'child' ? 'Infantil' : 'Usuario';
  }

  switchTo(id: string): void {
    this.store.dispatch({ type: 'SwitchProfileCommand', payload: id });
    this.close();
  }

  close(): void {
    this.dialogs.closeTop();
  }
}
