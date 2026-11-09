/* =====================================================================
   MediaHub — Views
   One renderer per route. Views are pure-ish: they read from the store
   and dispatch actions through the store (CQRS mirroring).
   ===================================================================== */
(function (global) {
  'use strict';

  const { $, $$, toast, escapeHtml: esc, formatBytes, formatDuration, timeAgo } = UI;

  /* ---------------- shared partials ---------------- */
  function posterCard(item, opts) {
    opts = opts || {};
    const isSeries = item.kind === 'series';
    const progress = item.duration ? Math.min(100, (item.progress / item.duration) * 100) : 0;
    const badge = isSeries
      ? '<span class="badge badge-tl">' + (item.seasons ? item.seasons.length : 0) + ' temp.</span>'
      : (item.quality ? '<span class="badge badge-tl res">' + esc(item.quality) + '</span>' : '');
    const watched = item.watched ? '<span class="badge badge-br">' + Icons.svg('check', 13) + '</span>' : '';
    const sub = isSeries
      ? (item.genre || '') + ' · ' + (item.year || '')
      : (item.genre || '') + ' · ' + formatDuration(item.duration);
    return '' +
      '<article class="card" tabindex="0" data-open="' + esc(item.id) + '" data-kind="' + (isSeries ? 'series' : 'video') + '">' +
        '<div class="card-poster">' +
          '<div class="ph" style="background-image:url(' + (item.poster || '') + ')"><span>' + esc(item.title) + '</span></div>' +
          badge + watched +
          (progress > 1 ? '<div class="progress-line" style="position:absolute;left:0;right:0;bottom:0;margin:0;border-radius:0"><i style="width:' + progress + '%"></i></div>' : '') +
          '<div class="card-actions">' +
            '<button class="icon-btn" data-act="edit" data-id="' + esc(item.id) + '" aria-label="Editar" title="Editar">' + Icons.svg('edit', 18) + '</button>' +
            '<button class="icon-btn" data-act="fav" data-id="' + esc(item.id) + '" aria-label="Favorito" title="Favorito">' + Icons.svg('heart', 18) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="card-title">' + esc(item.title) + '</div>' +
          '<div class="card-meta">' + esc(sub) + '</div>' +
        '</div>' +
      '</article>';
  }

  function wideCard(item) {
    const p = item.duration ? Math.min(100, (item.progress / item.duration) * 100) : 0;
    return '' +
      '<article class="card card-wide" tabindex="0" data-open="' + esc(item.id) + '" data-kind="' + (item.kind === 'series' ? 'series' : 'video') + '">' +
        '<div class="cw-thumb" style="background-image:url(' + (item.thumbnail || '') + ')">' +
          (item.watched ? '<span class="badge top">' + Icons.svg('check', 13) + '</span>' : '') +
        '</div>' +
        '<div class="cw-meta">' +
          '<div class="cw-title">' + esc(item.title) + '</div>' +
          '<div class="cw-sub">' + esc(item.seriesTitle ? item.seriesTitle + ' · T' + item.seasonNumber + 'E' + item.number : (item.genre || '')) + ' · ' + formatDuration(item.duration) + '</div>' +
          (p > 1 ? '<div class="progress-line"><i style="width:' + p + '%"></i></div>' : '') +
        '</div>' +
        '<button class="icon-btn" data-act="play" data-id="' + esc(item.id) + '" aria-label="Reproducir">' + Icons.svg('play', 22) + '</button>' +
      '</article>';
  }

  function stars(n) {
    let out = '<span class="stars">';
    for (let i = 1; i <= 5; i++) out += Icons.svg('star', 15).replace('<svg', '<svg class="' + (i <= n ? 'on' : '') + '"');
    return out + '</span>';
  }

  function sectionHead(title, count, actionsHtml) {
    return '<div class="section-head"><h2 class="section-title">' + esc(title) + '</h2>' +
      (count != null ? '<span class="section-count">' + count + '</span>' : '') +
      '<div class="section-actions">' + (actionsHtml || '') + '</div></div>';
  }

  function rail(items, renderFn) {
    if (!items.length) return '';
    return '<div class="rail">' + items.map(renderFn).join('') + '</div>';
  }

  function emptyState(icon, title, text, ctaHtml) {
    return '<div class="empty-state"><div class="es-ic">' + Icons.svg(icon, 32) + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (ctaHtml || '') + '</div>';
  }

  function albumCount(state, artistId) {
    const n = state.albums.filter(function (al) { return al.artistId === artistId; }).length;
    return n + (n === 1 ? ' álbum' : ' álbumes');
  }

  function categoryName(id) {
    const c = Store.state.categories.find(function (x) { return x.id === id; });
    return c ? c.name : 'Sin categoría';
  }

  /* ================= INICIO ================= */
  function viewInicio() {
    const s = Store.state;
    const cont = Store.selectors.continueWatching(s);
    const rec = Store.selectors.recentlyAdded(s);
    const fav = Store.selectors.favorites(s);
    const recs = Store.selectors.recommendations(s);

    return '' +
      '<div class="page-head">' +
        '<div><h1 class="page-title">Hola, ' + esc(Store.selectors.currentProfile(s).name) + '</h1>' +
        '<p class="page-sub">Tu biblioteca local está lista. Continúa donde lo dejaste.</p></div>' +
        '<div class="page-head-actions">' +
          '<button class="btn btn-tonal" data-nav-go="buscar">' + Icons.svg('search', 18) + 'Buscar</button>' +
          '<button class="btn btn-filled" data-act="add">' + Icons.svg('plus', 18) + 'Agregar contenido</button>' +
        '</div>' +
      '</div>' +

      (cont.length ? '<section class="section">' + sectionHead('Continuar viendo', cont.length) + rail(cont, wideCard) + '</section>' : '') +

      '<section class="section">' + sectionHead('Agregados recientemente', rec.length) +
        '<div class="grid poster">' + rec.slice(0, 12).map(function (v) { return posterCard(v); }).join('') + '</div></section>' +

      (fav.length ? '<section class="section">' + sectionHead('Tus favoritos', fav.length) +
        '<div class="grid poster">' + fav.slice(0, 12).map(posterCard).join('') + '</div></section>' : '') +

      (recs.length ? '<section class="section">' + sectionHead('Recomendaciones para ti') +
        '<div class="grid row">' + recs.slice(0, 8).map(function (t) {
          return '<article class="card card-wide" data-track="' + esc(t.id) + '">' +
            '<div class="cw-thumb" style="background-image:url(' + (t.cover || '') + ')"></div>' +
            '<div class="cw-meta"><div class="cw-title">' + esc(t.title) + '</div>' +
            '<div class="cw-sub">' + esc(t.artistName) + ' · ' + esc(t.albumTitle) + '</div></div>' +
            '<button class="icon-btn" data-act="play-track" data-id="' + esc(t.id) + '">' + Icons.svg('play', 22) + '</button>' +
          '</article>';
        }).join('') + '</div></section>' : '');
  }

  /* ================= SERIES ================= */
  function viewSeriesList() {
    const list = Store.state.series;
    return '' +
      '<div class="page-head">' +
        '<div><h1 class="page-title">Series</h1><p class="page-sub">' + list.length + ' fichas · ' +
          list.reduce(function (a, s) { return a + s.seasons.reduce(function (b, sn) { return b + sn.episodes.length; }, 0); }, 0) + ' episodios</p></div>' +
        '<div class="page-head-actions">' +
          '<button class="btn btn-tonal" data-act="sort-episodes">' + Icons.svg('sort', 18) + 'Ordenar episodios</button>' +
          '<button class="btn btn-filled" data-act="add-series">' + Icons.svg('plus', 18) + 'Nueva serie</button>' +
        '</div>' +
      '</div>' +
      (list.length
        ? '<div class="grid poster">' + list.map(function (s) { return posterCard(Object.assign({ kind: 'series' }, s)); }).join('') + '</div>'
        : emptyState('tv', 'Sin series', 'Crea la ficha de una serie y luego añade sus episodios.'));
  }

  function viewSeriesDetail(id) {
    const s = Store.state.series.find(function (x) { return x.id === id; });
    if (!s) return emptyState('warning', 'Serie no encontrada', 'La serie solicitada no existe en la biblioteca.');
    const totalEps = s.seasons.reduce(function (a, sn) { return a + sn.episodes.length; }, 0);
    const watched = s.seasons.reduce(function (a, sn) { return a + sn.episodes.filter(function (e) { return e.watched; }).length; }, 0);

    return '' +
      '<div class="detail">' +
        '<div>' +
          '<div class="detail-poster"><div class="ph" style="background-image:url(' + s.poster + ')"><span>' + esc(s.title) + '</span></div></div>' +
          '<div style="display:flex;gap:8px;margin-top:12px">' +
            '<button class="btn btn-tonal" data-act="fav-series" data-id="' + s.id + '">' + Icons.svg('heart', 18) + (s.favorite ? 'Quitar favorito' : 'Favorito') + '</button>' +
            '<button class="btn btn-outlined" data-act="edit-series" data-id="' + s.id + '">' + Icons.svg('edit', 18) + 'Editar</button>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<h1 class="detail-title">' + esc(s.title) + '</h1>' +
          '<div class="detail-sub">' + esc(s.genre || '') + ' · ' + (s.year || '') + ' · ' + totalEps + ' episodios · ' + categoryName(s.categoryId) + '</div>' +
          '<div class="chips-inline">' + (s.tags || []).map(function (t) { return '<span class="tag-chip">' + esc(t) + '</span>'; }).join('') + '</div>' +
          '<div class="detail-actions">' +
            '<button class="btn btn-filled" data-act="play-series" data-id="' + s.id + '">' + Icons.svg('play', 18) + 'Reproducir</button>' +
            '<button class="btn btn-tonal" data-act="add-episode" data-id="' + s.id + '">' + Icons.svg('plus', 18) + 'Agregar episodio</button>' +
            '<button class="btn btn-outlined" data-act="autoplay" data-id="' + s.id + '">' + Icons.svg('repeat', 18) + 'Autoplay: ' + (s.autoplayNext ? 'ON' : 'OFF') + '</button>' +
          '</div>' +
          '<p class="synopsis">' + esc(s.synopsis || 'Sin sinopsis.') + '</p>' +
          '<dl class="kv">' +
            '<dt>Episodios vistos</dt><dd>' + watched + ' / ' + totalEps + '</dd>' +
            '<dt>Calificación</dt><dd>' + stars(s.rating || 0) + '</dd>' +
            '<dt>Temporadas</dt><dd>' + s.seasons.length + '</dd>' +
            '<dt>Categoría</dt><dd>' + esc(categoryName(s.categoryId)) + '</dd>' +
            '<dt>Auto-siguiente</dt><dd>' + (s.autoplayNext ? 'Activado' : 'Desactivado') + '</dd>' +
          '</dl>' +
        '</div>' +
      '</div>' +

      '<section class="section" style="margin-top:28px">' +
        '<div class="season-tabs" id="seasonTabs">' +
          s.seasons.map(function (sn, i) {
            return '<button class="chip ' + (i === 0 ? 'selected' : '') + '" data-season="' + sn.id + '">Temporada ' + sn.number + '</button>';
          }).join('') +
          '<button class="chip" data-act="add-season" data-id="' + s.id + '">' + Icons.svg('plus', 16) + 'Temporada</button>' +
        '</div>' +
        '<div class="ep-list" id="epList">' + renderEpisodes(s, s.seasons[0]) + '</div>' +
      '</section>';
  }

  function renderEpisodes(series, season) {
    if (!season) return '';
    const eps = season.episodes.slice().sort(function (a, b) { return a.number - b.number; });
    if (!eps.length) return emptyState('film', 'Sin episodios', 'Agrega el primer episodio de la temporada.');
    return eps.map(function (e) {
      const p = e.duration ? Math.min(100, (e.progress / e.duration) * 100) : 0;
      return '' +
        '<article class="ep-item" data-open="' + esc(e.id) + '" data-kind="video">' +
          '<div class="ep-thumb" style="background-image:url(' + e.thumbnail + ')"><span class="ep-num">E' + e.number + '</span>' +
            (e.watched ? '<span class="badge top">' + Icons.svg('check', 13) + '</span>' : '') + '</div>' +
          '<div class="ep-info">' +
            '<div class="ep-title">' + esc(e.title) + '</div>' +
            '<div class="ep-meta">' +
              '<span>' + formatDuration(e.duration) + '</span>' +
              '<span>' + esc(e.quality || '') + '</span>' +
              '<span>' + esc(e.videoCodec || '') + '</span>' +
              (e.subtitleTracks && e.subtitleTracks.length ? '<span>' + e.subtitleTracks.length + ' subtítulos</span>' : '') +
              (e.audioTracks && e.audioTracks.length ? '<span>' + e.audioTracks.length + ' pistas de audio</span>' : '') +
            '</div>' +
            (p > 1 ? '<div class="progress-line"><i style="width:' + p + '%"></i></div>' : '') +
          '</div>' +
          '<div class="ep-actions">' +
            '<button class="icon-btn" data-act="watched" data-id="' + esc(e.id) + '" data-series="' + esc(series.id) + '" title="Marcar visto">' + Icons.svg('watch', 19) + '</button>' +
            '<button class="icon-btn" data-act="edit-episode" data-id="' + esc(e.id) + '" data-series="' + esc(series.id) + '" title="Editar">' + Icons.svg('edit', 19) + '</button>' +
            '<button class="icon-btn" data-act="play" data-id="' + esc(e.id) + '" title="Reproducir">' + Icons.svg('play', 19) + '</button>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  /* ================= VIDEOS ================= */
  function viewVideosList(filters) {
    filters = filters || {};
    let list = Store.selectors.visibleEpisodes(Store.state).filter(function (v) { return v.kind === 'video'; });
    if (filters.q) {
      const q = filters.q.toLowerCase();
      list = list.filter(function (v) {
        return (v.title || '').toLowerCase().indexOf(q) >= 0 ||
               (v.genre || '').toLowerCase().indexOf(q) >= 0 ||
               (v.tags || []).join(' ').toLowerCase().indexOf(q) >= 0;
      });
    }
    if (filters.category) list = list.filter(function (v) { return v.categoryId === filters.category; });
    if (filters.quality) list = list.filter(function (v) { return v.quality === filters.quality; });
    if (filters.tagMode) {
      const tags = (filters.tags || []);
      list = list.filter(function (v) {
        return filters.tagMode === 'all'
          ? tags.every(function (t) { return (v.tags || []).includes(t); })
          : tags.some(function (t) { return (v.tags || []).includes(t); });
      });
    }
    if (filters.minDuration || filters.maxDuration) {
      list = list.filter(function (v) {
        return (!filters.minDuration || v.duration >= filters.minDuration) && (!filters.maxDuration || v.duration <= filters.maxDuration);
      });
    }
    if (filters.added) {
      const days = filters.added;
      const cut = Date.now() - days * 86400000;
      list = list.filter(function (v) { return new Date(v.addedAt).getTime() >= cut; });
    }
    if (filters.minRating) list = list.filter(function (v) { return (v.rating || 0) >= filters.minRating; });
    if (filters.watched === 'yes') list = list.filter(function (v) { return v.watched; });
    if (filters.watched === 'no') list = list.filter(function (v) { return !v.watched; });

    const chips = [];
    if (filters.category) chips.push({ k: 'category', label: categoryName(filters.category) });
    if (filters.quality) chips.push({ k: 'quality', label: filters.quality });
    (filters.tags || []).forEach(function (t) { chips.push({ k: 'tags', label: t }); });
    if (filters.added) chips.push({ k: 'added', label: 'Últimos ' + filters.added + ' días' });
    if (filters.minRating) chips.push({ k: 'minRating', label: '★ ' + filters.minRating + '+' });
    if (filters.watched) chips.push({ k: 'watched', label: filters.watched === 'yes' ? 'Vistos' : 'No vistos' });

    return '' +
      '<div class="page-head">' +
        '<div><h1 class="page-title">Videos</h1><p class="page-sub">' + list.length + ' elementos en la biblioteca</p></div>' +
        '<div class="page-head-actions">' +
          '<button class="btn btn-tonal" data-act="grid-toggle">' + Icons.svg('grid', 18) + 'Cambiar vista</button>' +
          '<button class="btn btn-filled" data-act="add">' + Icons.svg('plus', 18) + 'Agregar video</button>' +
        '</div>' +
      '</div>' +
      (chips.length ? '<div class="chips" style="margin-bottom:16px">' + chips.map(function (c) {
        return '<button class="chip selected" data-clear-filter="' + c.k + '">' + esc(c.label) + ' ✕</button>';
      }).join('') + '<button class="chip" data-act="clear-filters">Limpiar</button></div>' : '') +
      (list.length
        ? '<div class="grid poster">' + list.map(posterCard).join('') + '</div>'
        : emptyState('film', 'Sin resultados', 'No hay videos que coincidan con los filtros aplicados.', '<button class="btn btn-tonal" data-act="clear-filters">Limpiar filtros</button>'));
  }

  function viewVideoDetail(id) {
    const v = Store.state.videos.find(function (x) { return x.id === id; }) ||
      Store.selectors.allEpisodes(Store.state).find(function (e) { return e.id === id; });
    if (!v) return emptyState('warning', 'Contenido no encontrado', 'El elemento solicitado no existe.');
    const related = Store.selectors.related(Store.state, v);
    const cat = Store.state.categories.find(function (c) { return c.id === v.categoryId; });

    return '' +
      '<div class="detail">' +
        '<div>' +
          '<div class="detail-poster"><div class="ph" style="background-image:url(' + v.poster + ')"><span>' + esc(v.title) + '</span></div></div>' +
          '<div style="display:flex;gap:8px;margin-top:12px">' +
            '<button class="btn btn-tonal" data-act="fav" data-id="' + esc(v.id) + '">' + Icons.svg('heart', 18) + (v.favorite ? 'Quitar' : 'Favorito') + '</button>' +
            '<button class="btn btn-outlined" data-act="hide" data-id="' + esc(v.id) + '">' + Icons.svg(v.hidden ? 'eye' : 'eyeoff', 18) + (v.hidden ? 'Visible' : 'Oculto') + '</button>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<h1 class="detail-title">' + esc(v.title) + '</h1>' +
          '<div class="detail-sub">' + esc(v.genre || '') + ' · ' + (v.year || '') + ' · ' + formatDuration(v.duration) + ' · ' + esc(v.quality || '') + '</div>' +
          '<div class="chips-inline">' + (v.tags || []).map(function (t) { return '<span class="tag-chip">' + esc(t) + '</span>'; }).join('') + '</div>' +
          '<div class="detail-actions">' +
            '<button class="btn btn-filled" data-act="play" data-id="' + esc(v.id) + '">' + Icons.svg('play', 18) + 'Reproducir</button>' +
            (v.progress > 0 ? '<button class="btn btn-tonal" data-act="play" data-id="' + esc(v.id) + '">' + Icons.svg('history', 18) + 'Continuar en ' + formatDuration(v.progress) + '</button>' : '') +
            '<button class="btn btn-outlined" data-act="edit" data-id="' + esc(v.id) + '">' + Icons.svg('edit', 18) + 'Editar</button>' +
            '<button class="btn btn-outlined" data-act="rate" data-id="' + esc(v.id) + '">' + Icons.svg('star', 18) + 'Calificar</button>' +
          '</div>' +
          '<p class="synopsis">' + esc(v.synopsis || 'Sin sinopsis.') + '</p>' +
          '<dl class="kv">' +
            '<dt>Categoría</dt><dd>' + esc(cat ? cat.name : 'Sin categoría') + '</dd>' +
            '<dt>Resolución</dt><dd>' + esc(v.resolution || v.quality || '—') + '</dd>' +
            '<dt>Códecs</dt><dd>' + esc(v.videoCodec || '—') + ' / ' + esc(v.audioCodec || '—') + '</dd>' +
            '<dt>Tamaño</dt><dd>' + formatBytes(v.sizeBytes) + '</dd>' +
            '<dt>Ruta original</dt><dd><code>' + esc(v.path || '—') + '</code></dd>' +
            '<dt>Estado</dt><dd>' + (v.watched ? 'Visto' : (v.progress ? 'En curso (' + formatDuration(v.progress) + ')' : 'Sin ver')) + '</dd>' +
            '<dt>Calificación</dt><dd>' + stars(v.rating || 0) + '</dd>' +
            '<dt>Agregado</dt><dd>' + timeAgo(v.addedAt) + '</dd>' +
          '</dl>' +

          '<h3 class="pp-title-sm" style="margin-top:20px">Pistas de audio y subtítulos</h3>' +
          '<div class="pp-list" style="margin-top:8px">' +
            (v.audioTracks || []).map(function (a) {
              return '<div class="pp-opt ' + (a.isDefault ? 'sel' : '') + '"><span class="pp-opt-tx"><b>' + esc(a.language) + '</b><span>' + esc(a.codec) + ' · ' + a.channels + ' canales</span></span>' +
                (a.isDefault ? '<span class="pill primary">por defecto</span>' : '') + '</div>';
            }).join('') +
            (v.subtitleTracks || []).map(function (t) {
              return '<div class="pp-opt ' + (t.isDefault ? 'sel' : '') + '"><span class="pp-opt-tx"><b>' + esc(t.language) + '</b><span>' + (t.format === 'embedded' ? 'embebido' : 'externo') + '</span></span>' +
                (t.isDefault ? '<span class="pill primary">por defecto</span>' : '') + '</div>';
            }).join('') +
            ((!v.audioTracks || !v.audioTracks.length) && (!v.subtitleTracks || !v.subtitleTracks.length) ? '<div class="hint">Este archivo no tiene pistas detectadas.</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +

      '<section class="section" style="margin-top:30px">' +
        sectionHead('Videos relacionados', related.length) +
        (related.length ? '<div class="grid poster">' + related.map(posterCard).join('') + '</div>' : '<div class="hint">Sin coincidencias por categoría o etiquetas.</div>') +
      '</section>';
  }

  /* ================= MUSICA ================= */
  function viewMusic() {
    const s = Store.state;
    const tab = global.MusicTab || 'artistas';
    const recent = s.tracks.slice(-10).reverse();
    return '' +
      '<div class="page-head">' +
        '<div><h1 class="page-title">Música</h1><p class="page-sub">' + s.artists.length + ' artistas · ' + s.albums.length + ' álbumes · ' + s.tracks.length + ' pistas</p></div>' +
        '<div class="page-head-actions">' +
          '<button class="btn btn-tonal" data-act="add-playlist">' + Icons.svg('playlistadd', 18) + 'Nueva playlist</button>' +
          '<button class="btn btn-filled" data-act="add-track">' + Icons.svg('plus', 18) + 'Agregar pista</button>' +
        '</div>' +
      '</div>' +
      '<div class="tabs-inline" style="margin-bottom:18px">' +
        ['artistas', 'albumes', 'pistas', 'playlists'].map(function (t) {
          const label = { artistas: 'Artistas', albums: 'Álbumes', albunes: 'Álbumes', albumes: 'Álbumes', pistas: 'Pistas', playlists: 'Playlists' }[t];
          return '<button class="' + (tab === t ? 'active' : '') + '" data-music-tab="' + t + '">' + label + '</button>';
        }).join('') +
      '</div>' +
      '<div class="music-layout"><div>' + musicTabBody(tab) + '</div>' +
        '<aside>' +
          '<div class="section-head"><h3 class="section-title">Añadido recientemente</h3></div>' +
          '<div class="track-list">' + recent.map(trackRow).join('') + '</div>' +
          (s.equalizer.enabled ? '<div class="section-head" style="margin-top:18px"><h3 class="section-title">Ecualizador</h3></div>' + equalizerPanel() : '') +
          '<div class="section-head" style="margin-top:18px"><h3 class="section-title">Visualizador</h3>' +
            '<div class="section-actions"><button class="chip ' + (s.visualizer ? 'selected' : '') + '" data-act="toggle-visualizer">' + (s.visualizer ? 'Activado' : 'Desactivado') + '</button></div></div>' +
            '<div class="visualizer" id="visualizerBox" ' + (s.visualizer ? '' : 'hidden') + '>' +
              Array.from({ length: 28 }, function () { return '<i style="height:20%"></i>'; }).join('') + '</div>' +
        '</aside>' +
      '</div>';
  }

  function musicTabBody(tab) {
    const s = Store.state;
    if (tab === 'artistas') {
      return '<div class="grid wide">' + s.artists.map(function (a) {
        return '<article class="artist-card" data-artist="' + esc(a.id) + '">' +
          '<div class="artist-round" style="background-image:url(' + a.image + ')"></div>' +
          '<div class="card-title">' + esc(a.name) + '</div>' +
          '<div class="card-meta">' + esc(a.genre) + ' · ' + albumCount(s, a.id) + '</div></article>';
      }).join('') + '</div>';
    }
    if (tab === 'albumes') {
      return '<div class="grid poster">' + s.albums.map(function (a) {
        return '<article class="card" data-album="' + esc(a.id) + '">' +
          '<div class="card-poster"><div class="ph" style="background-image:url(' + a.cover + ')">' + esc(a.title) + '</div>' +
          '<div class="badge">' + a.trackIds.length + (a.trackIds.length === 1 ? ' pista' : ' pistas') + '</div></div>' +
          '<div class="card-body"><div class="card-title">' + esc(a.title) + '</div>' +
          '<div class="card-meta">' + esc(a.artistName) + ' · ' + a.year + '</div></div></article>';
      }).join('') + '</div>';
    }
    if (tab === 'pistas') {
      return '<div class="track-list">' + s.tracks.map(trackRow).join('') + '</div>';
    }
    return '<div class="grid wide">' + s.playlists.map(function (p) {
      return '<article class="card card-wide" data-playlist="' + esc(p.id) + '">' +
        '<div class="cw-thumb" style="background-image:url(' + (p.cover || '') + ')"></div>' +
        '<div class="cw-meta"><div class="cw-title">' + esc(p.name) + '</div>' +
        '<div class="cw-sub">' + (p.rules ? 'Playlist inteligente · ' + esc(p.description) : p.trackIds.length + ' pistas') + '</div></div>' +
        '<button class="icon-btn" data-act="play-playlist" data-id="' + esc(p.id) + '">' + Icons.svg('play', 22) + '</button></article>';
    }).join('') + '</div>';
  }

  function trackRow(t) {
    const playing = global.MiniPlayer && global.MiniPlayer.currentId === t.id;
    return '<div class="track-row ' + (playing ? 'playing' : '') + '" data-track="' + esc(t.id) + '">' +
      '<div class="track-idx">' + (playing ? '<span class="eq-bars"><i style="animation-delay:0ms"></i><i style="animation-delay:150ms"></i><i style="animation-delay:300ms"></i></span>' : esc(t.trackNo || '')) + '</div>' +
      '<div><div class="track-name">' + esc(t.title) + '</div><div class="track-artist">' + esc(t.artistName) + ' · ' + esc(t.albumTitle) + '</div></div>' +
      '<div class="track-artist">' + formatDuration(t.duration) + '</div>' +
      '<div style="display:flex;gap:4px">' + stars(t.rating || 0) +
      '<button class="icon-btn sm" data-act="play-track" data-id="' + esc(t.id) + '">' + Icons.svg('play', 18) + '</button></div>' +
      '</div>';
  }

  function equalizerPanel() {
    const eq = Store.state.equalizer;
    const labels = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];
    return '<div style="background:var(--md-sys-color-surface-container-low);border-radius:12px;padding:12px">' +
      '<div class="chips" style="margin-bottom:10px">' +
      ['Flat', 'Rock', 'Pop', 'Jazz', 'Classical', 'Bass boost'].map(function (p) {
        return '<button class="chip ' + (eq.preset === p ? 'selected' : '') + '" data-eq-preset="' + p + '">' + p + '</button>';
      }).join('') + '</div>' +
      '<div style="display:flex;gap:6px;align-items:flex-end;height:110px">' +
      eq.gains.map(function (g, i) {
        return '<div style="flex:1;text-align:center"><input type="range" min="-12" max="12" value="' + g + '" data-eq-band="' + i + '" style="width:100%;height:80px;writing-mode:vertical-lr;direction:rtl" /><div class="hint" style="font-size:.6rem">' + labels[i] + '</div></div>';
      }).join('') + '</div></div>';
  }

  /* ================= GALERIA ================= */
  function viewGallery() {
    const s = Store.state;
    const current = global.GalleryPath || 'D:\\Media\\Peliculas';
    const node = galleryTree(s.folders, current);
    const items = galleryItems(current, s);
    const favFolders = s.folders.filter(function (f) { return s.favoriteFolders.includes(f.id); });

    return '' +
      '<div class="page-head">' +
        '<div><h1 class="page-title">Galería</h1><p class="page-sub">Navegación tipo explorador sobre tus carpetas reales</p></div>' +
        '<div class="page-head-actions">' +
          '<button class="btn btn-tonal" data-act="new-folder">' + Icons.svg('folder', 18) + 'Nueva carpeta</button>' +
          '<button class="btn btn-outlined" data-act="trash-view">' + Icons.svg('trash', 18) + 'Papelera (' + s.trash.length + ')</button>' +
        '</div>' +
      '</div>' +
      (favFolders.length ? '<div class="chips" style="margin-bottom:14px">' + favFolders.map(function (f) {
        return '<button class="chip selected" data-goto-path="' + esc(f.path) + '">' + Icons.svg('heart', 16) + esc(f.name) + '</button>';
      }).join('') + '</div>' : '') +
      '<div class="gallery">' +
        '<aside class="gal-tree"><h3 class="section-title" style="margin-bottom:10px">Carpetas</h3>' + node + '</aside>' +
        '<div>' +
          '<div class="breadcrumb">' +
            '<a href="#/galeria">Raíz</a>' +
            current.split('\\').filter(Boolean).map(function (seg) { return ' <span>/</span> ' + esc(seg); }).join('') +
          '</div>' +
          '<div class="gal-toolbar">' +
            '<button class="btn btn-outlined" id="galSelectAll">Seleccionar todo</button>' +
            '<button class="btn btn-tonal" data-act="gal-rename">' + Icons.svg('edit', 18) + 'Renombrar en lote</button>' +
            '<button class="btn btn-tonal" data-act="gal-move">' + Icons.svg('upload', 18) + 'Mover</button>' +
            '<button class="btn btn-tonal" data-act="gal-copy">' + Icons.svg('download', 18) + 'Copiar</button>' +
            '<button class="btn btn-danger" data-act="gal-trash">' + Icons.svg('trash', 18) + 'Enviar a papelera</button>' +
          '</div>' +
          '<div class="gal-grid">' + items + '</div>' +
        '</div>' +
      '</div>';
  }

  function galleryTree(folders, current) {
    return folders.map(function (f) {
      const sel = f.path === current ? ' sel' : '';
      return '<button class="' + sel.trim() + '" data-goto-path="' + esc(f.path) + '">' + Icons.svg('folder', 18) + esc(f.name) + '</button>';
    }).join('');
  }

  function galleryItems(path, s) {
    const out = [];
    const root = path.replace(/[\\/]+$/, '');
    Store.selectors.allEpisodes(s).forEach(function (v) {
      if (v.path && v.path.indexOf(root) === 0 && v.path !== root) {
        out.push('<div class="gal-item" data-gal-id="' + esc(v.id) + '">' +
          '<div class="gal-thumb" style="background-image:url(' + v.thumbnail + ')"><span class="gal-check">' + Icons.svg('check', 14) + '</span>' +
          '<span class="badge">' + esc(v.quality || '') + '</span></div>' +
          '<div class="ex-name">' + esc(v.path.split(/[\\/]/).pop()) + '</div>' +
          '<div class="ex-name sub">' + formatBytes(v.sizeBytes) + ' · ' + formatDuration(v.duration) + '</div>' +
          '</div>');
      }
    });
    return out.length ? out.join('') : '<div class="hint" style="grid-column:1/-1">Esta carpeta no contiene videos registrados.</div>';
  }

  /* ================= BÚSQUEDA ================= */
  function viewSearch(q) {
    const s = Store.state;
    const term = (q || '').toLowerCase();
    const all = Store.selectors.visibleEpisodes(s);
    const vids = all.filter(function (v) {
      if (!term) return false;
      return (v.title || '').toLowerCase().indexOf(term) >= 0 ||
        (v.genre || '').toLowerCase().indexOf(term) >= 0 ||
        (v.tags || []).join(' ').toLowerCase().indexOf(term) >= 0 ||
        (v.synopsis || '').toLowerCase().indexOf(term) >= 0;
    });
    const trks = s.tracks.filter(function (t) {
      if (!term) return false;
      return (t.title || '').toLowerCase().indexOf(term) >= 0 ||
        (t.artistName || '').toLowerCase().indexOf(term) >= 0 ||
        (t.albumTitle || '').toLowerCase().indexOf(term) >= 0;
    });
    const sers = s.series.filter(function (x) {
      if (!term) return false;
      return (x.title || '').toLowerCase().indexOf(term) >= 0 ||
        (x.genre || '').toLowerCase().indexOf(term) >= 0 ||
        (x.tags || []).join(' ').toLowerCase().indexOf(term) >= 0;
    });

    if (!term) {
      return '<div class="page-head"><div><h1 class="page-title">Buscar</h1>' +
        '<p class="page-sub">Busca en videos, series, música y etiquetas</p></div></div>' +
        '<div class="drop-zone" style="padding:56px">' +
        '<div style="font-size:2rem;margin-bottom:8px">🔍</div>' +
        '<p>Escribe en el buscador superior o pulsa <kbd>/</kbd> para enfocar la búsqueda.</p></div>';
    }

    return '<div class="page-head"><div><h1 class="page-title">Resultados para “' + esc(q) + '”</h1>' +
      '<p class="page-sub">' + (vids.length + sers.length + trks.length) + ' coincidencias</p></div></div>' +
      (sers.length ? '<section class="section">' + sectionHead('Series', sers.length) + '<div class="grid poster">' + sers.map(function (x) { return posterCard(Object.assign({ kind: 'series' }, x)); }).join('') + '</div></section>' : '') +
      (vids.length ? '<section class="section">' + sectionHead('Videos', vids.length) + '<div class="grid poster">' + vids.map(posterCard).join('') + '</div></section>' : '') +
      (trks.length ? '<section class="section">' + sectionHead('Música', trks.length) + '<div class="track-list">' + trks.map(trackRow).join('') + '</div></section>' : '') +
      (!vids.length && !sers.length && !trks.length ? emptyState('search', 'Sin resultados', 'No encontramos nada con ese término.') : '');
  }

  /* ================= TAXONOMÍA ================= */
  function viewTaxonomy() {
    const s = Store.state;
    return '' +
      '<div class="page-head"><div><h1 class="page-title">Taxonomía</h1>' +
      '<p class="page-sub">Categorías (una por video) y etiquetas (múltiples)</p></div>' +
      '<div class="page-head-actions">' +
      '<button class="btn btn-outlined" data-act="new-tag">' + Icons.svg('tag', 18) + 'Nueva etiqueta</button>' +
      '<button class="btn btn-filled" data-act="new-category">' + Icons.svg('plus', 18) + 'Nueva categoría</button>' +
      '</div></div>' +

      '<section class="section">' + sectionHead('Categorías', s.categories.length) +
      '<div class="grid wide">' + s.categories.map(function (c) {
        const count = Store.selectors.byCategory(s, c.id).length;
        return '<article class="card card-wide" data-cat="' + esc(c.id) + '">' +
          '<div style="width:12px;height:44px;border-radius:6px;background:' + c.color + '"></div>' +
          '<div class="cw-meta"><div class="cw-title">' + esc(c.name) + '</div>' +
          '<div class="cw-sub">' + count + ' video(s)</div></div>' +
          '<button class="icon-btn" data-act="edit-category" data-id="' + esc(c.id) + '">' + Icons.svg('edit', 18) + '</button>' +
          '<button class="icon-btn" data-act="delete-category" data-id="' + esc(c.id) + '">' + Icons.svg('delete', 18) + '</button>' +
          '</article>';
      }).join('') + '</div></section>' +

      '<section class="section">' + sectionHead('Etiquetas', s.tags.length) +
      '<div class="chips">' + s.tags.map(function (t) {
        const count = Store.selectors.byTags(s, [t], 'any').length;
        return '<span class="tag-chip primary">' + esc(t) + ' (' + count + ')' +
          '<button data-act="delete-tag" data-id="' + esc(t) + '" style="margin-left:6px;border:0;background:transparent;cursor:pointer;color:inherit">✕</button></span>';
      }).join('') + '</div></section>';
  }

  /* ================= BIBLIOTECA ================= */
  function viewLibrary() {
    const s = Store.state;
    return '' +
      '<div class="page-head"><div><h1 class="page-title">Biblioteca</h1>' +
      '<p class="page-sub">' + s.folders.length + ' carpetas registradas · escaneo automático ' + (s.folders.some(f => f.autoScan) ? 'activo' : 'inactivo') + '</p></div>' +
      '<div class="page-head-actions">' +
      '<button class="btn btn-tonal" data-act="scan-all">' + Icons.svg('scan', 18) + 'Escanear todo</button>' +
      '<button class="btn btn-filled" data-act="register-folder">' + Icons.svg('plus', 18) + 'Registrar carpeta</button>' +
      '</div></div>' +

      '<section class="section">' + sectionHead('Carpetas registradas', s.folders.length) +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Nombre</th><th>Ruta</th><th>Ámbito</th><th>Archivos</th><th>Tamaño</th><th>Último escaneo</th><th></th></tr></thead><tbody>' +
      s.folders.map(function (f) {
        return '<tr><td><b>' + esc(f.name) + '</b></td><td><code>' + esc(f.path) + '</code></td>' +
          '<td><span class="pill">' + esc(f.scope) + '</span></td>' +
          '<td>' + f.files + '</td><td>' + formatBytes(f.sizeBytes) + '</td>' +
          '<td>' + (f.lastScan ? timeAgo(f.lastScan) : 'nunca') + '</td>' +
          '<td><div class="row-actions">' +
          '<button class="icon-btn sm" data-act="scan-folder" data-id="' + f.id + '" title="Escanear">' + Icons.svg('scan', 18) + '</button>' +
          '<button class="icon-btn sm" data-act="favorite-folder" data-id="' + f.id + '" title="Marcar como favorita">' + Icons.svg('heart', 18) + '</button>' +
          '<button class="icon-btn sm" data-act="remove-folder" data-id="' + f.id + '" title="Quitar de la biblioteca">' + Icons.svg('delete', 18) + '</button>' +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div></section>' +

      '<div class="grid row" style="margin-top:24px">' +
        '<section class="section" style="margin:0">' + sectionHead('Archivos ignorados', s.ignored.length) +
        '<div class="track-list">' + s.ignored.map(function (f) {
          return '<div class="track-row" style="grid-template-columns:32px 1fr auto auto"><div class="track-idx">' + Icons.svg('eyeoff', 18) + '</div>' +
            '<div><div class="track-name">' + esc(f.name) + '</div><div class="track-artist">' + esc(f.reason) + '</div></div>' +
            '<div></div><button class="btn btn-text" data-act="unignore" data-id="' + esc(f.id) + '">Restaurar</button></div>';
        }).join('') + '</div></section>' +

        '<section class="section" style="margin:0">' + sectionHead('Duplicados por hash', s.duplicates.length) +
        '<div class="track-list">' + s.duplicates.map(function (d) {
          return '<div class="track-row" style="grid-template-columns:32px 1fr auto auto"><div class="track-idx">' + Icons.svg('duplicate', 18) + '</div>' +
            '<div><div class="track-name">' + esc(d.name) + '</div><div class="track-artist">' + d.copies + ' copias · ' + d.size + ' · hash ' + d.hash.slice(0, 8) + '</div></div>' +
            '<div></div><button class="btn btn-text" data-act="resolve-dup" data-id="' + esc(d.id) + '">Resolver</button></div>';
        }).join('') + '</div></section>' +
      '</div>' +

      '<section class="section" style="margin-top:26px">' + sectionHead('Carga masiva desde carpeta', null) +
      '<div class="hint" style="margin-bottom:12px">Exploración puntual: elige una carpeta, revisa los candidatos y confirma cuáles importar. No requiere registrar la carpeta como biblioteca permanente.</div>' +
      '<button class="btn btn-filled" data-act="bulk-import">' + Icons.svg('upload', 18) + 'Explorar carpeta e importar</button></section>';
  }

  /* ================= USUARIOS ================= */
  function viewUsers() {
    const s = Store.state;
    return '' +
      '<div class="page-head"><div><h1 class="page-title">Usuarios y perfiles</h1>' +
      '<p class="page-sub">Perfiles independientes con control parental y preferencias</p></div>' +
      '<div class="page-head-actions"><button class="btn btn-filled" data-act="new-profile">' + Icons.svg('plus', 18) + 'Nuevo perfil</button></div></div>' +
      '<div class="grid wide">' + s.profiles.map(function (p) {
        const isCur = p.id === s.currentProfileId;
        return '<article class="card card-wide">' +
          '<span class="avatar" style="background:' + p.color + ';color:#fff">' + esc(p.avatar) + '</span>' +
          '<div class="cw-meta"><div class="cw-title">' + esc(p.name) + (isCur ? ' <span class="pill primary">actual</span>' : '') + '</div>' +
          '<div class="cw-sub">' + esc(p.role) + (p.parental.enabled ? ' · control parental ' + esc(p.parental.maxRating) : '') + '</div></div>' +
          '<button class="btn btn-tonal" data-act="switch-profile" data-id="' + p.id + '">' + (isCur ? 'Actual' : 'Usar') + '</button>' +
          '<button class="icon-btn" data-act="edit-profile" data-id="' + p.id + '">' + Icons.svg('edit', 18) + '</button>' +
          '</article>';
      }).join('') + '</div>' +

      '<section class="section" style="margin-top:28px">' + sectionHead('Preferencias del perfil actual') +
      '<div style="max-width:640px" id="prefsBox"></div></section>';
  }

  function renderPrefs() {
    const s = Store.state;
    const p = Store.selectors.currentProfile(s);
    const box = $('#prefsBox');
    if (!box) return;
    box.innerHTML = '';
    box.appendChild(UI.switchRow('Vista previa al pasar el cursor', 'Reproducir en bucle sin audio sobre las miniaturas', s.hoverPreview, function (v) {
      Store.dispatch(Store.actions.SET_PREFERENCES({ id: p.id, preferences: { hoverPreview: v } }));
      Store.dispatch(Store.actions.SET({ hoverPreview: v }));
    }));
    box.appendChild(UI.switchRow('Reproducción automática del siguiente episodio', 'Aplica a todo el contenido de series', s.autoplayNext, function (v) {
      Store.dispatch(Store.actions.SET_PREFERENCES({ id: p.id, preferences: { autoplayNext: v } }));
      Store.dispatch(Store.actions.SET({ autoplayNext: v }));
    }));
    box.appendChild(UI.switchRow('Escribir etiquetas en los metadatos del archivo', 'Opcional: el dato viaja con el archivo si lo mueves', s.writeTagsToFile, function (v) {
      Store.dispatch(Store.actions.SET_PREFERENCES({ id: p.id, preferences: { writeTagsToFile: v } }));
      Store.dispatch(Store.actions.SET({ writeTagsToFile: v }));
    }));
    box.appendChild(UI.switchRow('Atajos de teclado', 'Activa los controles de teclado del reproductor', p.preferences.keyboardShortcuts, function (v) {
      Store.dispatch(Store.actions.SET_PREFERENCES({ id: p.id, preferences: { keyboardShortcuts: v } }));
    }));
  }

  /* ================= ESTADÍSTICAS ================= */
  function viewStats() {
    const s = Store.state;
    const genres = Store.selectors.topGenres(s);
    const artists = Store.selectors.topArtists(s);
    const totalSec = Store.selectors.visibleEpisodes(s).reduce(function (a, v) { return a + (v.watched ? v.duration : 0); }, 0);
    const musicSec = s.tracks.reduce(function (a, t) { return a + (t.plays || 0) * (t.duration || 0); }, 0);
    const maxG = genres[0] ? genres[0].value : 1;
    const maxA = artists[0] ? artists[0].value : 1;

    return '' +
      '<div class="page-head"><div><h1 class="page-title">Estadísticas de consumo</h1>' +
      '<p class="page-sub">Perfil: ' + esc(Store.selectors.currentProfile(s).name) + '</p></div></div>' +

      '<div class="stat-grid">' +
        '<div class="stat-card"><div class="stat-val">' + formatDuration(totalSec) + '</div><div class="stat-lbl">Tiempo de video visto</div></div>' +
        '<div class="stat-card"><div class="stat-val">' + formatDuration(musicSec) + '</div><div class="stat-lbl">Música escuchada</div></div>' +
        '<div class="stat-card"><div class="stat-val">' + Store.selectors.visibleEpisodes(s).filter(function (v) { return v.watched; }).length + '</div><div class="stat-lbl">Elementos completados</div></div>' +
        '<div class="stat-card"><div class="stat-val">' + s.tracks.reduce(function (a, t) { return a + (t.plays || 0); }, 0) + '</div><div class="stat-lbl">Reproducciones de pistas</div></div>' +
      '</div>' +

      '<div class="grid row" style="margin-top:24px">' +
        '<section class="section" style="margin:0">' + sectionHead('Géneros más consumidos') +
          genres.map(function (g) {
            return '<div class="bar-row"><span>' + esc(g.label) + '</span><span class="bar"><i style="width:' + (g.value / maxG * 100) + '%"></i></span><span>' + formatDuration(g.value) + '</span></div>';
          }).join('') + '</section>' +
        '<section class="section" style="margin:0">' + sectionHead('Artistas más escuchados') +
          artists.map(function (a) {
            return '<div class="bar-row"><span>' + esc(a.label) + '</span><span class="bar"><i style="width:' + (a.value / maxA * 100) + '%"></i></span><span>' + a.value + '</span></div>';
          }).join('') + '</section>' +
      '</div>';
  }

  /* ================= ADMIN ================= */
  function viewAdmin() {
    const s = Store.state;
    const st = s.serverStatus;
    const pct = Math.round((st.storageUsedBytes / st.storageTotalBytes) * 100);
    return '' +
      '<div class="page-head"><div><h1 class="page-title">Administración del servidor</h1>' +
      '<p class="page-sub">Única pantalla propiamente administrativa · v' + st.version + '</p></div>' +
      '<div class="page-head-actions">' +
      '<button class="btn btn-tonal" data-act="backup">' + Icons.svg('backup', 18) + 'Backup</button>' +
      '<button class="btn btn-outlined" data-act="clear-cache">' + Icons.svg('delete', 18) + 'Limpiar caché</button>' +
      '</div></div>' +

      '<div class="stat-grid">' +
        '<div class="stat-card"><div class="stat-val">' + st.uptimeHours + ' h</div><div class="stat-lbl">Tiempo activo</div></div>' +
        '<div class="stat-card"><div class="stat-val">' + st.cpu + '%</div><div class="stat-lbl">CPU</div></div>' +
        '<div class="stat-card"><div class="stat-val">' + st.memory + '%</div><div class="stat-lbl">Memoria</div></div>' +
        '<div class="stat-card"><div class="stat-val">' + pct + '%</div><div class="stat-lbl">Almacenamiento usado</div></div>' +
      '</div>' +

      '<section class="section" style="margin-top:26px">' + sectionHead('Almacenamiento') +
      '<div class="meter" style="height:12px"><div class="meter-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="hint" style="margin-top:8px">' + formatBytes(st.storageUsedBytes) + ' de ' + formatBytes(st.storageTotalBytes) + '</div></section>' +

      '<section class="section">' + sectionHead('Transcodificación') +
      '<div id="adminTranscode"></div></section>' +

      '<section class="section">' + sectionHead('Escaneo y watcher') +
      '<div id="adminScan"></div></section>' +

      '<section class="section">' + sectionHead('Acceso remoto') +
      '<div id="adminRemote"></div></section>' +

      '<section class="section">' + sectionHead('Registro de actividad') +
      '<div class="chips" style="margin-bottom:12px">' +
        ['Todos', 'Series', 'Biblioteca', 'Musica', 'Galeria', 'Admin', 'Taxonomia'].map(function (m, i) {
          return '<button class="chip ' + (i === 0 ? 'selected' : '') + '" data-log-module="' + m + '">' + m + '</button>';
        }).join('') + '</div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Módulo</th><th>Usuario</th><th>Comando</th><th>Detalle</th></tr></thead><tbody>' +
      s.activity.slice(0, 30).map(function (a) {
        return '<tr><td>' + new Date(a.at).toLocaleString('es') + '</td><td><span class="pill">' + esc(a.module) + '</span></td>' +
          '<td>' + esc(a.user) + '</td><td><code>' + esc(a.command) + '</code></td><td>' + esc(a.detail) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function renderAdminControls() {
    const s = Store.state;
    const t = $('#adminTranscode');
    if (t) {
      t.innerHTML = '';
      t.appendChild(UI.switchRow('Transcodificación bajo demanda', 'Genera variantes para streaming adaptativo', s.settings.transcode.enabled, function (v) {
        Store.dispatch(Store.actions.UPDATE_SETTINGS({ transcode: Object.assign({}, s.settings.transcode, { enabled: v }) }));
      }));
      t.innerHTML += '<div class="grid-3">' +
        '<div class="field"><span class="field-label">Bitrate (kbps)</span><input class="input" id="admBitrate" value="' + s.settings.transcode.bitrate + '" /></div>' +
        '<div class="field"><span class="field-label">Hilos</span><input class="input" id="admThreads" value="' + s.settings.transcode.threads + '" /></div>' +
        '<div class="field"><span class="field-label">Caché (GB)</span><input class="input" id="admCache" value="' + s.settings.transcode.cacheGb + '" /></div></div>';
    }
    const sc = $('#adminScan');
    if (sc) {
      sc.innerHTML = '';
      sc.appendChild(UI.switchRow('Watcher del sistema de archivos', 'Detecta cambios sin esperar al siguiente escaneo', s.settings.scan.watcher, function (v) {
        Store.dispatch(Store.actions.UPDATE_SETTINGS({ scan: Object.assign({}, s.settings.scan, { watcher: v }) }));
      }));
      sc.innerHTML += '<div class="grid-2">' +
        '<div class="field"><span class="field-label">Intervalo de escaneo (horas)</span><input class="input" id="admInterval" value="' + s.settings.scan.intervalHours + '" /></div>' +
        '<div class="field"><span class="field-label">Backup: retención (días)</span><input class="input" id="admRetention" value="' + s.settings.backup.retention + '" /></div></div>';
    }
    const rm = $('#adminRemote');
    if (rm) {
      rm.innerHTML = '';
      rm.appendChild(UI.switchRow('Acceso remoto fuera de la red local', 'Desactivado por defecto', s.settings.remote.enabled, function (v) {
        Store.dispatch(Store.actions.UPDATE_SETTINGS({ remote: Object.assign({}, s.settings.remote, { enabled: v }) }));
        toast(v ? 'Acceso remoto activado. Revisa la autenticación reforzada.' : 'Acceso remoto desactivado.', v ? 'success' : 'info');
      }));
      rm.appendChild(UI.switchRow('Segundo factor (2FA)', 'Requerido para sesiones remotas', s.settings.remote.twoFactor, function (v) {
        Store.dispatch(Store.actions.UPDATE_SETTINGS({ remote: Object.assign({}, s.settings.remote, { twoFactor: v }) }));
      }));
      rm.appendChild(UI.switchRow('Documentación OpenAPI / Swagger', 'API abierta para clientes adicionales', s.settings.api.swagger, function (v) {
        Store.dispatch(Store.actions.UPDATE_SETTINGS({ api: Object.assign({}, s.settings.api, { swagger: v }) }));
      }));
    }
  }

  /* ================= NOTIFICACIONES ================= */
  function viewNotifications() {
    const s = Store.state;
    const unread = s.notifications.filter(function (n) { return !n.read; }).length;
    return '' +
      '<div class="page-head"><div><h1 class="page-title">Notificaciones</h1>' +
      '<p class="page-sub">' + unread + ' sin leer de ' + s.notifications.length + '</p></div>' +
      '<div class="page-head-actions"><button class="btn btn-outlined" data-act="read-all">Marcar todas como leídas</button></div></div>' +
      (s.notifications.length ? s.notifications.map(function (n) {
        return '<div class="notif-item ' + (n.read ? '' : 'unread') + '">' +
          '<div class="ni-ic">' + Icons.svg(n.icon || 'bell', 19) + '</div>' +
          '<div style="flex:1"><div class="cw-title">' + esc(n.title) + '</div>' +
          '<div class="cw-sub">' + esc(n.body) + ' · ' + timeAgo(n.at) + '</div></div>' +
          (n.read ? '' : '<button class="btn btn-text" data-act="read-notif" data-id="' + n.id + '">Marcar leída</button>') +
          '<button class="icon-btn sm" data-act="dismiss-notif" data-id="' + n.id + '">' + Icons.svg('close', 18) + '</button>' +
          '</div>';
      }).join('') : emptyState('bell', 'Sin notificaciones', 'Aquí verás los avisos de nuevos episodios, escaneos y respaldos.'));
  }

  global.Views = {
    inicio: viewInicio,
    seriesList: viewSeriesList,
    seriesDetail: viewSeriesDetail,
    videosList: viewVideosList,
    videoDetail: viewVideoDetail,
    musica: viewMusic,
    galeria: viewGallery,
    buscar: viewSearch,
    taxonomia: viewTaxonomy,
    biblioteca: viewLibrary,
    usuarios: viewUsers,
    renderPrefs: renderPrefs,
    estadisticas: viewStats,
    admin: viewAdmin,
    renderAdminControls: renderAdminControls,
    notificaciones: viewNotifications,
    posterCard: posterCard,
    wideCard: wideCard,
    stars: stars,
    emptyState: emptyState
  };
})(window);
