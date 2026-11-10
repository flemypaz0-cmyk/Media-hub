import {
  Album,
  AppNotification,
  Artist,
  Category,
  MediaHubDataset,
  Playlist,
  Profile,
  Series,
  Track,
  Video,
} from '../models';

/**
 * Contrato de repositorio abstracto para el acceso a datos en MediaHub.
 *
 * Arquitectura:
 * - Implementación actual: `JsonMediaDataService` (consume /assets/data/mediahub-seed.json).
 * - Migración futura: Reemplazar por `DatabaseMediaDataService`, `PostgresMediaDataService`
 *   o `FirestoreMediaDataService` cambiando únicamente el provider en `app.config.ts`:
 *
 *   ```ts
 *   // Migración a Base de Datos en app.config.ts:
 *   { provide: MediaDataRepository, useClass: PostgresMediaDataService }
 *   ```
 */
export abstract class MediaDataRepository {
  /** Carga el dataset completo de arranque. */
  abstract loadDataset(): Promise<MediaHubDataset>;

  /** Catálogo de categorías. */
  abstract getCategories(): Promise<Category[]>;

  /** Catálogo de series con temporadas y episodios. */
  abstract getSeries(): Promise<Series[]>;

  /** Catálogo de películas y vídeos independientes. */
  abstract getVideos(): Promise<Video[]>;

  /** Catálogo musical: artistas, álbumes, pistas y playlists. */
  abstract getMusicCatalog(): Promise<{
    artists: Artist[];
    albums: Album[];
    tracks: Track[];
    playlists: Playlist[];
  }>;

  /** Perfiles de usuario y accesos. */
  abstract getProfiles(): Promise<Profile[]>;

  /** Notificaciones del sistema. */
  abstract getNotifications(): Promise<AppNotification[]>;

  /** Exporta el estado actual en formato JSON para copias de seguridad o volcados a base de datos. */
  abstract exportDataset(dataset: MediaHubDataset): string;
}
