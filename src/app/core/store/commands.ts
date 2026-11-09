/**
 * Comandos del store (lado command de CQRS).
 *
 * Cada comando tiene el nombre del mensaje que el backend Spring Boot
 * publicaría por su bus de comandos, de modo que sustituir el store local
 * por llamadas HTTP sea un cambio mecánico.
 */

import {
  Category,
  Episode,
  IgnoredFile,
  LibraryFolder,
  Playlist,
  Profile,
  ServerSettings,
  Series,
  Track,
  Video,
} from '../models';

export interface SetStateCommand {
  type: 'SetStateCommand';
  payload: Partial<import('../models').MediaHubState>;
}

export type Command =
  | SetStateCommand
  /* contenido */
  | { type: 'CreateVideoCommand'; payload: Video }
  | { type: 'UpdateVideoCommand'; payload: Partial<Video> & { id: string } }
  | { type: 'DeleteVideoCommand'; payload: string }
  | { type: 'MarkVideoWatchedCommand'; payload: string }
  | { type: 'MarkVideoUnwatchedCommand'; payload: string }
  | { type: 'RateVideoCommand'; payload: { id: string; rating: number } }
  | { type: 'ToggleFavoriteCommand'; payload: { id: string } }
  | { type: 'UpdateProgressCommand'; payload: { id: string; progress: number } }
  /* series */
  | { type: 'CreateSeriesCommand'; payload: Series }
  | { type: 'UpdateSeriesCommand'; payload: Partial<Series> & { id: string } }
  | { type: 'AddEpisodeCommand'; payload: { seriesId: string; seasonId: string; episode: Episode } }
  | { type: 'UpdateEpisodeCommand'; payload: { seriesId: string; episode: Partial<Episode> & { id: string } } }
  | { type: 'MarkEpisodeWatchedCommand'; payload: { seriesId: string; episodeId: string } }
  | { type: 'SetEpisodeOrderCommand'; payload: { seriesId: string; episodeId: string; number: number } }
  /* taxonomía */
  | { type: 'CreateCategoryCommand'; payload: Omit<Category, 'id'> }
  | { type: 'UpdateCategoryCommand'; payload: Partial<Category> & { id: string } }
  | { type: 'DeleteCategoryCommand'; payload: string }
  | { type: 'CreateTagCommand'; payload: string }
  | { type: 'DeleteTagCommand'; payload: string }
  | { type: 'AssignCategoryCommand'; payload: { id: string; categoryId: string | null } }
  | { type: 'AssignTagsCommand'; payload: { id: string; tags: string[] } }
  /* música */
  | { type: 'AddTrackCommand'; payload: Track }
  | { type: 'PlayTrackCommand'; payload: string }
  | { type: 'RateTrackCommand'; payload: { id: string; rating: number } }
  | { type: 'CreatePlaylistCommand'; payload: Playlist }
  | { type: 'AddToPlaylistCommand'; payload: { playlistId: string; trackId: string } }
  | { type: 'RemoveFromPlaylistCommand'; payload: { playlistId: string; trackId: string } }
  | { type: 'ReorderPlaylistCommand'; payload: { playlistId: string; trackIds: string[] } }
  /* biblioteca */
  | { type: 'RegisterFolderCommand'; payload: LibraryFolder }
  | { type: 'RemoveFolderCommand'; payload: string }
  | { type: 'ScanLibraryCommand'; payload: string }
  | { type: 'IgnoreFileCommand'; payload: { name: string; path: string; reason?: string } }
  | { type: 'ResolveDuplicateCommand'; payload: string }
  | { type: 'MoveFilesCommand'; payload: { ids: string[]; dest: string } }
  | { type: 'CopyFilesCommand'; payload: { ids: string[]; dest: string } }
  | { type: 'BatchRenameCommand'; payload: { id: string; template: string; index: number } }
  | { type: 'TrashFilesCommand'; payload: { ids: string[] } }
  | { type: 'RestoreFileCommand'; payload: string }
  | { type: 'DeletePermanentCommand'; payload: string }
  | { type: 'CreateFolderCommand'; payload: { name: string; path: string; scope?: string } }
  | { type: 'DeleteFolderCommand'; payload: { id: string } }
  | { type: 'ToggleHiddenCommand'; payload: { id: string } }
  /* usuarios */
  | { type: 'UpdateProfileCommand'; payload: Partial<Profile> & { id: string } }
  | { type: 'CreateProfileCommand'; payload: Profile }
  | { type: 'DeleteProfileCommand'; payload: string }
  | { type: 'SwitchProfileCommand'; payload: string }
  | { type: 'SetPreferencesCommand'; payload: { id?: string; preferences: Partial<Profile['preferences']> } }
  /* sistema */
  | { type: 'ReadNotificationCommand'; payload: string }
  | { type: 'DismissNotificationCommand'; payload: string }
  | { type: 'UpdateSettingsCommand'; payload: Partial<ServerSettings> }
  | { type: 'LogActivityCommand'; payload: { module: string; command: string; detail: string; user?: string } }
  | { type: 'ToggleThemeCommand'; payload?: undefined }
  | { type: 'SetLangCommand'; payload: string };
