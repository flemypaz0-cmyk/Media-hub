/* =====================================================================
   MediaHub — Store
   Mirrors the NgRx pattern: actions -> reducers -> selectors.
   Persistence via localStorage so the library survives a reload.
   ===================================================================== */
(function (global) {
  'use strict';

  const KEY = 'mediahub.state.v4';

  const listeners = [];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function initialState() {
    return {
      /* content */
      series: clone(Data.series),
      videos: clone(Data.videos),
      artists: clone(Data.artists),
      albums: clone(Data.albums),
      tracks: clone(Data.tracks),
      playlists: clone(Data.playlists),
      categories: clone(Data.CATEGORIES),
      tags: clone(Data.TAGS),
      /* library */
      folders: clone(Data.libraryFolders),
      ignored: clone(Data.ignoredFiles),
      duplicates: clone(Data.duplicates),
      trash: [],
      hiddenFolders: [],
      favoriteFolders: ['lf2'],
      scanStatus: { running: false, progress: 0, message: 'Inactivo', lastRun: '2026-11-09T03:22:00Z' },
      /* users */
      profiles: clone(Data.profiles),
      currentProfileId: 'u1',
      /* system */
      notifications: clone(Data.notifications),
      activity: clone(Data.activityLog),
      settings: clone(Data.serverSettings),
      serverStatus: clone(Data.serverStatus),
      /* ui state */
      theme: 'auto',
      lang: 'es',
      autoplayNext: true,
      hoverPreview: true,
      writeTagsToFile: false,
      repeatMode: 'off',        /* off | one | all */
      shuffle: false,
      crossfade: 0,
      gapless: true,
      visualizer: false,
      equalizer: { enabled: false, preset: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      imageAdjustments: { contrast: 100, brightness: 100, sharpness: 100, saturation: 100, shadows: 100, highlights: 100, gamma: 100, denoise: 0, toneMapping: false },
      subtitleStyle: { size: 100, font: 'Roboto', color: '#ffffff', bg: '#000000', position: 'bottom', opacity: 85, offset: 0 },
      skipIntro: true,
      skipCredits: true,
      playbackRate: 1,
      volume: 80,
      sleepTimer: 0,
      seenOnboarding: false,
      menuOpen: false,
      menuCollapsed: false
    };
  }

  let state = initialState();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        state = Object.assign(state, saved);
      }
    } catch (e) { /* ignore corrupted state */ }
    remapMedia();
  }

  /* Keep media sources pointing at the bundled assets even if a cached
     state was persisted with older external URLs. */
  function remapMedia() {
    let i = 0;
    const nextVideo = function () { return Data.SAMPLE[i++ % Data.SAMPLE.length]; };
    state.videos.forEach(function (v) {
      if (!v.source || !/^assets\/media\//.test(v.source)) v.source = nextVideo();
    });
    state.series.forEach(function (ser) {
      ser.seasons.forEach(function (sn) {
        sn.episodes.forEach(function (e) {
          if (!e.source || !/^assets\/media\//.test(e.source)) e.source = nextVideo();
        });
      });
    });
    /* keep stored paths consistent with the seeded library layout */
    const folderForCategory = function (catName) {
      const map = {
        'Cine': 'D:\\Media\\Peliculas',
        'Series': 'D:\\Media\\Series',
        'Documental': 'D:\\Media\\Peliculas\\Documentales',
        'Animación': 'D:\\Media\\Series\\Animacion',
        'Conciertos': 'D:\\Media\\Peliculas\\Recitales',
        'Recetas': 'D:\\Media\\Series\\Recetas',
        'Personal': 'E:\\Familia'
      };
      return map[catName] || 'D:\\Media\\Peliculas';
    };
    const catNameOf = function (catId) {
      const c = state.categories.find(function (x) { return x.id === catId; });
      return c ? c.name : 'Peliculas';
    };
    const baseName = function (p) { return String(p || '').split(/[\\/]/).pop(); };
    state.videos.forEach(function (v) {
      const want = folderForCategory(catNameOf(v.categoryId));
      const name = baseName(v.path);
      if (!v.path || v.path.indexOf('\\') === -1 || v.path.split(/[\\/]/).length < 3) {
        v.path = want + '\\' + name;
      } else if (v.path.indexOf(want) !== 0) {
        v.path = want + '\\' + name;
      }
    });
    state.series.forEach(function (ser) {
      ser.seasons.forEach(function (sn) {
        sn.episodes.forEach(function (e) {
          const name = baseName(e.path);
          if (!e.path || e.path.indexOf('D:\\Media\\Series') !== 0) {
            e.path = 'D:\\Media\\Series\\' + name;
          }
          /* an episode inherits the genre, category and tags of its series */
          if (!e.genre) e.genre = ser.genre;
          if (!e.categoryId) e.categoryId = ser.categoryId;
          if (!e.tags || !e.tags.length) e.tags = (ser.tags || []).slice();
        });
      });
    });

    let a = 0;
    state.tracks.forEach(function (t) {
      if (!t.source || !/^assets\/media\//.test(t.source)) t.source = Data.SAMPLE.length ? 'assets/media/track-0' + (1 + (a++ % 4)) + '.mp3' : t.source;
    });
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* quota */ }
    }, 250);
  }

  function notify(action) {
    listeners.forEach(function (fn) { fn(state, action); });
  }

  /* ---------------- actions (command-side) ---------------- */
  const actions = {
    SET: (payload) => ({ type: 'SET', payload: payload }),

    CREATE_VIDEO: (video) => ({ type: 'CREATE_VIDEO', payload: video }),
    UPDATE_VIDEO: (video) => ({ type: 'UPDATE_VIDEO', payload: video }),
    DELETE_VIDEO: (id) => ({ type: 'DELETE_VIDEO', payload: id }),
    MARK_VIDEO_WATCHED: (id) => ({ type: 'MARK_VIDEO_WATCHED', payload: id }),
    MARK_VIDEO_UNWATCHED: (id) => ({ type: 'MARK_VIDEO_UNWATCHED', payload: id }),
    RATE_VIDEO: (payload) => ({ type: 'RATE_VIDEO', payload: payload }),
    TOGGLE_FAVORITE: (payload) => ({ type: 'TOGGLE_FAVORITE', payload: payload }),
    UPDATE_PROGRESS: (payload) => ({ type: 'UPDATE_PROGRESS', payload: payload }),

    CREATE_SERIES: (s) => ({ type: 'CREATE_SERIES', payload: s }),
    UPDATE_SERIES: (s) => ({ type: 'UPDATE_SERIES', payload: s }),
    ADD_EPISODE: (payload) => ({ type: 'ADD_EPISODE', payload: payload }),
    UPDATE_EPISODE: (payload) => ({ type: 'UPDATE_EPISODE', payload: payload }),
    MARK_EPISODE_WATCHED: (payload) => ({ type: 'MARK_EPISODE_WATCHED', payload: payload }),
    SET_EPISODE_ORDER: (payload) => ({ type: 'SET_EPISODE_ORDER', payload: payload }),

    CREATE_CATEGORY: (c) => ({ type: 'CREATE_CATEGORY', payload: c }),
    UPDATE_CATEGORY: (c) => ({ type: 'UPDATE_CATEGORY', payload: c }),
    DELETE_CATEGORY: (id) => ({ type: 'DELETE_CATEGORY', payload: id }),
    CREATE_TAG: (t) => ({ type: 'CREATE_TAG', payload: t }),
    DELETE_TAG: (t) => ({ type: 'DELETE_TAG', payload: t }),
    ASSIGN_CATEGORY: (payload) => ({ type: 'ASSIGN_CATEGORY', payload: payload }),
    ASSIGN_TAGS: (payload) => ({ type: 'ASSIGN_TAGS', payload: payload }),

    ADD_TRACK: (t) => ({ type: 'ADD_TRACK', payload: t }),
    PLAY_TRACK: (id) => ({ type: 'PLAY_TRACK', payload: id }),
    RATE_TRACK: (payload) => ({ type: 'RATE_TRACK', payload: payload }),
    CREATE_PLAYLIST: (p) => ({ type: 'CREATE_PLAYLIST', payload: p }),
    ADD_TO_PLAYLIST: (payload) => ({ type: 'ADD_TO_PLAYLIST', payload: payload }),
    REMOVE_FROM_PLAYLIST: (payload) => ({ type: 'REMOVE_FROM_PLAYLIST', payload: payload }),
    REORDER_PLAYLIST: (payload) => ({ type: 'REORDER_PLAYLIST', payload: payload }),

    REGISTER_FOLDER: (f) => ({ type: 'REGISTER_FOLDER', payload: f }),
    REMOVE_FOLDER: (id) => ({ type: 'REMOVE_FOLDER', payload: id }),
    SCAN_LIBRARY: (id) => ({ type: 'SCAN_LIBRARY', payload: id }),
    IGNORE_FILE: (id) => ({ type: 'IGNORE_FILE', payload: id }),
    RESOLVE_DUPLICATE: (id) => ({ type: 'RESOLVE_DUPLICATE', payload: id }),

    MOVE_FILES: (payload) => ({ type: 'MOVE_FILES', payload: payload }),
    COPY_FILES: (payload) => ({ type: 'COPY_FILES', payload: payload }),
    BATCH_RENAME: (payload) => ({ type: 'BATCH_RENAME', payload: payload }),
    TRASH_FILES: (payload) => ({ type: 'TRASH_FILES', payload: payload }),
    RESTORE_FILE: (id) => ({ type: 'RESTORE_FILE', payload: id }),
    DELETE_PERMANENT: (id) => ({ type: 'DELETE_PERMANENT', payload: id }),
    CREATE_FOLDER: (payload) => ({ type: 'CREATE_FOLDER', payload: payload }),
    DELETE_FOLDER: (payload) => ({ type: 'DELETE_FOLDER', payload: payload }),
    TOGGLE_HIDDEN: (payload) => ({ type: 'TOGGLE_HIDDEN', payload: payload }),

    UPDATE_PROFILE: (p) => ({ type: 'UPDATE_PROFILE', payload: p }),
    CREATE_PROFILE: (p) => ({ type: 'CREATE_PROFILE', payload: p }),
    DELETE_PROFILE: (id) => ({ type: 'DELETE_PROFILE', payload: id }),
    SWITCH_PROFILE: (id) => ({ type: 'SWITCH_PROFILE', payload: id }),
    SET_PREFERENCES: (p) => ({ type: 'SET_PREFERENCES', payload: p }),

    READ_NOTIFICATION: (id) => ({ type: 'READ_NOTIFICATION', payload: id }),
    DISMISS_NOTIFICATION: (id) => ({ type: 'DISMISS_NOTIFICATION', payload: id }),

    UPDATE_SETTINGS: (s) => ({ type: 'UPDATE_SETTINGS', payload: s }),
    LOG_ACTIVITY: (a) => ({ type: 'LOG_ACTIVITY', payload: a }),
    TOGGLE_THEME: () => ({ type: 'TOGGLE_THEME' }),
    SET_LANG: (l) => ({ type: 'SET_LANG', payload: l })
  };

  /* ---------------- reducer ---------------- */
  function reduce(s, action) {
    const p = action.payload;
    switch (action.type) {
      case 'SET': return Object.assign({}, s, p);

      case 'CREATE_VIDEO': s.videos.unshift(p); return s;
      case 'UPDATE_VIDEO': {
        const i = s.videos.findIndex(v => v.id === p.id);
        if (i >= 0) s.videos[i] = Object.assign({}, s.videos[i], p);
        return s;
      }
      case 'DELETE_VIDEO': s.videos = s.videos.filter(v => v.id !== p); return s;
      case 'MARK_VIDEO_WATCHED': {
        const v = s.videos.find(x => x.id === p);
        if (v) { v.watched = true; v.progress = v.duration; }
        return s;
      }
      case 'MARK_VIDEO_UNWATCHED': {
        const v = s.videos.find(x => x.id === p);
        if (v) { v.watched = false; v.progress = 0; }
        return s;
      }
      case 'RATE_VIDEO': {
        const v = s.videos.find(x => x.id === p.id);
        if (v) v.rating = p.rating;
        return s;
      }
      case 'TOGGLE_FAVORITE': {
        const v = s.videos.find(x => x.id === p.id);
        if (v) v.favorite = !v.favorite;
        return s;
      }
      case 'UPDATE_PROGRESS': {
        const v = s.videos.find(x => x.id === p.id);
        if (v) {
          v.progress = p.progress;
          v.watched = p.progress >= (v.duration - 20);
          if (v.watched) v.progress = v.duration;
        }
        return s;
      }

      case 'CREATE_SERIES': s.series.unshift(p); return s;
      case 'UPDATE_SERIES': {
        const i = s.series.findIndex(x => x.id === p.id);
        if (i >= 0) s.series[i] = Object.assign({}, s.series[i], p);
        return s;
      }
      case 'ADD_EPISODE': {
        const ser = s.series.find(x => x.id === p.seriesId);
        if (ser) {
          let season = ser.seasons.find(sn => sn.id === p.seasonId);
          if (!season) { season = { id: p.seasonId, number: ser.seasons.length + 1, title: 'Temporada ' + (ser.seasons.length + 1), episodes: [] }; ser.seasons.push(season); }
          season.episodes.push(p.episode);
          season.episodes.sort((a, b) => a.number - b.number);
        }
        return s;
      }
      case 'UPDATE_EPISODE': {
        const ser = s.series.find(x => x.id === p.seriesId);
        if (ser) ser.seasons.forEach(sn => {
          const i = sn.episodes.findIndex(e => e.id === p.episode.id);
          if (i >= 0) sn.episodes[i] = Object.assign({}, sn.episodes[i], p.episode);
        });
        return s;
      }
      case 'MARK_EPISODE_WATCHED': {
        const ser = s.series.find(x => x.id === p.seriesId);
        if (ser) ser.seasons.forEach(sn => {
          const e = sn.episodes.find(x => x.id === p.episodeId);
          if (e) { e.watched = true; e.progress = e.duration; }
        });
        return s;
      }
      case 'SET_EPISODE_ORDER': {
        const ser = s.series.find(x => x.id === p.seriesId);
        if (ser) ser.seasons.forEach(sn => {
          const e = sn.episodes.find(x => x.id === p.episodeId);
          if (e) e.number = p.number;
          sn.episodes.sort((a, b) => a.number - b.number);
        });
        return s;
      }

      case 'CREATE_CATEGORY': s.categories.push({ id: 'c' + Date.now(), color: '#4f5bd5', ...p }); return s;
      case 'UPDATE_CATEGORY': { const i = s.categories.findIndex(c => c.id === p.id); if (i >= 0) s.categories[i] = Object.assign({}, s.categories[i], p); return s; }
      case 'DELETE_CATEGORY': s.categories = s.categories.filter(c => c.id !== p); s.videos.forEach(v => { if (v.categoryId === p) v.categoryId = null; }); return s;
      case 'CREATE_TAG': if (!s.tags.includes(p)) s.tags.push(p); return s;
      case 'DELETE_TAG': s.tags = s.tags.filter(t => t !== p); s.videos.forEach(v => { v.tags = v.tags.filter(t => t !== p); }); return s;
      case 'ASSIGN_CATEGORY': { const v = s.videos.find(x => x.id === p.id); if (v) v.categoryId = p.categoryId; return s; }
      case 'ASSIGN_TAGS': { const v = s.videos.find(x => x.id === p.id); if (v) v.tags = p.tags.slice(); return s; }

      case 'ADD_TRACK': s.tracks.push(p); return s;
      case 'PLAY_TRACK': { const t = s.tracks.find(x => x.id === p); if (t) { t.plays = (t.plays || 0) + 1; t.played = Date.now(); } return s; }
      case 'RATE_TRACK': { const t = s.tracks.find(x => x.id === p.id); if (t) t.rating = p.rating; return s; }
      case 'CREATE_PLAYLIST': s.playlists.unshift(p); return s;
      case 'ADD_TO_PLAYLIST': { const pl = s.playlists.find(x => x.id === p.playlistId); if (pl && !pl.trackIds.includes(p.trackId)) pl.trackIds.push(p.trackId); return s; }
      case 'REMOVE_FROM_PLAYLIST': { const pl = s.playlists.find(x => x.id === p.playlistId); if (pl) pl.trackIds = pl.trackIds.filter(t => t !== p.trackId); return s; }
      case 'REORDER_PLAYLIST': { const pl = s.playlists.find(x => x.id === p.playlistId); if (pl) pl.trackIds = p.trackIds; return s; }

      case 'REGISTER_FOLDER': s.folders.push(p); return s;
      case 'REMOVE_FOLDER': s.folders = s.folders.filter(f => f.id !== p); return s;
      case 'SCAN_LIBRARY': {
        const f = s.folders.find(x => x.id === p);
        if (f) f.lastScan = new Date().toISOString();
        s.scanStatus = { running: false, progress: 100, message: 'Escaneo completado: ' + (f ? f.files : 0) + ' archivos', lastRun: new Date().toISOString() };
        return s;
      }
      case 'IGNORE_FILE': s.ignored.push({ id: 'ig' + Date.now(), name: p.name, path: p.path, reason: p.reason || 'Ignorado manualmente' }); return s;
      case 'RESOLVE_DUPLICATE': s.duplicates = s.duplicates.filter(d => d.id !== p); return s;

      case 'MOVE_FILES': case 'COPY_FILES': {
        const dest = p.dest;
        (p.ids || []).forEach(id => {
          const v = s.videos.find(x => x.id === id);
          if (v) {
            const name = v.path.split(/[\\/]/).pop();
            if (action.type === 'MOVE_FILES') v.path = dest.replace(/[\\/]+$/, '') + '\\' + name;
          }
        });
        return s;
      }
      case 'BATCH_RENAME': {
        const v = s.videos.find(x => x.id === p.id);
        if (v) {
          const ext = (v.path.match(/\.[A-Za-z0-9]+$/) || ['.mkv'])[0];
          const base = p.template.replace('{n}', String(p.index).padStart(2, '0')).replace('{title}', v.title);
          v.path = v.path.replace(/[\\/][^\\/]+$/, '\\' + base.replace(/[\\/:*?"<>|]/g, '') + ext);
        }
        return s;
      }
      case 'TRASH_FILES': {
        (p.ids || []).forEach(id => {
          const v = s.videos.find(x => x.id === id);
          if (v) s.trash.push({ id: 'tr' + Date.now() + id, videoId: id, name: v.path.split(/[\\/]/).pop(), path: v.path, at: new Date().toISOString() });
        });
        return s;
      }
      case 'RESTORE_FILE': {
        const t = s.trash.find(x => x.id === p);
        if (t) { const v = s.videos.find(x => x.id === t.videoId); if (v) v.path = t.path; }
        s.trash = s.trash.filter(x => x.id !== p);
        return s;
      }
      case 'DELETE_PERMANENT': s.trash = s.trash.filter(x => x.id !== p); return s;
      case 'CREATE_FOLDER': s.folders.push({ id: 'lf' + Date.now(), name: p.name, path: p.path, scope: p.scope || 'Personal', autoScan: false, lastScan: null, files: 0, sizeBytes: 0 }); return s;
      case 'DELETE_FOLDER': s.folders = s.folders.filter(f => f.id !== p.id); return s;
      case 'TOGGLE_HIDDEN': {
        const v = s.videos.find(x => x.id === p.id);
        if (v) v.hidden = !v.hidden;
        const i = s.hiddenFolders.indexOf(p.id);
        if (i >= 0) s.hiddenFolders.splice(i, 1); else s.hiddenFolders.push(p.id);
        return s;
      }

      case 'UPDATE_PROFILE': { const i = s.profiles.findIndex(x => x.id === p.id); if (i >= 0) s.profiles[i] = Object.assign({}, s.profiles[i], p); return s; }
      case 'CREATE_PROFILE': s.profiles.push(p); return s;
      case 'DELETE_PROFILE': s.profiles = s.profiles.filter(p2 => p2.id !== p); return s;
      case 'SWITCH_PROFILE': s.currentProfileId = p; return s;
      case 'SET_PREFERENCES': {
        const prof = s.profiles.find(x => x.id === (p.id || s.currentProfileId));
        if (prof) prof.preferences = Object.assign({}, prof.preferences, p.preferences);
        return s;
      }

      case 'READ_NOTIFICATION': { const n = s.notifications.find(x => x.id === p); if (n) n.read = true; return s; }
      case 'DISMISS_NOTIFICATION': s.notifications = s.notifications.filter(x => x.id !== p); return s;

      case 'UPDATE_SETTINGS': s.settings = Object.assign({}, s.settings, p); return s;
      case 'LOG_ACTIVITY': s.activity.unshift(Object.assign({ id: 'a' + Date.now(), at: new Date().toISOString() }, p)); s.activity = s.activity.slice(0, 200); return s;
      case 'TOGGLE_THEME': {
        const order = ['auto', 'light', 'dark'];
        s.theme = order[(order.indexOf(s.theme) + 1) % 3];
        return s;
      }
      case 'SET_LANG': s.lang = p; return s;
      default: return s;
    }
  }

  function dispatch(action) {
    state = reduce(state, action);
    save();
    notify(action);
    return action;
  }

  /* ---------------- selectors (query-side) ---------------- */
  const selectors = {
    currentProfile: (s) => s.profiles.find(p => p.id === s.currentProfileId) || s.profiles[0],
    allEpisodes: (s) => {
      const out = [];
      s.series.forEach(ser => ser.seasons.forEach(sn => sn.episodes.forEach(e => out.push(Object.assign({ kind: 'episode', seriesId: ser.id, seriesTitle: ser.title, seasonNumber: sn.number }, e)))));
      s.videos.forEach(v => out.push(Object.assign({ kind: 'video' }, v)));
      return out;
    },
    visibleEpisodes: (s) => {
      const prof = selectors.currentProfile(s);
      const unlock = global.Session && global.Session.hiddenUnlocked;
      return selectors.allEpisodes(s).filter(e => {
        if (e.hidden && !unlock) return false;
        if (prof && prof.role === 'child' && prof.parental && prof.parental.enabled) {
          if (e.tags && e.tags.some(t => ['terror', 'adulto'].includes(t))) return false;
        }
        return true;
      });
    },
    continueWatching: (s) => selectors.visibleEpisodes(s).filter(e => e.progress > 30 && e.progress < e.duration - 30).slice(0, 12),
    recentlyAdded: (s) => selectors.visibleEpisodes(s).slice().sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)).slice(0, 16),
    favorites: (s) => selectors.visibleEpisodes(s).filter(e => e.favorite),
    unreadNotifications: (s) => s.notifications.filter(n => !n.read).length,
    storageUsed: (s) => s.serverStatus.storageUsedBytes,
    storageTotal: (s) => s.serverStatus.storageTotalBytes,
    byCategory: (s, id) => selectors.visibleEpisodes(s).filter(e => e.categoryId === id),
    byTags: (s, tags, mode) => {
      const list = selectors.visibleEpisodes(s);
      if (!tags || !tags.length) return list;
      return list.filter(e => mode === 'all' ? tags.every(t => e.tags.includes(t)) : tags.some(t => e.tags.includes(t)));
    },
    byQuality: (s, q) => q ? selectors.visibleEpisodes(s).filter(e => e.quality === q) : selectors.visibleEpisodes(s),
    byDuration: (s, min, max) => selectors.visibleEpisodes(s).filter(e => (!min || e.duration >= min) && (!max || e.duration <= max)),
    related: (s, item) => {
      if (!item) return [];
      const tags = item.tags || [];
      return selectors.visibleEpisodes(s)
        .filter(e => e.id !== item.id && e.kind === item.kind)
        .map(e => ({ e: e, score: (e.categoryId === item.categoryId ? 2 : 0) + (e.tags || []).filter(t => tags.includes(t)).length }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(x => x.e);
    },
    recommendations: (s) => {
      const seen = new Set(s.tracks.map(t => t.artistId));
      return s.tracks.filter(t => !seen.has(t.artistId)).slice(0, 10);
    },
    topGenres: (s) => {
      const m = {};
      selectors.visibleEpisodes(s).forEach(e => { const g = e.genre || 'Sin género'; m[g] = (m[g] || 0) + (e.duration || 0); });
      return Object.entries(m).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value).slice(0, 8);
    },
    topArtists: (s) => {
      const m = {};
      s.tracks.forEach(t => { m[t.artistName] = (m[t.artistName] || 0) + (t.plays || 0); });
      return Object.entries(m).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value).slice(0, 8);
    }
  };

  global.Store = {
    get state() { return state; },
    dispatch: dispatch,
    actions: actions,
    selectors: selectors,
    subscribe: function (fn) { listeners.push(fn); return function () { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    load: load,
    save: save,
    reset: function () { state = initialState(); save(); notify({ type: 'RESET' }); }
  };

  load();
})(window);
