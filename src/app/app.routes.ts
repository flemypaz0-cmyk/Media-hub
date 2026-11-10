import { Routes } from '@angular/router';

/**
 * Rutas de la aplicación. Cada módulo se carga de forma diferida para que el
 * bundle inicial solo incluya el shell y la vista de inicio.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  {
    path: 'inicio',
    title: 'Inicio · MediaHub',
    loadComponent: () => import('./features/inicio/inicio.component').then((m) => m.InicioComponent),
  },
  {
    path: 'series',
    title: 'Series · MediaHub',
    loadComponent: () => import('./features/series/series.component').then((m) => m.SeriesListComponent),
  },
  {
    path: 'series/:id',
    title: 'Detalle de serie · MediaHub',
    loadComponent: () => import('./features/series/series.component').then((m) => m.SeriesDetailComponent),
  },
  {
    path: 'videos',
    title: 'Vídeos · MediaHub',
    loadComponent: () => import('./features/videos/videos.component').then((m) => m.VideosListComponent),
  },
  {
    path: 'video/:id',
    title: 'Detalle de vídeo · MediaHub',
    loadComponent: () => import('./features/videos/videos.component').then((m) => m.VideoDetailComponent),
  },
  {
    path: 'musica',
    title: 'Música · MediaHub',
    loadComponent: () => import('./features/musica/musica.component').then((m) => m.MusicaComponent),
  },
  {
    path: 'galeria',
    title: 'Galería · MediaHub',
    loadComponent: () => import('./features/galeria/galeria.component').then((m) => m.GaleriaComponent),
  },
  {
    path: 'buscar',
    title: 'Búsqueda · MediaHub',
    loadComponent: () => import('./features/buscar/buscar.component').then((m) => m.BuscarComponent),
  },
  {
    path: 'taxonomia',
    title: 'Taxonomía · MediaHub',
    loadComponent: () => import('./features/taxonomia/taxonomia.component').then((m) => m.TaxonomiaComponent),
  },
  {
    path: 'estadisticas',
    title: 'Estadísticas · MediaHub',
    loadComponent: () =>
      import('./features/estadisticas/estadisticas.component').then((m) => m.EstadisticasComponent),
  },
  {
    path: 'biblioteca',
    title: 'Biblioteca · MediaHub',
    loadComponent: () => import('./features/biblioteca/biblioteca.component').then((m) => m.BibliotecaComponent),
  },
  {
    path: 'carga-masiva',
    title: 'Carga masiva · MediaHub',
    loadComponent: () =>
      import('./features/carga-masiva/carga-masiva.component').then((m) => m.CargaMasivaComponent),
  },
  {
    path: 'usuarios',
    title: 'Usuarios · MediaHub',
    loadComponent: () => import('./features/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
  },
  {
    path: 'notificaciones',
    title: 'Notificaciones · MediaHub',
    loadComponent: () =>
      import('./features/notificaciones/notificaciones.component').then((m) => m.NotificacionesComponent),
  },
  {
    path: 'admin',
    title: 'Administración · MediaHub',
    loadComponent: () => import('./features/admin/admin.component').then((m) => m.AdminComponent),
  },
  { path: '**', redirectTo: 'inicio' },
];
