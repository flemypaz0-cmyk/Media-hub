import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MediaDataRepository } from './media-data.repository';
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
import {
  ACTIVITY_LOG,
  ALBUMS,
  ARTISTS,
  CATEGORIES,
  DUPLICATES,
  IGNORED_FILES,
  LIBRARY_FOLDERS,
  NOTIFICATIONS,
  PLAYLISTS,
  PROFILES,
  SERVER_SETTINGS,
  SERVER_STATUS,
  SERIES,
  TAGS,
  TRACKS,
  VIDEOS,
} from '../data/seed-data';

const JSON_DATA_URL = '/assets/data/mediahub-seed.json';

/**
 * Servicio encargado de proveer los datos estáticos de la aplicación
 * cargados desde `/assets/data/mediahub-seed.json`.
 *
 * Implementa `MediaDataRepository` para permitir una transición limpia y
 * desacoplada hacia una base de datos real (PostgreSQL, MySQL, SQLite, Firestore, etc.).
 */
@Injectable({
  providedIn: 'root',
})
export class MediaDataService implements MediaDataRepository {
  private readonly http = inject(HttpClient);

  readonly dataset = signal<MediaHubDataset | null>(null);
  readonly loaded = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  private cachedPromise: Promise<MediaHubDataset> | null = null;

  /**
   * Carga el archivo JSON estático con reintento y fallback local en memoria.
   */
  async loadDataset(): Promise<MediaHubDataset> {
    if (this.dataset()) {
      return this.dataset()!;
    }

    if (this.cachedPromise) {
      return this.cachedPromise;
    }

    this.cachedPromise = (async () => {
      try {
        const data = await firstValueFrom(this.http.get<MediaHubDataset>(JSON_DATA_URL));
        this.dataset.set(data);
        this.loaded.set(true);
        this.error.set(null);
        return data;
      } catch (err) {
        console.warn(
          'No se pudo cargar mediahub-seed.json vía HTTP; usando dataset de respaldo en memoria.',
          err,
        );
        const fallback = this.createFallbackDataset();
        this.dataset.set(fallback);
        this.loaded.set(true);
        this.error.set(err instanceof Error ? err.message : String(err));
        return fallback;
      }
    })();

    return this.cachedPromise;
  }

  async getCategories(): Promise<Category[]> {
    const data = await this.loadDataset();
    return data.categories;
  }

  async getSeries(): Promise<Series[]> {
    const data = await this.loadDataset();
    return data.series;
  }

  async getVideos(): Promise<Video[]> {
    const data = await this.loadDataset();
    return data.videos;
  }

  async getMusicCatalog(): Promise<{
    artists: Artist[];
    albums: Album[];
    tracks: Track[];
    playlists: Playlist[];
  }> {
    const data = await this.loadDataset();
    return {
      artists: data.artists,
      albums: data.albums,
      tracks: data.tracks,
      playlists: data.playlists,
    };
  }

  async getProfiles(): Promise<Profile[]> {
    const data = await this.loadDataset();
    return data.profiles;
  }

  async getNotifications(): Promise<AppNotification[]> {
    const data = await this.loadDataset();
    return data.notifications;
  }

  /**
   * Serializa el dataset a formato JSON para exportación, backups o migraciones a base de datos.
   */
  exportDataset(data: MediaHubDataset): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Respaldo en memoria que replica la estructura del JSON para garantizar
   * tolerancia a fallos offline.
   */
  createFallbackDataset(): MediaHubDataset {
    return {
      version: '1.0.0',
      description: 'Fallback local en memoria generado a partir de seed-data.',
      exportedAt: new Date().toISOString(),
      categories: JSON.parse(JSON.stringify(CATEGORIES)),
      tags: JSON.parse(JSON.stringify(TAGS)),
      series: JSON.parse(JSON.stringify(SERIES)),
      videos: JSON.parse(JSON.stringify(VIDEOS)),
      artists: JSON.parse(JSON.stringify(ARTISTS)),
      albums: JSON.parse(JSON.stringify(ALBUMS)),
      tracks: JSON.parse(JSON.stringify(TRACKS)),
      playlists: JSON.parse(JSON.stringify(PLAYLISTS)),
      folders: JSON.parse(JSON.stringify(LIBRARY_FOLDERS)),
      ignored: JSON.parse(JSON.stringify(IGNORED_FILES)),
      duplicates: JSON.parse(JSON.stringify(DUPLICATES)),
      profiles: JSON.parse(JSON.stringify(PROFILES)),
      notifications: JSON.parse(JSON.stringify(NOTIFICATIONS)),
      activity: JSON.parse(JSON.stringify(ACTIVITY_LOG)),
      settings: JSON.parse(JSON.stringify(SERVER_SETTINGS)),
      serverStatus: JSON.parse(JSON.stringify(SERVER_STATUS)),
    };
  }
}
