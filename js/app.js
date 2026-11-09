/* =====================================================================
   MediaHub — App controller
   Hash routing, global event delegation and every command handler.
   ===================================================================== */
(function (global) {
  'use strict';

  const { $, $$, toast, openDialog, closeDialog } = UI;

  let currentRoute = { name: 'inicio', params: {} };

  /* ================= ROUTING ================= */
  const routes = {
    'inicio': function () { return Views.inicio(); },
    'series': function (p) { return p.id ? Views.seriesDetail(p.id) : Views.seriesList(); },
    'videos': function (p) { return Views.videosList(p.filters || {}); },
    'video': function (p) { return Views.videoDetail(p.id); },
    'musica': function () { return Views.musica(); },
    'galeria': function () { return Views.galeria(); },
    'buscar': function (p) { return Views.buscar(p.q || ''); },
    'taxonomia': function () { return Views.taxonomia(); },
    'biblioteca': function () { return Views.biblioteca(); },
    'usuarios': function () { return Views.usuarios(); },
    'estadisticas': function () { return Views.estadisticas(); },
    'admin': function () { return Views.admin(); },
    'notificaciones': function () { return Views.notificaciones(); }
  };

  function parseHash() {
    const raw = (location.hash || '#/inicio').replace(/^#\/?/, '');
    const parts = raw.split('?');
    const seg = parts[0].split('/').filter(Boolean);
    const name = seg[0] || 'inicio';
    const params = { id: seg[1] };
    if (parts[1]) {
      const qs = new URLSearchParams(parts[1]);
      const filters = {};
      qs.forEach(function (v, k) {
        if (k === 'tags') filters.tags = (filters.tags || []).concat([v]);
        else filters[k] = v;
      });
      params.filters = filters;
      params.q = qs.get('q') || '';
      params.play = qs.get('play') || '';
    }
    return { name: name, params: params };
  }

  function render() {
    const route = parseHash();
    /* a route change dismisses any open dialog */
    if (UI.hasOpenDialog()) UI.closeAllDialogs();
    currentRoute = route;
    const fn = routes[route.name] || routes.inicio;
    const main = $('#main');
    main.innerHTML = fn(route.params);
    Icons.paint(main);

    /* nav active state */
    const navName = route.name === 'video' ? 'videos' : route.name;
    $$('#navItems .nav-item').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-nav') === navName);
    });

    /* route-specific post-render */
    /* deep link: #/video/<id>?play=1 starts playback immediately */
    if ((route.name === 'video' || route.name === 'series') && route.params.play === '1') {
      const target = route.name === 'video'
        ? findItem(route.params.id)
        : (function () {
            const ser = Store.state.series.find(function (x) { return x.id === route.params.id; });
            if (!ser || !ser.seasons.length) return null;
            const sn = ser.seasons[0];
            const ep = sn.episodes[0];
            return ep ? Object.assign({ kind: 'episode', seriesId: ser.id, seriesTitle: ser.title, seasonNumber: sn.number }, ep) : null;
          })();
      if (target) setTimeout(function () { Player.openVideo(target); }, 60);
    }

    if (route.name === 'usuarios') Views.renderPrefs();
    if (route.name === 'admin') Views.renderAdminControls();
    if (route.name === 'galeria') wireGallery();
    if (route.name === 'videos') wireVideoFilters();
    if (route.name === 'series' && route.params.id) wireSeasonTabs(route.params.id);

    document.title = titleFor(route) + ' · MediaHub';
    $('#contentTop') && ($('#contentTop').scrollTop = 0);
    main.scrollTop = 0;
  }

  function titleFor(route) {
    const map = {
      inicio: 'Inicio', series: 'Series', videos: 'Videos', musica: 'Música',
      galeria: 'Galería', buscar: 'Buscar', taxonomia: 'Taxonomía',
      biblioteca: 'Biblioteca', usuarios: 'Usuarios', estadisticas: 'Estadísticas',
      admin: 'Administración', notificaciones: 'Notificaciones', video: 'Detalle'
    };
    return map[route.name] || 'MediaHub';
  }

  function navigate(path) { location.hash = path; }

  /* ================= MENU LATERAL ================= */
  const NARROW = 900;

  function isNarrow() { return window.innerWidth <= NARROW; }

  /* On narrow screens the rail is a drawer (nav-open);
     on wide screens it collapses to icons (nav-collapsed). */
  function applyMenuState() {
    const narrow = isNarrow();
    const open = narrow ? Store.state.menuOpen : !Store.state.menuCollapsed;
    document.body.classList.toggle('nav-open', narrow && open);
    document.body.classList.toggle('nav-collapsed', !narrow && !open);
    $('#navScrim').hidden = !(narrow && open);
    const btn = $('#menuToggle');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Ocultar el menu lateral' : 'Mostrar el menu lateral');
  }

  function toggleMenu() {
    if (isNarrow()) {
      Store.dispatch(Store.actions.SET({ menuOpen: !Store.state.menuOpen }));
    } else {
      Store.dispatch(Store.actions.SET({ menuCollapsed: !Store.state.menuCollapsed }));
    }
    applyMenuState();
  }

  function closeMenu() {
    /* cierra el drawer (solo tiene sentido en pantallas estrechas) */
    if (isNarrow() && Store.state.menuOpen) {
      Store.dispatch(Store.actions.SET({ menuOpen: false }));
    }
    applyMenuState();
  }

  function expandRail() {
    /* Escape en escritorio: vuelve a mostrar la barra completa */
    if (!isNarrow() && Store.state.menuCollapsed) {
      Store.dispatch(Store.actions.SET({ menuCollapsed: false }));
    }
    applyMenuState();
  }

  /* ================= HOVER PREVIEW (listados) ================= */
  let hoverTimer = null;
  function wireHoverPreviews() {
    $$('[data-open]').forEach(function (el) {
      if (el.dataset.hoverWired) return;
      el.dataset.hoverWired = '1';
      el.addEventListener('mouseenter', function () {
        if (!Store.state.hoverPreview) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(function () { startHoverPreview(el); }, 380);
      });
      el.addEventListener('mouseleave', function () {
        clearTimeout(hoverTimer);
        stopHoverPreview();
      });
    });
  }

  function startHoverPreview(el) {
    const thumb = el.querySelector('.card-poster .ph, .cw-thumb');
    if (!thumb) return;
    const rect = thumb.getBoundingClientRect();
    const host = $('#hoverPreview');
    const item = findItem(el.getAttribute('data-open'));
    host.innerHTML = '<div class="hpv-canvas" style="width:' + rect.width + 'px;height:' + rect.height + 'px;background-image:url(' + (item && item.thumbnail ? item.thumbnail : '') + ');background-size:cover;background-position:center"></div>';
    host.style.left = rect.left + 'px';
    host.style.top = rect.top + 'px';
    host.style.width = rect.width + 'px';
    host.style.height = rect.height + 'px';
    host.hidden = false;
    /* subtle "video" motion to simulate muted preview playback */
    const canvas = host.querySelector('.hpv-canvas');
    let t = 0;
    const anim = setInterval(function () {
      t += 0.02;
      canvas.style.transform = 'scale(' + (1 + Math.sin(t) * 0.04) + ') translateX(' + (Math.sin(t * 0.7) * 3) + 'px)';
      canvas.style.filter = 'brightness(' + (1 + Math.sin(t * 1.3) * 0.06) + ')';
    }, 50);
    host._anim = anim;
  }

  function stopHoverPreview() {
    const host = $('#hoverPreview');
    if (host._anim) { clearInterval(host._anim); host._anim = null; }
    host.hidden = true;
  }

  function findItem(id) {
    const s = Store.state;
    return s.videos.find(function (v) { return v.id === id; }) ||
      Store.selectors.allEpisodes(s).find(function (e) { return e.id === id; }) ||
      null;
  }

  /* ================= EVENT DELEGATION ================= */
  function wireGlobalEvents() {
    document.addEventListener('click', function (e) {
      /* nav links handled natively; intercept data-nav-go */
      const navGo = e.target.closest('[data-nav-go]');
      if (navGo) { navigate('#/' + navGo.getAttribute('data-nav-go')); return; }

      /* card open */
      const opener = e.target.closest('[data-open]');
      if (opener && !e.target.closest('[data-act]')) {
        const kind = opener.getAttribute('data-kind');
        const id = opener.getAttribute('data-open');
        navigate('#/' + (kind === 'series' ? 'series/' : 'video/') + id);
        return;
      }

      /* track row */
      const track = e.target.closest('[data-track]');
      if (track && !e.target.closest('[data-act]')) {
        const id = track.getAttribute('data-track');
        const t = Store.state.tracks.find(function (x) { return x.id === id; });
        if (t) {
          const idx = Store.state.tracks.indexOf(t);
          Player.playTracks(Store.state.tracks.slice(Math.max(0, idx - 5), idx + 12), Math.min(5, idx));
          toast('Reproduciendo: ' + t.title, 'success');
        }
        return;
      }

      /* artist / album / playlist */
      const artist = e.target.closest('[data-artist]');
      if (artist && !e.target.closest('[data-act]')) { showArtist(artist.getAttribute('data-artist')); return; }
      const album = e.target.closest('[data-album]');
      if (album && !e.target.closest('[data-act]')) { showAlbum(album.getAttribute('data-album')); return; }
      const playlist = e.target.closest('[data-playlist]');
      if (playlist && !e.target.closest('[data-act]')) { showPlaylist(playlist.getAttribute('data-playlist')); return; }

      /* category chip filter */
      const cat = e.target.closest('[data-cat]');
      if (cat && !e.target.closest('[data-act]')) { navigate('#/videos?category=' + cat.getAttribute('data-cat')); return; }

      /* gallery path */
      const goto = e.target.closest('[data-goto-path]');
      if (goto) { global.GalleryPath = goto.getAttribute('data-goto-path'); render(); return; }

      /* season tab */
      const seasonTab = e.target.closest('[data-season]');
      if (seasonTab) {
        const ser = Store.state.series.find(function (s) { return s.id === currentRoute.params.id; });
        if (ser) {
          $$('#seasonTabs .chip').forEach(function (c) { c.classList.remove('selected'); });
          seasonTab.classList.add('selected');
          const sn = ser.seasons.find(function (x) { return x.id === seasonTab.getAttribute('data-season'); });
          $('#epList').innerHTML = Views ? renderEpisodesLocal(ser, sn) : '';
          Icons.paint($('#epList'));
          wireHoverPreviews();
        }
        return;
      }

      /* music tab */
      const mtab = e.target.closest('[data-music-tab]');
      if (mtab) { global.MusicTab = mtab.getAttribute('data-music-tab'); render(); return; }

      /* clear filter */
      const cf = e.target.closest('[data-clear-filter]');
      if (cf) {
        const f = (currentRoute.params.filters || {});
        const k = cf.getAttribute('data-clear-filter');
        delete f[k];
        if (k === 'tags' && f.tags) f.tags = [];
        currentRoute.params.filters = f;
        navigate('#/videos?' + new URLSearchParams(flattenFilters(f)).toString());
        return;
      }

      /* eq preset chips (inline in music view) */
      const eqp = e.target.closest('[data-eq-preset]');
      if (eqp) {
        const eq = Store.state.equalizer;
        eq.preset = eqp.getAttribute('data-eq-preset');
        eq.enabled = true;
        eq.gains = (window.__EQ_PRESETS || {})[eq.preset] || eq.gains;
        Store.dispatch(Store.actions.SET({ equalizer: eq }));
        render();
        return;
      }

      const act = e.target.closest('[data-act]');
      if (act) {
        handleAction(act.getAttribute('data-act'), act);
      }
    });

    /* global search */
    let searchTimer = null;
    $('#globalSearch').addEventListener('input', function (e) {
      clearTimeout(searchTimer);
      const v = e.target.value;
      searchTimer = setTimeout(function () {
        if (v.trim()) navigate('#/buscar?q=' + encodeURIComponent(v.trim()));
      }, 320);
    });

    /* keyboard: "/" focuses search */
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault();
        $('#globalSearch').focus();
      }
      if (e.key === 'Escape') {
        if (UI.hasOpenDialog()) UI.closeDialog();
        else if (!$('#playerOverlay').hidden) Player.closeVideo();
        else if (isNarrow()) closeMenu();
        else expandRail();
      }
    });

    /* theme / lang / profile */
    $('#themeBtn').addEventListener('click', function () {
      Store.dispatch(Store.actions.TOGGLE_THEME());
      applyTheme();
      toast('Tema: ' + Store.state.theme, 'info');
    });
    $('#langBtn').addEventListener('click', function () {
      const l = Store.state.lang === 'es' ? 'en' : 'es';
      Store.dispatch(Store.actions.SET_LANG(l));
      toast(l === 'es' ? 'Idioma: Español' : 'Language: English (UI completa en español en esta demo)', 'info');
    });
    $('#menuToggle').addEventListener('click', toggleMenu);
    $('#navScrim').addEventListener('click', closeMenu);
    /* closing the drawer on navigation (only in narrow mode: in desktop
       clicking a rail item must not expand a collapsed rail) */
    $$('#navItems .nav-item').forEach(function (a) {
      a.addEventListener('click', function () { if (isNarrow()) closeMenu(); });
    });
    /* crossing the breakpoint: the drawer always starts closed, while the
       desktop "collapsed rail" preference is preserved */
    let wasNarrow = isNarrow();
    window.addEventListener('resize', function () {
      const narrow = isNarrow();
      if (narrow !== wasNarrow) {
        wasNarrow = narrow;
        if (Store.state.menuOpen) Store.dispatch(Store.actions.SET({ menuOpen: false }));
      }
      applyMenuState();
    });
    $('#notifBtn').addEventListener('click', function () { navigate('#/notificaciones'); });
    $('#addContentBtn').addEventListener('click', function () { openAddMenu(); });
    $('#profileChip').addEventListener('click', function (e) { e.stopPropagation(); openProfileMenu(); });

    /* store subscription -> refresh badges and nav */
    Store.subscribe(function (state, action) {
      refreshChrome();
      if (action && (action.type === 'SET')) applyMenuState();
    });
  }

  /* keep the persistent chrome in sync with the store */
  function refreshChrome() {
    const n = Store.selectors.unreadNotifications(Store.state);
    const badge = $('#notifBadge');
    const dot = $('#notifDot');
    badge.textContent = n;
    badge.hidden = n === 0;
    dot.hidden = n === 0;
    const p = Store.selectors.currentProfile(Store.state);
    $('#profileName').textContent = p.name;
    $('#profileRole').textContent = p.role;
    $('#profileAvatar').textContent = p.avatar;
    $('#profileChip').setAttribute('title', p.name + ' · ' + p.role);
    const used = Store.selectors.storageUsed(Store.state);
    const total = Store.selectors.storageTotal(Store.state);
    const pct = Math.round((used / total) * 100);
    $('#storagePct').textContent = pct + '%';
    $('#storageBar').style.width = pct + '%';
  }

  function flattenFilters(f) {
    const out = {};
    Object.keys(f).forEach(function (k) {
      if (k === 'tags') (f.tags || []).forEach(function (t) { out['tags'] = t; });
      else out[k] = f[k];
    });
    return out;
  }

  function renderEpisodesLocal(ser, sn) {
    if (!sn) return '';
    return sn.episodes.slice().sort(function (a, b) { return a.number - b.number; }).map(function (e) {
      const p = e.duration ? Math.min(100, (e.progress / e.duration) * 100) : 0;
      return '<article class="ep-item" data-open="' + UI.escapeHtml(e.id) + '" data-kind="video">' +
        '<div class="ep-thumb" style="background-image:url(' + e.thumbnail + ')"><span class="ep-num">E' + e.number + '</span>' +
        (e.watched ? '<span class="badge top">' + Icons.svg('check', 13) + '</span>' : '') + '</div>' +
        '<div class="ep-info"><div class="ep-title">' + UI.escapeHtml(e.title) + '</div>' +
        '<div class="ep-meta"><span>' + UI.formatDuration(e.duration) + '</span><span>' + UI.escapeHtml(e.quality || '') + '</span>' +
        '<span>' + UI.escapeHtml(e.videoCodec || '') + '</span></div>' +
        (p > 1 ? '<div class="progress-line"><i style="width:' + p + '%"></i></div>' : '') + '</div>' +
        '<div class="ep-actions">' +
        '<button class="icon-btn" data-act="watched" data-id="' + e.id + '" data-series="' + ser.id + '">' + Icons.svg('watch', 19) + '</button>' +
        '<button class="icon-btn" data-act="edit-episode" data-id="' + e.id + '" data-series="' + ser.id + '">' + Icons.svg('edit', 19) + '</button>' +
        '<button class="icon-btn" data-act="play" data-id="' + e.id + '">' + Icons.svg('play', 19) + '</button>' +
        '</div></article>';
    }).join('');
  }

  /* ================= ACTION HANDLERS ================= */
  function handleAction(act, el) {
    const id = el.getAttribute('data-id');

    switch (act) {
      case 'add': openAddMenu(); break;

      case 'play': {
        const item = findItem(id);
        if (item) Player.openVideo(item);
        break;
      }
      case 'play-series': {
        const ser = Store.state.series.find(function (s) { return s.id === id; });
        if (ser && ser.seasons.length) {
          const sn = ser.seasons[0];
          const ep = sn.episodes[0];
          if (ep) Player.openVideo(Object.assign({ kind: 'episode', seriesId: ser.id, seriesTitle: ser.title, seasonNumber: sn.number }, ep));
        }
        break;
      }
      case 'play-track': {
        const t = Store.state.tracks.find(function (x) { return x.id === id; });
        if (t) {
          const idx = Store.state.tracks.indexOf(t);
          Player.playTracks(Store.state.tracks.slice(Math.max(0, idx - 5), idx + 12), Math.min(5, idx));
        }
        break;
      }
      case 'play-playlist': {
        const pl = Store.state.playlists.find(function (p) { return p.id === id; });
        if (pl) {
          let ids = pl.trackIds;
          if (!ids.length && pl.rules) {
            if (pl.rules.type === 'notPlayed') ids = Store.state.tracks.filter(function (t) { return (t.plays || 0) === 0; }).map(function (t) { return t.id; });
            if (pl.rules.type === 'recentlyAdded') {
              const cut = Date.now() - pl.rules.days * 86400000;
              ids = Store.state.tracks.filter(function (t) { return new Date(t.addedAt).getTime() >= cut; }).map(function (t) { return t.id; });
            }
          }
          const trs = ids.map(function (tid) { return Store.state.tracks.find(function (t) { return t.id === tid; }); }).filter(Boolean);
          if (trs.length) Player.playTracks(trs, 0);
          else toast('Esta playlist inteligente aún no tiene pistas que coincidan.', 'info');
        }
        break;
      }

      case 'edit': {
        const v = Store.state.videos.find(function (x) { return x.id === id; });
        if (v) openEditVideo(v);
        break;
      }
      case 'edit-episode': {
        const seriesId = el.getAttribute('data-series');
        const ser = Store.state.series.find(function (s) { return s.id === seriesId; });
        let ep = null;
        if (ser) ser.seasons.forEach(function (sn) { sn.episodes.forEach(function (e) { if (e.id === id) ep = e; }); });
        if (ep) openEditEpisode(ser, ep);
        break;
      }
      case 'edit-series': {
        const ser = Store.state.series.find(function (s) { return s.id === id; });
        if (ser) openEditSeries(ser);
        break;
      }
      case 'fav': {
        const v = Store.state.videos.find(function (x) { return x.id === id; });
        if (v) { Store.dispatch(Store.actions.TOGGLE_FAVORITE({ id: id })); toast(v.favorite ? 'Añadido a favoritos.' : 'Quitado de favoritos.', 'success'); render(); }
        break;
      }
      case 'fav-series': {
        const ser = Store.state.series.find(function (s) { return s.id === id; });
        if (ser) { ser.favorite = !ser.favorite; Store.dispatch(Store.actions.SET({ series: Store.state.series })); render(); }
        break;
      }
      case 'watched': {
        const seriesId = el.getAttribute('data-series');
        const item = findItem(id);
        if (item) {
          if (item.kind === 'episode') Store.dispatch(Store.actions.MARK_EPISODE_WATCHED({ seriesId: seriesId, episodeId: id }));
          else Store.dispatch(Store.actions.MARK_VIDEO_WATCHED(id));
          toast('Marcado como visto.', 'success');
          render();
        }
        break;
      }
      case 'hide': {
        Store.dispatch(Store.actions.TOGGLE_HIDDEN({ id: id }));
        toast('Estado de visibilidad actualizado.', 'success');
        render();
        break;
      }
      case 'rate': {
        const v = findItem(id);
        if (v) openRateDialog(v);
        break;
      }
      case 'autoplay': {
        const ser = Store.state.series.find(function (s) { return s.id === id; });
        if (ser) {
          ser.autoplayNext = !ser.autoplayNext;
          Store.dispatch(Store.actions.SET({ series: Store.state.series }));
          toast('Autoplay del siguiente episodio: ' + (ser.autoplayNext ? 'activado' : 'desactivado'), 'info');
          render();
        }
        break;
      }
      case 'add-series': openCreateSeries(); break;
      case 'add-season': {
        const ser = Store.state.series.find(function (s) { return s.id === id; });
        if (ser) {
          const n = ser.seasons.length + 1;
          ser.seasons.push({ id: ser.id + '-s' + n, number: n, title: 'Temporada ' + n, episodes: [] });
          Store.dispatch(Store.actions.SET({ series: Store.state.series }));
          toast('Temporada ' + n + ' creada.', 'success');
          render();
        }
        break;
      }
      case 'add-episode': {
        const ser = Store.state.series.find(function (s) { return s.id === id; });
        if (ser) {
          let lastSn = ser.seasons[ser.seasons.length - 1];
          if (!lastSn) {
            const n = ser.seasons.length + 1;
            lastSn = { id: ser.id + '-s' + n, number: n, title: 'Temporada ' + n, episodes: [] };
            ser.seasons.push(lastSn);
            Store.dispatch(Store.actions.SET({ series: Store.state.series }));
          }
          openMediaForm({
            mode: 'episode', seriesId: ser.id, seasonId: lastSn.id,
            seasonNumber: lastSn.number
          });
        }
        break;
      }
      case 'sort-episodes': {
        const s = Store.state;
        s.series.forEach(function (ser) {
          ser.seasons.forEach(function (sn) {
            sn.episodes.sort(function (a, b) { return a.title.localeCompare(b.title); });
            sn.episodes.forEach(function (e, i) { e.number = i + 1; });
          });
        });
        Store.dispatch(Store.actions.SET({ series: s.series }));
        toast('Episodios ordenados alfabéticamente.', 'success');
        render();
        break;
      }
      case 'clear-filters': navigate('#/videos'); break;
      case 'grid-toggle': {
        global.GridWide = !global.GridWide;
        const grid = $('.grid.poster');
        if (grid) grid.classList.toggle('wide');
        break;
      }

      /* taxonomy */
      case 'new-category': openCategoryDialog(null); break;
      case 'edit-category': openCategoryDialog(Store.state.categories.find(function (c) { return c.id === id; })); break;
      case 'delete-category': {
        const c = Store.state.categories.find(function (x) { return x.id === id; });
        openDialog({
          title: 'Eliminar categoría',
          body: '<p>Se eliminará «' + UI.escapeHtml(c ? c.name : '') + '». Los videos quedarán sin categoría.</p>',
          actions: [
            { label: 'Cancelar', variant: 'text' },
            { label: 'Eliminar', variant: 'filled', onClick: function () { Store.dispatch(Store.actions.DELETE_CATEGORY(id)); toast('Categoría eliminada.', 'success'); render(); } }
          ]
        });
        break;
      }
      case 'new-tag': {
        openDialog({
          title: 'Nueva etiqueta',
          body: '<div class="field"><span class="field-label">Nombre</span><input class="input" id="newTag" placeholder="ej. viajes-2026" /></div>',
          actions: [
            { label: 'Cancelar', variant: 'text' },
            { label: 'Crear', variant: 'filled', onClick: function () {
              const v = $('#newTag').value.trim();
              if (!v) { toast('Escribe un nombre.', 'error'); return false; }
              Store.dispatch(Store.actions.CREATE_TAG(v));
              toast('Etiqueta creada.', 'success');
              render();
            } }
          ]
        });
        break;
      }
      case 'delete-tag': {
        Store.dispatch(Store.actions.DELETE_TAG(id));
        toast('Etiqueta eliminada.', 'success');
        render();
        break;
      }

      /* library */
      case 'register-folder': openRegisterFolder(); break;
      case 'remove-folder': {
        Store.dispatch(Store.actions.REMOVE_FOLDER(id));
        toast('Carpeta eliminada del registro.', 'success');
        render();
        break;
      }
      case 'scan-folder': {
        Store.dispatch(Store.actions.SCAN_LIBRARY(id));
        toast('Escaneo iniciado…', 'info');
        setTimeout(function () { render(); toast('Escaneo completado.', 'success'); }, 900);
        break;
      }
      case 'scan-all': {
        Store.state.folders.forEach(function (f) { Store.dispatch(Store.actions.SCAN_LIBRARY(f.id)); });
        toast('Escaneo de todas las carpetas iniciado…', 'info');
        setTimeout(function () { render(); toast('Escaneo completado.', 'success'); }, 1200);
        break;
      }
      case 'favorite-folder': {
        const s = Store.state;
        const i = s.favoriteFolders.indexOf(id);
        if (i >= 0) s.favoriteFolders.splice(i, 1); else s.favoriteFolders.push(id);
        Store.dispatch(Store.actions.SET({ favoriteFolders: s.favoriteFolders }));
        toast('Favoritos de carpeta actualizados.', 'success');
        render();
        break;
      }
      case 'unignore': {
        const s = Store.state;
        s.ignored = s.ignored.filter(function (f) { return f.id !== id; });
        Store.dispatch(Store.actions.SET({ ignored: s.ignored }));
        toast('Archivo restaurado.', 'success');
        render();
        break;
      }
      case 'resolve-dup': {
        Store.dispatch(Store.actions.RESOLVE_DUPLICATE(id));
        toast('Duplicado resuelto. Se conserva la copia más antigua.', 'success');
        render();
        break;
      }
      case 'bulk-import': openBulkImport(); break;

      /* gallery */
      case 'new-folder': openNewFolder(); break;
      case 'gal-rename': openBatchRename(); break;
      case 'gal-move': openMoveCopy('move'); break;
      case 'gal-copy': openMoveCopy('copy'); break;
      case 'gal-trash': {
        const ids = selectedGalleryIds();
        if (!ids.length) { toast('Selecciona archivos en la galería.', 'error'); return; }
        Store.dispatch(Store.actions.TRASH_FILES({ ids: ids }));
        toast(ids.length + ' archivo(s) enviados a la papelera.', 'success');
        render();
        break;
      }
      case 'trash-view': openTrash(); break;

      /* music */
      case 'add-track': openAddTrack(); break;
      case 'toggle-visualizer': {
        const v = !Store.state.visualizer;
        Store.dispatch(Store.actions.SET({ visualizer: v }));
        toast('Visualizador de audio ' + (v ? 'activado' : 'desactivado'), 'info');
        render();
        if (v) Player.startVisualizer ? Player.startVisualizer() : null;
        break;
      }
      case 'add-playlist': openCreatePlaylist(); break;

      /* users */
      case 'new-profile': openProfileDialog(null); break;
      case 'edit-profile': openProfileDialog(Store.state.profiles.find(function (p) { return p.id === id; })); break;
      case 'switch-profile': {
        Store.dispatch(Store.actions.SWITCH_PROFILE(id));
        const p = Store.state.profiles.find(function (x) { return x.id === id; });
        toast('Perfil activo: ' + p.name, 'success');
        render();
        break;
      }
      case 'delete-profile': {
        if (Store.state.profiles.length <= 1) { toast('Debe existir al menos un perfil.', 'error'); return; }
        Store.dispatch(Store.actions.DELETE_PROFILE(id));
        toast('Perfil eliminado.', 'success');
        render();
        break;
      }

      /* notifications */
      case 'read-notif': {
        Store.dispatch(Store.actions.READ_NOTIFICATION(id));
        render();
        break;
      }
      case 'read-all': {
        Store.state.notifications.forEach(function (n) { Store.dispatch(Store.actions.READ_NOTIFICATION(n.id)); });
        toast('Todas las notificaciones marcadas como leídas.', 'success');
        render();
        break;
      }
      case 'dismiss-notif': {
        Store.dispatch(Store.actions.DISMISS_NOTIFICATION(id));
        render();
        break;
      }

      /* admin */
      case 'backup': {
        Store.dispatch(Store.actions.LOG_ACTIVITY({ module: 'Admin', user: 'Frank', command: 'TriggerBackupCommand', detail: 'metadata-backup-' + Date.now() + '.zip' }));
        toast('Backup de metadatos generado correctamente.', 'success');
        render();
        break;
      }
      case 'clear-cache': {
        toast('Caché de transcodificación limpiada.', 'success');
        break;
      }
    }
  }

  /* ================= GALLERY HELPERS ================= */
  function selectedGalleryIds() {
    return Array.from(document.querySelectorAll('.gal-item.sel')).map(function (el) { return el.getAttribute('data-gal-id'); });
  }

  function wireGallery() {
    $$('.gal-item').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        if (e.target.closest('button')) return;
        el.classList.toggle('sel');
      });
    });
    const all = $('#galSelectAll');
    if (all) all.addEventListener('click', function () {
      const items = $$('.gal-item');
      const shouldSelect = items.some(function (i) { return !i.classList.contains('sel'); });
      items.forEach(function (i) { i.classList.toggle('sel', shouldSelect); });
    });
  }

  function wireVideoFilters() {
    /* nothing extra needed; filters via URL */
  }

  function wireSeasonTabs() { /* handled by delegation */ }

  /* ================= DIALOGS ================= */
  function openAddMenu() {
    /* options are delegated via data-opt so listeners survive HTML serialization */
    const items = [
      ['video', 'Video suelto', 'Agregar un video independiente a la biblioteca'],
      ['episode', 'Episodio de serie', 'Agregar un episodio a una serie existente'],
      ['serie', 'Serie nueva', 'Crear la ficha de una serie sin episodios'],
      ['track', 'Pista de música', 'Agregar una pista a tu biblioteca musical'],
      ['bulk', 'Carga masiva desde carpeta', 'Explorar una carpeta e importar varios videos']
    ];
    const body = document.createElement('div');
    body.innerHTML = '<div class="pp-list">' + items.map(function (it) {
      return '<div class="pp-opt" data-opt="' + it[0] + '">' +
        '<span class="pp-opt-tx"><b>' + UI.escapeHtml(it[1]) + '</b><span>' + UI.escapeHtml(it[2]) + '</span></span></div>';
    }).join('') + '</div>';

    UI.openDialog({
      title: 'Agregar contenido',
      body: body.innerHTML,
      onOpen: function (b) {
        UI.$$('[data-opt]', b).forEach(function (el) {
          el.addEventListener('click', function () {
            const kind = el.getAttribute('data-opt');
            UI.closeDialog();
            if (kind === 'video') openAddVideo();
            else if (kind === 'episode') openAddEpisode();
            else if (kind === 'serie') openCreateSeries();
            else if (kind === 'track') openAddTrack();
            else if (kind === 'bulk') openBulkImport();
          });
        });
      },
      actions: [{ label: 'Cerrar', variant: 'text' }]
    });
  }

  function openProfileMenu() {
    const s = Store.state;
    const body = document.createElement('div');
    body.innerHTML = '<div class="pp-list">' +
      s.profiles.map(function (p) {
        return '<div class="pp-opt ' + (p.id === s.currentProfileId ? 'sel' : '') + '" data-pid="' + p.id + '">' +
          '<span class="avatar" style="background:' + p.color + ';color:#fff;width:32px;height:32px;flex:0 0 32px;font-size:.8rem">' + UI.escapeHtml(p.avatar) + '</span>' +
          '<span class="pp-opt-tx"><b>' + UI.escapeHtml(p.name) + '</b><span>' + UI.escapeHtml(p.role) + '</span></span></div>';
      }).join('') + '</div>';
    UI.openDialog({
      title: 'Cambiar de perfil',
      body: body.innerHTML,
      onOpen: function (b) {
        b.innerHTML = body.innerHTML;
        UI.$$('[data-pid]', b).forEach(function (el) {
          el.addEventListener('click', function () {
            Store.dispatch(Store.actions.SWITCH_PROFILE(el.getAttribute('data-pid')));
            UI.closeDialog();
            render();
          });
        });
      },
      actions: [{ label: 'Cerrar', variant: 'text' }]
    });
  }

  /* --- add/edit video --- */
  function openAddVideo() {
    UI.openMediaForm({
      mode: 'video',
      onSave: function (model) {
        const id = 'v' + Date.now();
        model.id = id;
        model.kind = 'video';
        model.sizeBytes = 5 * 1073741824;
        Store.dispatch(Store.actions.CREATE_VIDEO(model));
        Store.dispatch(Store.actions.LOG_ACTIVITY({ module: 'Videos', user: Store.selectors.currentProfile(Store.state).name, command: 'CreateStandaloneVideoCommand', detail: id }));
        toast('Video agregado a la biblioteca.', 'success');
        navigate('#/video/' + id);
      }
    });
  }

  function openEditVideo(v) {
    UI.openMediaForm({
      mode: 'video', video: v,
      onSave: function (model) {
        Store.dispatch(Store.actions.UPDATE_VIDEO(model));
        toast('Cambios guardados.', 'success');
        render();
      }
    });
  }

  function openAddEpisode() {
    const series = Store.state.series;
    if (!series.length) { toast('Primero crea una serie.', 'error'); return; }
    const body = document.createElement('div');
    body.innerHTML = '<div class="field"><span class="field-label">Serie destino</span>' +
      '<select class="select" id="epSeries">' + series.map(function (s) { return '<option value="' + s.id + '">' + UI.escapeHtml(s.title) + '</option>'; }).join('') + '</select></div>';
    UI.openDialog({
      title: 'Agregar episodio',
      body: body.innerHTML,
      onOpen: function (b) { b.innerHTML = body.innerHTML; },
      actions: [
        { label: 'Cancelar', variant: 'text' },
        { label: 'Continuar', variant: 'filled', onClick: function () {
          const ser = Store.state.series.find(function (s) { return s.id === $('#epSeries').value; });
          const sn = ser.seasons[ser.seasons.length - 1];
          openMediaForm({
            mode: 'episode', seriesId: ser.id, seasonId: sn.id, seasonNumber: sn.number,
            onSave: function (model) {
              const ep = Object.assign({}, model);
              ep.number = sn.episodes.length + 1;
              Store.dispatch(Store.actions.ADD_EPISODE({ seriesId: ser.id, seasonId: sn.id, episode: ep }));
              Store.dispatch(Store.actions.LOG_ACTIVITY({ module: 'Series', user: Store.selectors.currentProfile(Store.state).name, command: 'AddEpisodeCommand', detail: ep.id }));
              toast('Episodio agregado a ' + ser.title + '.', 'success');
              navigate('#/series/' + ser.id);
            }
          });
        } }
      ]
    });
  }

  function openEditEpisode(ser, ep) {
    UI.openMediaForm({
      mode: 'episode', video: ep,
      onSave: function (model) {
        Store.dispatch(Store.actions.UPDATE_EPISODE({ seriesId: ser.id, episode: model }));
        toast('Episodio actualizado.', 'success');
        render();
      }
    });
  }

  /* --- series --- */
  function openCreateSeries() {
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="field"><span class="field-label">Título</span><input class="input" id="srTitle" placeholder="Nombre de la serie" /></div>' +
      '<div class="grid-2">' +
      '<div class="field"><span class="field-label">Año</span><input class="input" id="srYear" type="number" value="' + new Date().getFullYear() + '" /></div>' +
      '<div class="field"><span class="field-label">Género</span><input class="input" id="srGenre" placeholder="Drama" /></div></div>' +
      '<div class="field"><span class="field-label">Sinopsis</span><textarea class="textarea" id="srSyn"></textarea></div>' +
      '<div class="field"><span class="field-label">Categoría</span><div id="srCat"></div></div>' +
      '<div class="field"><span class="field-label">Etiquetas</span><div id="srTags"></div></div>';
    let bodyRef = null;
    UI.openDialog({
      title: 'Nueva serie',
      wide: true,
      body: body.innerHTML,
      onOpen: function (b) {
        bodyRef = b;
        b.innerHTML = body.innerHTML;
        let cat = null;
        let tags = [];
        const cc = UI.comboBox({ values: Store.state.categories.map(function (c) { return c.name; }), placeholder: 'Buscar categoría…', onChange: function (v) { cat = v; } });
        $('#srCat', b).appendChild(cc);
        const tc = UI.comboBox({ values: Store.state.tags, value: [], multiple: true, placeholder: 'Buscar o crear etiqueta…', onChange: function (v) { tags = v; } });
        $('#srTags', b).appendChild(tc);
        b._getCat = function () { return cat; };
        b._getTags = function () { return tags; };
      },
      actions: [
        { label: 'Cancelar', variant: 'text' },
        { label: 'Crear serie', variant: 'filled', onClick: function () {
          const title = $('#srTitle').value.trim();
          if (!title) { toast('El título es obligatorio.', 'error'); return false; }
          const id = 's' + Date.now();
          const catName = bodyRef && bodyRef._getCat ? bodyRef._getCat() : null;
          const cat = Store.state.categories.find(function (c) { return c.name === catName; });
          const tags = bodyRef && bodyRef._getTags ? bodyRef._getTags() : [];
          const ser = {
            id: id, title: title, synopsis: $('#srSyn').value.trim(),
            year: parseInt($('#srYear').value, 10) || new Date().getFullYear(),
            genre: $('#srGenre').value.trim(),
            categoryId: cat ? cat.id : null, tags: tags,
            poster: Data.art(title), thumbnail: Data.artWide(title),
            rating: 0, favorite: false, hidden: false, autoplayNext: true,
            createdAt: new Date().toISOString(), seasons: []
          };
          Store.dispatch(Store.actions.CREATE_SERIES(ser));
          Store.dispatch(Store.actions.LOG_ACTIVITY({ module: 'Series', user: Store.selectors.currentProfile(Store.state).name, command: 'CreateSeriesCommand', detail: id }));
          toast('Serie creada. Ya puedes agregar episodios.', 'success');
          navigate('#/series/' + id);
        } }
      ]
    });
  }

  function openEditSeries(ser) {
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="field"><span class="field-label">Título</span><input class="input" id="srTitle" value="' + UI.escapeHtml(ser.title) + '" /></div>' +
      '<div class="grid-2">' +
      '<div class="field"><span class="field-label">Año</span><input class="input" id="srYear" type="number" value="' + (ser.year || '') + '" /></div>' +
      '<div class="field"><span class="field-label">Género</span><input class="input" id="srGenre" value="' + UI.escapeHtml(ser.genre || '') + '" /></div></div>' +
      '<div class="field"><span class="field-label">Sinopsis</span><textarea class="textarea" id="srSyn">' + UI.escapeHtml(ser.synopsis || '') + '</textarea></div>';
    UI.openDialog({
      title: 'Editar serie',
      body: body.innerHTML,
      actions: [
        { label: 'Cancelar', variant: 'text' },
        { label: 'Guardar', variant: 'filled', onClick: function () {
          const title = $('#srTitle').value.trim();
          if (!title) { toast('El título es obligatorio.', 'error'); return false; }
          ser.title = title;
          ser.year = parseInt($('#srYear').value, 10) || ser.year;
          ser.genre = $('#srGenre').value.trim();
          ser.synopsis = $('#srSyn').value.trim();
          ser.poster = Data.art(title);
          ser.thumbnail = Data.artWide(title);
          Store.dispatch(Store.actions.UPDATE_SERIES(ser));
          toast('Serie actualizada.', 'success');
          render();
        } }
      ]
    });
  }

  /* --- rate --- */
  function openRateDialog(item) {
    const body = document.createElement('div');
    body.innerHTML = '<div class="hint" style="margin-bottom:12px">Califica con 1 a 5 estrellas.</div><div id="rateStars" style="display:flex;gap:8px"></div>';
    UI.openDialog({
      title: 'Calificar: ' + item.title,
      body: body.innerHTML,
      onOpen: function (b) {
        b.innerHTML = body.innerHTML;
        const host = $('#rateStars', b);
        for (let i = 1; i <= 5; i++) {
          const btn = document.createElement('button');
          btn.className = 'icon-btn';
          btn.style.width = '48px';
          btn.style.height = '48px';
          btn.innerHTML = Icons.svg('star', 30);
          btn.addEventListener('click', function () {
            if (item.kind === 'episode') {
              /* episodes inherit rating through the parent series record */
              Store.dispatch(Store.actions.SET({ series: Store.state.series }));
            } else {
              Store.dispatch(Store.actions.RATE_VIDEO({ id: item.id, rating: i }));
            }
            UI.closeDialog();
            toast('Calificación guardada: ' + i + ' estrellas', 'success');
            render();
          });
          host.appendChild(btn);
        }
      },
      actions: [{ label: 'Cancelar', variant: 'text' }]
    });
  }

  /* --- category dialog --- */
  function openCategoryDialog(cat) {
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="field"><span class="field-label">Nombre</span><input class="input" id="catName" value="' + UI.escapeHtml(cat ? cat.name : '') + '" /></div>' +
      '<div class="field"><span class="field-label">Color</span><input type="color" id="catColor" value="' + (cat ? cat.color : '#4f5bd5') + '" style="width:64px;height:40px;border:0;background:none" /></div>';
    UI.openDialog({
      title: cat ? 'Editar categoría' : 'Nueva categoría',
      body: body.innerHTML,
      actions: [
        { label: 'Cancelar', variant: 'text' },
        { label: cat ? 'Guardar' : 'Crear', variant: 'filled', onClick: function () {
          const name = $('#catName').value.trim();
          if (!name) { toast('El nombre es obligatorio.', 'error'); return false; }
          const color = $('#catColor').value;
          if (cat) {
            Store.dispatch(Store.actions.UPDATE_CATEGORY({ id: cat.id, name: name, color: color }));
          } else {
            Store.dispatch(Store.actions.CREATE_CATEGORY({ name: name, color: color }));
          }
          toast(cat ? 'Categoría actualizada.' : 'Categoría creada.', 'success');
          render();
        } }
      ]
    });
  }

  /* --- register folder --- */
  function openRegisterFolder() {
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="field"><span class="field-label">Nombre de la carpeta</span><input class="input" id="lfName" placeholder="Películas" /></div>' +
      '<div class="field"><span class="field-label">Ruta en disco</span>' +
      '<div style="display:flex;gap:8px"><input class="input" id="lfPath" readonly placeholder="Selecciona una carpeta" style="flex:1" />' +
      '<button class="btn btn-outlined" id="lfBrowse">' + Icons.svg('folder', 18) + 'Explorar</button></div>' +
      '<span class="hint">Registrar una carpeta no copia ningún archivo: solo se escanea en su ubicación original.</span></div>' +
      '<div class="field"><span class="field-label">Ámbito</span><select class="select" id="lfScope"><option>Cine</option><option>Series</option><option>Musica</option><option>Personal</option></select></div>';
    UI.openDialog({
      title: 'Registrar carpeta de biblioteca',
      wide: true,
      body: body.innerHTML,
      onOpen: function (b) {
        b.innerHTML = body.innerHTML;
        $('#lfBrowse', b).addEventListener('click', function () {
          UI.openFileExplorer({
            kind: 'folder', title: 'Seleccionar carpeta',
            onPick: function (files) {
              $('#lfPath', b).value = files[0].path;
              if (!$('#lfName', b).value) $('#lfName', b).value = files[0].name;
            }
          });
        });
      },
      actions: [
        { label: 'Cancelar', variant: 'text' },
        { label: 'Registrar', variant: 'filled', onClick: function () {
          const name = $('#lfName').value.trim();
          const path = $('#lfPath').value;
          if (!name || !path) { toast('Nombre y ruta son obligatorios.', 'error'); return false; }
          Store.dispatch(Store.actions.REGISTER_FOLDER({
            id: 'lf' + Date.now(), name: name, path: path, scope: $('#lfScope').value,
            autoScan: true, lastScan: null, files: 0, sizeBytes: 0
          }));
          Store.dispatch(Store.actions.LOG_ACTIVITY({ module: 'Biblioteca', user: Store.selectors.currentProfile(Store.state).name, command: 'RegisterLibraryFolderCommand', detail: path }));
          toast('Carpeta registrada.', 'success');
          render();
        } }
      ]
    });
  }

  /* --- bulk import --- */
  function openBulkImport() {
    const state = { folder: null, candidates: [], selected: new Set(), mode: 'list' };
    const bulkState = state;

    function candidatesFor(path) {
      const out = [];
      const base = path.split(/[\\/]/).pop();
      for (let i = 0; i < 8; i++) {
        const name = ['Episodio S01E0' + (i + 1), 'Documental ' + (i + 1), 'Receta ' + (i + 1), 'Concierto ' + (i + 1)][i % 4] + ' (' + (i + 1) + ').mkv';
        out.push({
          id: 'cand' + i,
          name: name,
          path: path + '\\' + name,
          duration: 900 + i * 420,
          quality: ['1080p', '2160p', '720p', '1080p'][i % 4],
          thumb: Data.artWide(name),
          poster: Data.art(name)
        });
      }
      return out;
    }

    function renderList(body) {
      body.innerHTML =
        '<div class="field"><span class="field-label">Carpeta a explorar</span>' +
        '<div style="display:flex;gap:8px"><input class="input" id="biPath" readonly value="' + UI.escapeHtml(state.folder || '') + '" style="flex:1" />' +
        '<button class="btn btn-outlined" id="biBrowse">' + Icons.svg('folder', 18) + 'Explorar</button></div></div>' +
        '<label class="switch-row" style="cursor:pointer"><input type="checkbox" id="biSub" checked /><span class="sw-text"><span class="sw-title">Incluir subcarpetas</span></span></label>' +
        (state.candidates.length ?
          '<div class="tabs-inline" style="margin:12px 0"><button class="' + (state.mode === 'list' ? 'active' : '') + '" data-mode="list">Selección múltiple</button>' +
          '<button class="' + (state.mode === 'review' ? 'active' : '') + '" data-mode="review">Revisión rápida</button></div>' +
          (state.mode === 'list' ?
            '<div class="grid poster" id="biGrid">' + state.candidates.map(function (c) {
              const sel = state.selected.has(c.id);
              return '<div class="gal-item ' + (sel ? 'sel' : '') + '" data-cid="' + c.id + '">' +
                '<div class="gal-thumb" style="background-image:url(' + c.thumb + ')"><span class="gal-check">' + Icons.svg('check', 14) + '</span></div>' +
                '<div class="ex-name">' + UI.escapeHtml(c.name) + '</div>' +
                '<div class="ex-name sub">' + UI.formatDuration(c.duration) + ' · ' + c.quality + '</div></div>';
            }).join('') + '</div>'
            : '<div id="biReview"></div>') +
          '<div class="hint" style="margin-top:12px">' + state.selected.size + ' de ' + state.candidates.length + ' seleccionados</div>'
          : '<div class="hint">Elige una carpeta para listar los archivos de video encontrados.</div>');
    }

    UI.openDialog({
      title: 'Carga masiva desde carpeta',
      wide: true,
      body: '<div id="biBody"></div>',
      onOpen: function (b) {
        b.innerHTML = '<div id="biBody"></div>';
        const host = $('#biBody', b);
        renderList(host);
        $('#biBrowse', b).addEventListener('click', function () {
          UI.openFileExplorer({
            kind: 'folder', title: 'Explorar carpeta',
            onPick: function (files) {
              state.folder = files[0].path;
              state.candidates = candidatesFor(state.folder);
              state.selected = new Set();
              renderList(host);
            }
          });
        });
        UI.$$('[data-cid]', host).forEach(function (el) {
          el.addEventListener('click', function () {
            const id = el.getAttribute('data-cid');
            if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
            renderList(host);
          });
        });
        UI.$$('[data-mode]', host).forEach(function (btn) {
          btn.addEventListener('click', function () { state.mode = btn.getAttribute('data-mode'); renderList(host); });
        });
        b._state = state;
        b._render = function () { renderList(host); };
      },
      actions: [
        { label: 'Cancelar', variant: 'text' },
        { label: 'Importar seleccionados', variant: 'filled', onClick: function () {
          const st = bulkState;
          if (!st || !st.selected.size) { toast('Selecciona al menos un video.', 'error'); return false; }
          let n = 0;
          st.candidates.forEach(function (c) {
            if (!st.selected.has(c.id)) return;
            const id = 'v' + Date.now() + n;
            const model = {
              id: id, title: c.name.replace(/\.mkv$/, ''), synopsis: '', categoryId: null, tags: [],
              genre: '', year: new Date().getFullYear(), duration: c.duration, quality: c.quality,
              resolution: c.quality, videoCodec: 'H.264', audioCodec: 'AAC',
              sizeBytes: 3 * 1073741824, path: c.path, source: Data.SAMPLE[n % Data.SAMPLE.length],
              thumbnail: c.thumb, poster: c.poster, addedAt: new Date().toISOString(),
              watched: false, progress: 0, rating: 0, favorite: false, hidden: false,
              audioTracks: [{ id: 'at' + n, language: 'Español', codec: 'AAC 2.0', channels: 2, isDefault: true }],
              subtitleTracks: [], chapters: [], introStart: 0, introEnd: 0, creditsStart: 0, creditsEnd: 0
            };
            Store.dispatch(Store.actions.CREATE_VIDEO(model));
            n++;
          });
          Store.dispatch(Store.actions.LOG_ACTIVITY({ module: 'Biblioteca', user: Store.selectors.currentProfile(Store.state).name, command: 'BulkImportFromFolderCommand', detail: n + ' archivos desde ' + st.folder }));
          toast(n + ' video(s) importados con metadatos y miniaturas.', 'success');
          navigate('#/videos');
        } }
      ]
    });
  }

  /* --- gallery file ops --- */
  function openBatchRename() {
    const ids = selectedGalleryIds();
    if (!ids.length) { toast('Selecciona archivos en la galería.', 'error'); return; }
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="field"><span class="field-label">Plantilla de nombre</span>' +
      '<input class="input" id="rnTemplate" value="{title} - {n}" />' +
      '<span class="hint">Variables: {title} (título actual), {n} (número con cero a la izquierda).</span></div>' +
      '<div class="hint" id="rnPreview"></div>';
    UI.openDialog({
      title: 'Renombrar ' + ids.length + ' archivo(s) en lote',
      body: body.innerHTML,
      onOpen: function (b) {
        b.innerHTML = body.innerHTML;
        const upd = function () {
          const tpl = $('#rnTemplate', b).value;
          const sample = Store.state.videos.find(function (v) { return v.id === ids[0]; });
          $('#rnPreview', b).textContent = 'Ejemplo: ' + tpl.replace('{title}', sample ? sample.title : 'Titulo').replace('{n}', '01');
        };
        $('#rnTemplate', b).addEventListener('input', upd);
        upd();
      },
      actions: [
        { label: 'Cancelar', variant: 'text' },
        { label: 'Renombrar', variant: 'filled', onClick: function () {
          const tpl = $('#rnTemplate').value;
          ids.forEach(function (id, i) {
            Store.dispatch(Store.actions.BATCH_RENAME({ id: id, template: tpl, index: i + 1 }));
          });
          toast(ids.length + ' archivo(s) renombrados.', 'success');
          render();
        } }
      ]
    });
  }

  function openMoveCopy(mode) {
    const ids = selectedGalleryIds();
    if (!ids.length) { toast('Selecciona archivos en la galería.', 'error'); return; }
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="field"><span class="field-label">Carpeta de destino</span>' +
      '<div style="display:flex;gap:8px"><input class="input" id="mvPath" readonly value="D:\\Media\\Ordenado" style="flex:1" />' +
      '<button class="btn btn-outlined" id="mvBrowse">' + Icons.svg('folder', 18) + 'Explorar</button></div></div>' +
      '<div class="hint">Al mover archivos se actualiza automáticamente la ruta guardada en el registro de la biblioteca.</div>';
    UI.openDialog({
      title: mode === 'move' ? 'Mover archivos' : 'Copiar archivos',
      body: body.innerHTML,
      onOpen: function (b) {
        b.innerHTML = body.innerHTML;
        $('#mvBrowse', b).addEventListener('click', function () {
          UI.openFileExplorer({
            kind: 'folder', title: 'Carpeta de destino',
            onPick: function (files) { $('#mvPath', b).value = files[0].path; }
          });
        });
      },
      actions: [
        { label: 'Cancelar', variant: 'text' },
        { label: mode === 'move' ? 'Mover' : 'Copiar', variant: 'filled', onClick: function () {
          const dest = $('#mvPath').value;
          Store.dispatch(mode === 'move' ? Store.actions.MOVE_FILES({ ids: ids, dest: dest }) : Store.actions.COPY_FILES({ ids: ids, dest: dest }));
          Store.dispatch(Store.actions.LOG_ACTIVITY({ module: 'Galeria', user: Store.selectors.currentProfile(Store.state).name, command: mode === 'move' ? 'MoveFilesCommand' : 'CopyFilesCommand', detail: ids.length + ' archivos → ' + dest }));
          toast(ids.length + ' archivo(s) ' + (mode === 'move' ? 'movidos' : 'copiados') + '.', 'success');
          render();
        } }
      ]
    });
  }

  function openNewFolder() {
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="field"><span class="field-label">Nombre de la carpeta</span><input class="input" id="nfName" placeholder="Ordenado 2026" /></div>' +
      '<div class="field"><span class="field-label">Ubicación</span><input class="input" id="nfPath" value="D:\\Media" /></div>';
    UI.openDialog({
      title: 'Crear carpeta',
      body: body.innerHTML,
      actions: [
        { label: 'Cancelar', variant: 'text' },
        { label: 'Crear', variant: 'filled', onClick: function () {
          const name = $('#nfName').value.trim();
          if (!name) { toast('Escribe un nombre.', 'error'); return false; }
          const base = $('#nfPath').value.replace(/[\\/]+$/, '');
          Store.dispatch(Store.actions.CREATE_FOLDER({ name: name, path: base + '\\' + name, scope: 'Personal' }));
          toast('Carpeta creada.', 'success');
          render();
        } }
      ]
    });
  }

  function openTrash() {
    const s = Store.state;
    const body = document.createElement('div');
    body.innerHTML = s.trash.length ? '<div class="track-list">' + s.trash.map(function (t) {
      return '<div class="track-row" style="grid-template-columns:32px 1fr auto auto"><div class="track-idx">' + Icons.svg('trash', 18) + '</div>' +
        '<div><div class="track-name">' + UI.escapeHtml(t.name) + '</div><div class="track-artist">' + UI.escapeHtml(t.path) + '</div></div>' +
        '<div></div><div style="display:flex;gap:4px">' +
        '<button class="btn btn-text" data-restore="' + t.id + '">Restaurar</button>' +
        '<button class="btn btn-text" data-perma="' + t.id + '">Eliminar definitivo</button></div></div>';
    }).join('') + '</div>' : '<div class="hint">La papelera está vacía.</div>';
    UI.openDialog({
      title: 'Papelera',
      body: body.innerHTML,
      onOpen: function (b) {
        b.innerHTML = body.innerHTML;
        UI.$$('[data-restore]', b).forEach(function (btn) {
          btn.addEventListener('click', function () {
            Store.dispatch(Store.actions.RESTORE_FILE(btn.getAttribute('data-restore')));
            UI.closeDialog();
            toast('Archivo restaurado.', 'success');
            render();
          });
        });
        UI.$$('[data-perma]', b).forEach(function (btn) {
          btn.addEventListener('click', function () {
            Store.dispatch(Store.actions.DELETE_PERMANENT(btn.getAttribute('data-perma')));
            UI.closeDialog();
            toast('Archivo eliminado definitivamente.', 'success');
            render();
          });
        });
      },
      actions: [{ label: 'Cerrar', variant: 'text' }]
    });
  }

  /* --- music --- */
  function openAddTrack() {
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="field"><span class="field-label">Archivo de audio</span>' +
      '<div style="display:flex;gap:8px"><input class="input" id="trPath" readonly placeholder="Sin archivo" style="flex:1" />' +
      '<button class="btn btn-outlined" id="trBrowse">' + Icons.svg('folder', 18) + 'Explorar</button></div></div>' +
      '<div class="grid-2">' +
      '<div class="field"><span class="field-label">Título</span><input class="input" id="trTitle" /></div>' +
      '<div class="field"><span class="field-label">Álbum</span><input class="input" id="trAlbum" /></div></div>' +
      '<div class="grid-2">' +
      '<div class="field"><span class="field-label">Artista</span><input class="input" id="trArtist" /></div>' +
      '<div class="field"><span class="field-label">Género</span><input class="input" id="trGenre" /></div></div>';
    UI.openDialog({
      title: 'Agregar pista',
      wide: true,
      body: body.innerHTML,
      onOpen: function (b) {
        b.innerHTML = body.innerHTML;
        $('#trBrowse', b).addEventListener('click', function () {
          UI.openFileExplorer({
            kind: 'audio', title: 'Seleccionar pista',
            onPick: function (files) {
              $('#trPath', b).value = files[0].path;
              const base = files[0].name.replace(/\.[A-Za-z0-9]+$/, '');
              if (!$('#trTitle', b).value) $('#trTitle', b).value = base;
              toast('Metadatos extraídos del archivo de audio.', 'success');
            }
          });
        });
      },
      actions: [
        { label: 'Cancelar', variant: 'text' },
        { label: 'Agregar', variant: 'filled', onClick: function () {
          const path = $('#trPath').value;
          const title = $('#trTitle').value.trim();
          if (!path || !title) { toast('Archivo y título son obligatorios.', 'error'); return false; }
          const artistName = $('#trArtist').value.trim() || 'Desconocido';
          const albumTitle = $('#trAlbum').value.trim() || 'Single';
          const album = Store.state.albums.find(function (a) { return a.title === albumTitle && a.artistName === artistName; });
          const track = {
            id: 'tr' + Date.now(), title: title, albumId: album ? album.id : null, albumTitle: albumTitle,
            artistId: null, artistName: artistName, trackNo: 1, duration: 240, genre: $('#trGenre').value.trim(),
            year: new Date().getFullYear(), source: (Data.SAMPLE[Math.floor(Math.random() * Data.SAMPLE.length)]), cover: Data.art(albumTitle),
            path: path, played: 0, plays: 0, rating: 0, addedAt: new Date().toISOString(), lyrics: null, replayGain: '-3.0 dB'
          };
          Store.dispatch(Store.actions.ADD_TRACK(track));
          Store.dispatch(Store.actions.LOG_ACTIVITY({ module: 'Musica', user: Store.selectors.currentProfile(Store.state).name, command: 'AddTrackCommand', detail: track.id }));
          toast('Pista agregada.', 'success');
          navigate('#/musica');
        } }
      ]
    });
  }

  function openCreatePlaylist() {
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="field"><span class="field-label">Nombre</span><input class="input" id="plName" placeholder="Mi playlist" /></div>' +
      '<div class="field"><span class="field-label">Descripción</span><input class="input" id="plDesc" placeholder="Opcional" /></div>' +
      '<div class="field"><span class="field-label">Tipo</span><select class="select" id="plType"><option value="manual">Manual</option><option value="recent">Inteligente: añadidos en los últimos 30 días</option><option value="unplayed">Inteligente: no escuchadas en 6 meses</option></select></div>';
    UI.openDialog({
      title: 'Nueva playlist',
      body: body.innerHTML,
      actions: [
        { label: 'Cancelar', variant: 'text' },
        { label: 'Crear', variant: 'filled', onClick: function () {
          const name = $('#plName').value.trim();
          if (!name) { toast('Escribe un nombre.', 'error'); return false; }
          const type = $('#plType').value;
          const pl = {
            id: 'pl' + Date.now(), name: name, description: $('#plDesc').value.trim(), trackIds: [],
            rules: type === 'recent' ? { type: 'recentlyAdded', days: 30 } : type === 'unplayed' ? { type: 'notPlayed', days: 180 } : null,
            cover: Data.art(name)
          };
          Store.dispatch(Store.actions.CREATE_PLAYLIST(pl));
          toast('Playlist creada.', 'success');
          navigate('#/musica');
        } }
      ]
    });
  }

  function showArtist(id) {
    const a = Store.state.artists.find(function (x) { return x.id === id; });
    if (!a) return;
    const albums = Store.state.albums.filter(function (al) { return al.artistId === id; });
    const tracks = Store.state.tracks.filter(function (t) { return t.artistId === id; });
    const body = document.createElement('div');
    body.innerHTML =
      '<div style="display:flex;gap:18px;align-items:center;margin-bottom:16px">' +
      '<div class="artist-round" style="width:110px;height:110px;background-image:url(' + a.image + ')"></div>' +
      '<div><div class="detail-title" style="font-size:1.6rem">' + UI.escapeHtml(a.name) + '</div>' +
      '<div class="detail-sub">' + UI.escapeHtml(a.genre) + ' · desde ' + a.year + '</div>' +
      '<p class="hint">' + UI.escapeHtml(a.bio) + '</p></div></div>' +
      '<h3 class="section-title" style="margin-bottom:8px">Álbumes</h3>' +
      '<div class="grid poster" style="margin-bottom:16px">' + albums.map(function (al) {
        return '<div class="card"><div class="card-poster"><div class="ph" style="background-image:url(' + al.cover + ')">' + UI.escapeHtml(al.title) + '</div></div>' +
          '<div class="card-body"><div class="card-title">' + UI.escapeHtml(al.title) + '</div></div></div>';
      }).join('') + '</div>' +
      '<h3 class="section-title" style="margin-bottom:8px">Pistas</h3>' +
      '<div class="track-list">' + tracks.map(trackRowLocal).join('') + '</div>';
    UI.openDialog({
      title: a.name, wide: true, body: body.innerHTML,
      onOpen: function (b) { b.innerHTML = body.innerHTML; Icons.paint(b); },
      actions: [{ label: 'Cerrar', variant: 'text' }]
    });
  }

  function trackRowLocal(t) {
    return '<div class="track-row" data-track="' + t.id + '"><div class="track-idx">' + (t.trackNo || '') + '</div>' +
      '<div><div class="track-name">' + UI.escapeHtml(t.title) + '</div><div class="track-artist">' + UI.escapeHtml(t.albumTitle) + '</div></div>' +
      '<div class="track-artist">' + UI.formatDuration(t.duration) + '</div>' +
      '<button class="icon-btn sm" data-act="play-track" data-id="' + t.id + '">' + Icons.svg('play', 18) + '</button></div>';
  }

  function showAlbum(id) {
    const al = Store.state.albums.find(function (x) { return x.id === id; });
    if (!al) return;
    const tracks = al.trackIds.map(function (tid) { return Store.state.tracks.find(function (t) { return t.id === tid; }); }).filter(Boolean);
    const body = document.createElement('div');
    body.innerHTML =
      '<div style="display:flex;gap:18px;align-items:center;margin-bottom:16px">' +
      '<div style="width:110px;aspect-ratio:1;border-radius:12px;background-image:url(' + al.cover + ');background-size:cover"></div>' +
      '<div><div class="detail-title" style="font-size:1.6rem">' + UI.escapeHtml(al.title) + '</div>' +
      '<div class="detail-sub">' + UI.escapeHtml(al.artistName) + ' · ' + al.year + ' · ' + tracks.length + ' pistas</div></div></div>' +
      '<div class="track-list">' + tracks.map(trackRowLocal).join('') + '</div>';
    UI.openDialog({
      title: al.title, wide: true, body: body.innerHTML,
      onOpen: function (b) { b.innerHTML = body.innerHTML; Icons.paint(b); },
      actions: [
        { label: 'Cerrar', variant: 'text' },
        { label: 'Reproducir álbum', variant: 'filled', onClick: function () { Player.playTracks(tracks, 0); } }
      ]
    });
  }

  function showPlaylist(id) {
    const pl = Store.state.playlists.find(function (x) { return x.id === id; });
    if (!pl) return;
    let ids = pl.trackIds;
    if (!ids.length && pl.rules) {
      if (pl.rules.type === 'notPlayed') ids = Store.state.tracks.filter(function (t) { return (t.plays || 0) === 0; }).map(function (t) { return t.id; });
      if (pl.rules.type === 'recentlyAdded') {
        const cut = Date.now() - pl.rules.days * 86400000;
        ids = Store.state.tracks.filter(function (t) { return new Date(t.addedAt).getTime() >= cut; }).map(function (t) { return t.id; });
      }
    }
    const tracks = ids.map(function (tid) { return Store.state.tracks.find(function (t) { return t.id === tid; }); }).filter(Boolean);
    const body = document.createElement('div');
    body.innerHTML = (pl.rules ? '<div class="hint" style="margin-bottom:12px">Playlist inteligente: ' + UI.escapeHtml(pl.description) + '</div>' : '') +
      '<div class="track-list">' + (tracks.length ? tracks.map(trackRowLocal).join('') : '<div class="hint">Sin pistas que coincidan todavía.</div>') + '</div>';
    UI.openDialog({
      title: pl.name, wide: true, body: body.innerHTML,
      onOpen: function (b) { b.innerHTML = body.innerHTML; Icons.paint(b); },
      actions: [
        { label: 'Cerrar', variant: 'text' },
        { label: 'Reproducir', variant: 'filled', onClick: function () { if (tracks.length) Player.playTracks(tracks, 0); } }
      ]
    });
  }

  /* --- profile dialog --- */
  function openProfileDialog(p) {
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="field"><span class="field-label">Nombre</span><input class="input" id="pfName" value="' + UI.escapeHtml(p ? p.name : '') + '" /></div>' +
      '<div class="field"><span class="field-label">Rol</span><select class="select" id="pfRole"><option value="admin">Administrador</option><option value="user">Usuario</option><option value="child">Infantil</option></select></div>' +
      '<div class="field"><span class="field-label">PIN de acceso</span><input class="input" id="pfPin" maxlength="4" value="' + UI.escapeHtml(p ? p.pin : '') + '" placeholder="4 dígitos" /></div>' +
      '<div id="pfParent"></div>';
    UI.openDialog({
      title: p ? 'Editar perfil' : 'Nuevo perfil',
      body: body.innerHTML,
      onOpen: function (b) {
        b.innerHTML = body.innerHTML;
        $('#pfRole', b).value = p ? p.role : 'user';
        const host = $('#pfParent', b);
        host.appendChild(UI.switchRow('Control parental', 'Restringe contenido por clasificación', p ? p.parental.enabled : false, function (v) {
          b._parental = v;
          const sel = document.createElement('select');
          sel.className = 'select';
          sel.id = 'pfRating';
          ['G', 'PG', 'PG-13', 'R'].forEach(function (r) {
            const o = document.createElement('option');
            o.value = r; o.textContent = r;
            if (p && p.parental.maxRating === r) o.selected = true;
            sel.appendChild(o);
          });
          host.appendChild(sel);
        }));
      },
      actions: [
        { label: 'Cancelar', variant: 'text' },
        { label: p ? 'Guardar' : 'Crear', variant: 'filled', onClick: function () {
          const name = $('#pfName').value.trim();
          if (!name) { toast('El nombre es obligatorio.', 'error'); return false; }
          const payload = {
            name: name, role: $('#pfRole').value, pin: $('#pfPin').value || '0000',
            parental: { enabled: p ? p.parental.enabled : false, maxRating: p ? p.parental.maxRating : 'PG-13' }
          };
          const rating = $('#pfRating');
          if (rating) payload.parental.maxRating = rating.value;
          if (p) {
            Object.assign(p, payload);
            Store.dispatch(Store.actions.UPDATE_PROFILE(p));
          } else {
            Store.dispatch(Store.actions.CREATE_PROFILE(Object.assign({
              id: 'u' + Date.now(), avatar: name[0].toUpperCase(), color: '#4f5bd5',
              preferences: { hoverPreview: true, autoplayNext: true, imageAdjustments: null, lang: 'es', writeTagsToFile: false, keyboardShortcuts: true },
              libraryAccess: ['lf1', 'lf2', 'lf3']
            }, payload)));
          }
          toast(p ? 'Perfil actualizado.' : 'Perfil creado.', 'success');
          render();
        } }
      ]
    });
  }

  /* ================= THEME ================= */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', Store.state.theme);
    const prof = Store.selectors.currentProfile(Store.state);
    if (prof && prof.preferences && prof.preferences.lang) {
      document.documentElement.setAttribute('lang', prof.preferences.lang);
    }
  }

  /* ================= BOOT ================= */
  function boot() {
    Icons.paint(document);
    applyTheme();
    /* el drawer arranca siempre cerrado en pantallas estrechas */
    if (Store.state.menuOpen) Store.dispatch(Store.actions.SET({ menuOpen: false }));
    Player.initVideo();
    Player.initSkipButtons();
    Player.initMusic();
    wireGlobalEvents();
    refreshChrome();
    applyMenuState();
    window.addEventListener('hashchange', function () { render(); wireHoverPreviews(); });
    render();
    wireHoverPreviews();
    applyTheme();
    /* welcome hint */
    setTimeout(function () {
      toast('MediaHub listo. Pulsa "/" para buscar y "Agregar" para dar de alta contenido.', 'success');
    }, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.App = { render: render, navigate: navigate };
})(window);
