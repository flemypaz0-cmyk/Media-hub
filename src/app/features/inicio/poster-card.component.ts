import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ArtComponent } from '../../shared/art.component';
import { IconComponent } from '../../shared/icon.component';
import { LibraryEntry } from '../../core/models';
import { formatDuration } from '../../core/util/format';

/**
 * Tarjeta de póster de la biblioteca (vídeo suelto o episodio).
 *
 * Muestra el póster generado con `<mh-art>`, la insignia de calidad, el estado
 * "visto", la barra de progreso y las acciones de edición y favorito.
 */
@Component({
  selector: 'mh-poster-card',
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
    `,
  ],
})
export class PosterCardComponent {
  readonly entry = input.required<LibraryEntry>();

  readonly opened = output<LibraryEntry>();
  readonly edited = output<LibraryEntry>();
  readonly favoriteToggled = output<LibraryEntry>();
  readonly hovered = output<{ entry: LibraryEntry; rect: DOMRect }>();
  readonly unhovered = output<void>();

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

  onEnter(poster: HTMLElement): void {
    this.hovered.emit({ entry: this.entry(), rect: poster.getBoundingClientRect() });
  }

  stop(event: Event): void {
    event.stopPropagation();
  }
}
