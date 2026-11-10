# Guía de Arquitectura de Datos y Migración a Base de Datos (MediaHub)

Esta guía explica cómo se encuentra desacoplada la capa de datos estáticos en **MediaHub** y los pasos sencillos para migrar el sistema a una **Base de Datos Relacional (PostgreSQL, MySQL, SQLite)** o **NoSQL (Firestore, MongoDB)**.

---

## 1. Estructura de Desacoplamiento Actual

Para evitar que los datos estén "incrustados" o mezclados en el código de componentes o vistas, la arquitectura sigue el patrón **Repository / Data Source**:

1. **Archivo de Datos Estáticos (JSON)**:
   - Ruta física: `public/assets/data/mediahub-seed.json`
   - Ruta en servidor web: `/assets/data/mediahub-seed.json`
   - Contiene todo el catálogo semilla: `categories`, `series`, `seasons`, `episodes`, `videos`, `artists`, `albums`, `tracks`, `playlists`, `profiles`, `settings`, etc.

2. **Contrato de Repositorio (`MediaDataRepository`)**:
   - Archivo: `src/app/core/services/media-data.repository.ts`
   - Define los métodos abstractos que cualquier fuente de datos debe cumplir (`loadDataset()`, `getCategories()`, `getSeries()`, `getVideos()`, `getMusicCatalog()`, etc.).

3. **Servicio Consumidor de Datos (`MediaDataService`)**:
   - Archivo: `src/app/core/services/media-data.service.ts`
   - Implementa `MediaDataRepository` consumiendo el archivo JSON mediante `HttpClient`.
   - Incluye mecanismo de respaldo en memoria tolerante a fallos (*fallback offline*).

4. **Gestión de Estado Centralizada (`MediaHubStore`)**:
   - Archivo: `src/app/core/store/mediahub.store.ts`
   - Consume `MediaDataService` para hidratar la biblioteca y mantener las señales reactivas para la interfaz de usuario.
   - Dispone del método `resetToSeedData()` para recargar el JSON en cualquier momento desde la sección de Administración.

---

## 2. Paso a Paso para Migrar a una Base de Datos (Ej: PostgreSQL / MySQL)

### Paso A: Crear el Esquema de Tablas (DDL)

El archivo `mediahub-seed.json` mapea directamente a un esquema relacional normalizado:

```sql
-- 1. Categorías
CREATE TABLE categories (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(16)
);

-- 2. Vídeos y Películas
CREATE TABLE videos (
    id VARCHAR(32) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    synopsis TEXT,
    category_id VARCHAR(32) REFERENCES categories(id),
    genre VARCHAR(64),
    year INT,
    duration INT,
    quality VARCHAR(32),
    resolution VARCHAR(32),
    video_codec VARCHAR(32),
    audio_codec VARCHAR(32),
    size_bytes BIGINT,
    path VARCHAR(500),
    added_at TIMESTAMP,
    watched BOOLEAN DEFAULT FALSE,
    progress FLOAT DEFAULT 0,
    favorite BOOLEAN DEFAULT FALSE,
    rating FLOAT
);

-- 3. Series de TV
CREATE TABLE series (
    id VARCHAR(32) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    synopsis TEXT,
    genre VARCHAR(64),
    year INT,
    rating FLOAT,
    favorite BOOLEAN DEFAULT FALSE
);

-- 4. Temporadas y Episodios
CREATE TABLE seasons (
    id VARCHAR(32) PRIMARY KEY,
    series_id VARCHAR(32) REFERENCES series(id) ON DELETE CASCADE,
    season_number INT NOT NULL,
    title VARCHAR(255)
);

CREATE TABLE episodes (
    id VARCHAR(32) PRIMARY KEY,
    season_id VARCHAR(32) REFERENCES seasons(id) ON DELETE CASCADE,
    episode_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    duration INT,
    path VARCHAR(500),
    watched BOOLEAN DEFAULT FALSE
);

-- 5. Música (Artistas, Álbumes y Pistas)
CREATE TABLE artists (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    genre VARCHAR(64),
    year INT
);

CREATE TABLE albums (
    id VARCHAR(32) PRIMARY KEY,
    artist_id VARCHAR(32) REFERENCES artists(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    year INT,
    cover VARCHAR(255)
);

CREATE TABLE tracks (
    id VARCHAR(32) PRIMARY KEY,
    album_id VARCHAR(32) REFERENCES albums(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    duration INT NOT NULL,
    track_number INT,
    path VARCHAR(500)
);
```

---

### Paso B: Script de Carga Inicial (Seeding a la Base de Datos)

Puedes poblar tu base de datos automáticamente ejecutando un script en Node.js que lea directamente `mediahub-seed.json`:

```typescript
// scripts/seed-database.ts
import * as fs from 'fs';
import { Pool } from 'pg'; // o tu cliente ORM preferido (Prisma, Drizzle, TypeORM, Knex)

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const raw = fs.readFileSync('./public/assets/data/mediahub-seed.json', 'utf-8');
  const data = JSON.parse(raw);

  // Insertar Categorías
  for (const cat of data.categories) {
    await pool.query(
      'INSERT INTO categories (id, name, color) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
      [cat.id, cat.name, cat.color]
    );
  }

  // Insertar Vídeos
  for (const v of data.videos) {
    await pool.query(
      'INSERT INTO videos (id, title, synopsis, category_id, genre, year, duration, path) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING',
      [v.id, v.title, v.synopsis, v.categoryId, v.genre, v.year, v.duration, v.path]
    );
  }

  console.log('¡Base de datos migrada y poblada con éxito desde mediahub-seed.json!');
}

seed();
```

---

### Paso C: Conectar Angular a tu API de Base de Datos

Crea tu nueva clase de servicio que implemente `MediaDataRepository`:

```typescript
// src/app/core/services/database-media-data.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MediaDataRepository } from './media-data.repository';
import { MediaHubDataset, Series, Video, Category } from '../models';

@Injectable({ providedIn: 'root' })
export class DatabaseMediaDataService implements MediaDataRepository {
  private readonly http = inject(HttpClient);
  private readonly API_BASE = '/api'; // Backend Node/Express/Spring Boot con PostgreSQL

  async loadDataset(): Promise<MediaHubDataset> {
    return firstValueFrom(this.http.get<MediaHubDataset>(`${this.API_BASE}/bootstrap`));
  }

  async getCategories(): Promise<Category[]> {
    return firstValueFrom(this.http.get<Category[]>(`${this.API_BASE}/categories`));
  }

  async getSeries(): Promise<Series[]> {
    return firstValueFrom(this.http.get<Series[]>(`${this.API_BASE}/series`));
  }

  async getVideos(): Promise<Video[]> {
    return firstValueFrom(this.http.get<Video[]>(`${this.API_BASE}/videos`));
  }

  // ... resto de métodos del contrato
}
```

### Paso D: Reemplazar el Proveedor en `app.config.ts`

En `src/app/app.config.ts`, simplemente cambia el provider sin tocar ninguna pantalla:

```typescript
// src/app/app.config.ts
import { MediaDataRepository } from './core/services/media-data.repository';
import { DatabaseMediaDataService } from './core/services/database-media-data.service';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... otros providers
    { provide: MediaDataRepository, useClass: DatabaseMediaDataService },
  ],
};
```

¡Listo! Todas las pantallas (`/inicio`, `/series`, `/videos`, `/musica`, etc.) seguirán funcionando exactamente igual sin haber tenido que modificar sus componentes.
