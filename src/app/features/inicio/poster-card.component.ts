import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ArtComponent } from '../../shared/art.component';
import { IconComponent } from '../../shared/icon.component';
import { LibraryEntry } from '../../core/models';
import { formatDuration } from '../../core/util/format';
import { MediaHubStore } from '../../core/store/mediahub.store';

/**
 * Tarjeta de póster de la biblioteca (vídeo suelto o episodio).
 *
 * Muestra el póster generado con `<mh-art>`, preview en bucle sin audio al
 * pasar el ratón (hover preview), insignia de calidad, estado "visto",
 * barra de progreso, calificación y acciones de edición y favorito.
 */
@Component({
  selector: 'mh-poster-card',
  standalone: true,
  imports: [ArtComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './poster-card.component.html',
  styles: [
    `
      .poster-progress {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        margin: 0;
        border-radius: 0;
      }
      .hpv-video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 2;
        border-radius: inherit;
      }
    `,
  ],
})
export class PosterCardComponent {
  private readonly store = inject(MediaHubStore);

  readonly entry = input.required<LibraryEntry>();

  readonly opened = output<LibraryEntry>();
  readonly edited = output<LibraryEntry>();
  readonly favoriteToggled = output<LibraryEntry>();
  readonly hovered = output<{ entry: LibraryEntry; rect: DOMRect }>();
  readonly unhovered = output<void>();

  readonly showVideoPreview = signal(false);
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;

  /** Semilla del arte: el póster del contenido o, si no hay, su título. */
  readonly seed = computed(() => this.entry().poster || this.entry().title);

  /** Progreso en tanto por ciento (0-100). */
  readonly progress = computed(() => {
    const entry = this.entry();
    return entry.duration ? Math.min(100, (entry.progress / entry.duration) * 100) : 0;
  });

  /** Línea de metadatos: género y duración. */
  readonly meta = computed(() => {
    const entry = this.entry();
    const parts: string[] = [];
    if (entry.genre) parts.push(entry.genre);
    parts.push(formatDuration(entry.duration));
    return parts.join(' · ');
  });

  readonly isHoverPreviewEnabled = computed(() => {
    const prof = this.store.currentProfile();
    return prof?.preferences?.hoverPreview !== false;
  });

  onEnter(poster: HTMLElement): void {
    this.hovered.emit({ entry: this.entry(), rect: poster.getBoundingClientRect() });
    if (this.isHoverPreviewEnabled()) {
      this.hoverTimer = setTimeout(() => {
        this.showVideoPreview.set(true);
      }, 350);
    }
  }

  onLeave(): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
    this.showVideoPreview.set(false);
    this.unhovered.emit();
  }

  stop(event: Event): void {
    event.stopPropagation();
  }
}
