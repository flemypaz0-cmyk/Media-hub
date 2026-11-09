/* =====================================================================
   MediaHub — UI toolkit
   Dialogs, toasts, combo boxes, switches, the reusable file explorer
   and the add/edit media form (shared by videos, episodes and tracks).
   ===================================================================== */
(function (global) {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------------- toast ---------------- */
  function toast(message, kind) {
    const host = $('#toastHost');
    const el = document.createElement('div');
    el.className = 'toast';
    const icon = kind === 'error' ? 'warning' : kind === 'success' ? 'check' : 'info';
    el.innerHTML = Icons.svg(icon, 18) + '<span></span>';
    el.querySelector('span').textContent = message;
    host.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      setTimeout(function () { el.remove(); }, 260);
    }, 2800);
  }

  /* ---------------- dialog ---------------- */
  /* Dialogs are stacked so a nested dialog (e.g. the file explorer opened
     from the media form) never destroys the dialog underneath it. */
  const dialogStack = [];

  function openDialog(opts) {
    const scrim = document.createElement('div');
    scrim.className = 'dialog-scrim';

    const dlg = document.createElement('div');
    dlg.className = 'dialog' + (opts.wide ? ' wide' : '');
    dlg.setAttribute('role', 'dialog');
    dlg.setAttribute('aria-modal', 'true');

    const head = document.createElement('div');
    head.className = 'dlg-head';
    const title = document.createElement('h2');
    title.textContent = opts.title || '';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'icon-btn';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.innerHTML = Icons.svg('close', 24);
    closeBtn.addEventListener('click', function () { closeDialog(); });
    head.appendChild(title);
    head.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'dlg-body';
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    const foot = document.createElement('div');
    foot.className = 'dlg-foot';
    (opts.actions || []).forEach(function (a) {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.variant ? 'btn-' + a.variant : 'btn-text');
      b.textContent = a.label;
      b.addEventListener('click', function () {
        if (a.onClick) {
          const r = a.onClick(body);
          if (r === false) return;
        }
        if (a.keepOpen !== true) closeDialog();
      });
      foot.appendChild(b);
    });

    dlg.appendChild(head);
    dlg.appendChild(body);
    if (foot.childNodes.length) dlg.appendChild(foot);
    scrim.appendChild(dlg);
    document.body.appendChild(scrim);

    scrim.addEventListener('click', function (e) {
      if (e.target === scrim) closeDialog();
    });

    const entry = { scrim: scrim, dlg: dlg, onClose: opts.onClose || null };
    dialogStack.push(entry);

    Icons.paint(dlg);
    if (opts.onOpen) opts.onOpen(body);
    const focusable = body.querySelector('input,select,textarea,button');
    if (focusable) setTimeout(function () { focusable.focus(); }, 60);
    return body;
  }

  function closeDialog() {
    const entry = dialogStack.pop();
    if (!entry) return;
    if (entry.scrim.parentNode) entry.scrim.parentNode.removeChild(entry.scrim);
    if (entry.onClose) entry.onClose();
  }

  function closeAllDialogs() {
    while (dialogStack.length) closeDialog();
  }

  function hasOpenDialog() { return dialogStack.length > 0; }

  /* ---------------- combo box (reusable categorical values) ---------------- */
  function comboBox(opts) {
    /* opts: { label, values, value, multiple, placeholder, onChange, allowCreate } */
    const wrap = document.createElement('div');
    wrap.className = 'combo';
    wrap.setAttribute('data-combo', '1');

    let selected = opts.multiple ? (opts.value || []).slice() : (opts.value || null);
    let open = false;

    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'text';
    input.placeholder = opts.placeholder || (opts.multiple ? 'Buscar o crear...' : 'Buscar...');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.autocomplete = 'off';

    const list = document.createElement('div');
    list.className = 'combo-list';
    list.hidden = true;

    const summary = document.createElement('div');
    summary.className = 'multi-select';

    function chip(text) {
      const c = document.createElement('span');
      c.className = 'tag-chip primary';
      c.textContent = text;
      if (opts.multiple) {
        const x = document.createElement('button');
        x.type = 'button';
        x.textContent = '✕';
        x.style.cssText = 'margin-left:6px;border:0;background:transparent;cursor:pointer;color:inherit';
        x.addEventListener('click', function (e) {
          e.stopPropagation();
          selected = selected.filter(v => v !== text);
          render(); emit();
        });
        c.appendChild(x);
      }
      return c;
    }

    function render() {
      if (opts.multiple) {
        summary.innerHTML = '';
        if (!selected.length) {
          const s = document.createElement('span');
          s.className = 'hint';
          s.textContent = opts.placeholder || 'Sin selección';
          summary.appendChild(s);
        } else selected.forEach(v => summary.appendChild(chip(v)));
      } else {
        input.value = selected || '';
      }
    }

    function renderList(q) {
      list.innerHTML = '';
      const values = (opts.values || []).filter(v => !q || v.toLowerCase().indexOf(q.toLowerCase()) >= 0);
      if (!values.length && q && opts.allowCreate !== false) {
        const b = document.createElement('button');
        b.className = 'combo-new';
        b.innerHTML = Icons.svg('plus', 16) + '<span>Crear "' + escapeHtml(q) + '"</span>';
        b.addEventListener('click', function () {
          closeList();
          if (opts.multiple) { selected.push(q); } else { selected = q; }
          render(); emit();
        });
        list.appendChild(b);
      }
      values.forEach(function (v) {
        const b = document.createElement('button');
        const isSel = opts.multiple ? selected.includes(v) : selected === v;
        b.innerHTML = '<span>' + escapeHtml(v) + '</span>' + (isSel ? '<span class="ck">' + Icons.svg('check', 16) + '</span>' : '');
        b.addEventListener('click', function () {
          if (opts.multiple) {
            selected = selected.includes(v) ? selected.filter(x => x !== v) : selected.concat([v]);
          } else {
            selected = v;
            closeList();
          }
          render(); emit();
        });
        list.appendChild(b);
      });
      if (!values.length && !(q && opts.allowCreate !== false)) {
        const e = document.createElement('div');
        e.className = 'hint';
        e.style.padding = '10px 12px';
        e.textContent = 'Sin coincidencias';
        list.appendChild(e);
      }
    }

    function openList() {
      open = true; list.hidden = false; input.setAttribute('aria-expanded', 'true');
      renderList('');
      document.addEventListener('click', outside);
    }
    function closeList() {
      open = false; list.hidden = true; input.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', outside);
    }
    function outside(e) { if (!wrap.contains(e.target)) closeList(); }

    function emit() { if (opts.onChange) opts.onChange(opts.multiple ? selected.slice() : selected); }

    input.addEventListener('focus', function () { openList(); });
    input.addEventListener('input', function () {
      if (!open) openList();
      renderList(input.value);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = input.value.trim();
        if (q && (opts.allowCreate !== false) && !(opts.values || []).includes(q)) {
          if (opts.multiple) { if (!selected.includes(q)) selected.push(q); } else selected = q;
          input.value = '';
          renderList('');
          render(); emit();
        }
      } else if (e.key === 'Escape') { closeList(); }
    });

    render();

    wrap.appendChild(input);
    if (opts.multiple) wrap.appendChild(summary);
    wrap.appendChild(list);
    return wrap;
  }

  /* ---------------- switch ---------------- */
  function switchRow(title, sub, value, onChange) {
    const row = document.createElement('div');
    row.className = 'switch-row';
    const txt = document.createElement('div');
    txt.className = 'sw-text';
    txt.innerHTML = '<div class="sw-title">' + escapeHtml(title) + '</div>' + (sub ? '<div class="sw-sub">' + escapeHtml(sub) + '</div>' : '');
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'switch' + (value ? ' on' : '');
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', value ? 'true' : 'false');
    sw.setAttribute('aria-label', title);
    sw.addEventListener('click', function () {
      const next = !sw.classList.contains('on');
      sw.classList.toggle('on', next);
      sw.setAttribute('aria-checked', next ? 'true' : 'false');
      onChange(next);
    });
    row.appendChild(txt);
    row.appendChild(sw);
    return row;
  }

  /* ---------------- file explorer (shared component) ---------------- */
  const EXPLORER_ROOTS = [
    { name: 'Peliculas', path: 'D:\\Media\\Peliculas' },
    { name: 'Series', path: 'D:\\Media\\Series' },
    { name: 'Musica', path: 'D:\\Musica' },
    { name: 'Familia', path: 'E:\\Familia' },
    { name: 'Descargas', path: 'C:\\Users\\Frank\\Downloads' }
  ];

  const MAX_TREE_DEPTH = 3;
  function buildFakeTree(path, depth) {
    /* deterministic pseudo-filesystem based on the path hash */
    depth = depth || 0;
    if (depth >= MAX_TREE_DEPTH) return [];
    const h = (function (s) { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return Math.abs(x); })(path);
    const names = ['Documentales', 'Clásicos', 'Facciones', 'Temporadas', 'Recitales', 'Serie A', 'Tesis', 'Reportajes', 'Originales', 'Extras'];
    const r = (function (a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(h);
    const folders = names.slice(0, 4 + Math.floor(r() * 5)).map(function (n) {
      return { name: n, path: path + '\\' + n, kind: 'folder', size: 0, children: buildFakeTree(path + '\\' + n, depth + 1) };
    });
    return folders;
  }

  function fileListFor(path, kind) {
    const h = (function (s) { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return Math.abs(x); })(path);
    const r = (function (a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(h);
    const out = [];
    if (kind === 'folder') {
      buildFakeTree(path).forEach(function (f) { out.push({ name: f.name, path: f.path, kind: 'folder', size: 0 }); });
      return out;
    }
    const pools = {
      video: ['Pelicula 2024 1080p.mkv', 'Documental.mkv', 'Episodio S01E03.mkv', 'Concierto.mp4', 'Charla.mp4', 'Receta corta.mp4', 'Demo HDR.mp4'],
      image: ['poster.png', 'caratula-vertical.jpg', 'thumbnail.jpg', 'banner.png', 'portada.jpg'],
      subtitle: ['subtitulos.es.srt', 'subtitulos.en.ass', 'forced.vtt', 'audio-described.srt'],
      audio: ['pista 01.flac', 'pista 02.flac', 'album track.mp3']
    };
    const pool = pools[kind] || pools.video;
    const n = 6 + Math.floor(r() * 8);
    for (let i = 0; i < n; i++) {
      const base = pool[Math.floor(r() * pool.length)];
      const name = i < pool.length ? base : base.replace(/\.[a-z0-9]+$/i, ' (' + (i + 1) + ')$&');
      out.push({
        name: name,
        path: path + '\\' + name,
        kind: 'file',
        size: Math.floor(r() * 9) * 1073741824 + Math.floor(r() * 900000000),
        thumb: kind === 'video' || kind === 'image' ? Data.artWide(name) : null
      });
    }
    return out;
  }

  /**
   * Opens the reusable file explorer.
   * opts: { kind: 'video'|'image'|'subtitle'|'folder'|'audio', title, multiple, onPick(paths) }
   */
  function openFileExplorer(opts) {
    const kind = opts.kind || 'video';
    const filterLabel = { video: 'Videos', image: 'Imágenes', subtitle: 'Subtítulos', folder: 'Carpetas', audio: 'Audio' }[kind];
    const multiple = !!opts.multiple;

    let body = document.createElement('div');
    body.innerHTML =
      '<div class="explorer">' +
        '<div class="ex-tree" id="exTree"></div>' +
        '<div><div class="hint" style="margin-bottom:8px" id="exPath"></div><div class="ex-files" id="exFiles"></div></div>' +
      '</div>';

    let currentPath = EXPLORER_ROOTS[0].path;
    const picked = new Map();

    function renderTree(node, container, depth) {
      const btn = document.createElement('button');
      btn.innerHTML = Icons.svg('folder', 18) + '<span>' + escapeHtml(node.name) + '</span>';
      btn.style.paddingLeft = (10 + depth * 14) + 'px';
      btn.addEventListener('click', function () {
        currentPath = node.path;
        renderAll();
      });
      container.appendChild(btn);
      (node.children || []).forEach(function (c) { renderTree(c, container, depth + 1); });
    }

    function renderAll() {
      const tree = $('#exTree', body);
      tree.innerHTML = '';
      EXPLORER_ROOTS.forEach(function (r) {
        const node = { name: r.name, path: r.path, children: buildFakeTree(r.path) };
        renderTree(node, tree, 0);
      });
      const sel = tree.querySelector('button');
      if (sel) sel.classList.add('sel');

      $('#exPath', body).textContent = currentPath;

      const files = $('#exFiles', body);
      files.innerHTML = '';
      if (kind === 'folder') {
        EXPLORER_ROOTS.forEach(function (r) {
          const cell = document.createElement('div');
          cell.className = 'ex-file';
          cell.innerHTML = '<div class="ex-thumb" style="background:' + 'linear-gradient(135deg,#4f5bd5,#8b5cf6);aspect-ratio:16/9"></div>' +
            '<div class="ex-name">' + escapeHtml(r.name) + '</div><div class="ex-name sub">carpeta</div>';
          cell.addEventListener('click', function () { currentPath = r.path; renderAll(); });
          files.appendChild(cell);
        });
        return;
      }
      fileListFor(currentPath, kind).forEach(function (f) {
        const cell = document.createElement('div');
        cell.className = 'ex-file';
        const isSel = picked.has(f.path);
        if (isSel) cell.classList.add('sel');
        cell.innerHTML =
          (f.thumb ? '<div class="ex-thumb" style="background-image:url(' + f.thumb + ')"></div>'
                   : '<div class="ex-thumb" style="background:linear-gradient(135deg,#374151,#4b5563)">' + Icons.svg(kind === 'subtitle' ? 'subtitle' : kind === 'audio' ? 'music' : 'film', 26) + '</div>') +
          '<div class="ex-name">' + escapeHtml(f.name) + '</div>' +
          '<div class="ex-name sub">' + formatBytes(f.size) + '</div>';
        cell.addEventListener('click', function () {
          if (multiple) {
            if (picked.has(f.path)) { picked.delete(f.path); cell.classList.remove('sel'); }
            else { picked.set(f.path, f); cell.classList.add('sel'); }
          } else {
            picked.clear(); picked.set(f.path, f); renderAll();
          }
        });
        files.appendChild(cell);
      });
    }

    openDialog({
      title: (opts.title || 'Explorar') + ' — ' + filterLabel,
      wide: true,
      body: body.innerHTML,
      onOpen: function (b) {
        body = b;
        renderAll();
      },
      actions: [
        { label: 'Cancelar', variant: 'text' },
        {
          label: multiple ? 'Agregar (' + picked.size + ')' : 'Seleccionar',
          variant: 'filled',
          onClick: function () {
            if (!picked.size) { toast('Selecciona al menos un archivo.', 'error'); return false; }
            if (opts.onPick) opts.onPick(Array.from(picked.values()).map(function (f) { return { path: f.path, name: f.name, size: f.size }; }));
          }
        }
      ]
    });
    renderAll();
  }

  /* ---------------- add/edit media form ---------------- */
  /**
   * form = { mode: 'video'|'episode', video?: existing, seriesId?, seasonNumber? }
   */
  function openMediaForm(form) {
    const isEdit = !!form.video;
    const v = form.video || {};
    let body = document.createElement('div');
    body.innerHTML =
      '<div class="tabs" id="fmTabs">' +
        '<button class="tab active" data-tab="basico">Básico</button>' +
        '<button class="tab" data-tab="pistas">Subtítulos y audio</button>' +
        '<button class="tab" data-tab="taxonomia">Categoría y etiquetas</button>' +
        '<button class="tab" data-tab="imagen">Miniatura y carátula</button>' +
      '</div>' +
      '<div data-panel="basico">' +
        '<div class="field"><span class="field-label">Archivo de video</span>' +
          '<div style="display:flex;gap:8px;align-items:center"><input class="input" id="fmPath" readonly placeholder="Sin archivo seleccionado" value="' + escapeHtml(v.path || '') + '" style="flex:1" />' +
          '<button class="btn btn-outlined" id="fmBrowse">' + Icons.svg('folder', 18) + 'Explorar</button></div>' +
          '<span class="hint">El sistema nunca copia el archivo: se guarda la ruta original.</span>' +
        '</div>' +
        '<div class="field"><span class="field-label">Título</span><input class="input" id="fmTitle" value="' + escapeHtml(v.title || '') + '" placeholder="Detectado automáticamente" /></div>' +
        '<div class="grid-2">' +
          '<div class="field"><span class="field-label">Año</span><input class="input" id="fmYear" type="number" value="' + (v.year || new Date().getFullYear()) + '" /></div>' +
          '<div class="field"><span class="field-label">Género (texto libre)</span><input class="input" id="fmGenre" value="' + escapeHtml(v.genre || '') + '" placeholder="Drama" /></div>' +
        '</div>' +
        '<div class="grid-2">' +
          '<div class="field"><span class="field-label">Duración (segundos)</span><input class="input" id="fmDuration" type="number" value="' + (v.duration || 0) + '" /></div>' +
          '<div class="field"><span class="field-label">Calidad</span><input class="input" id="fmQuality" list="qualList" value="' + escapeHtml(v.quality || '') + '" placeholder="1080p" /><datalist id="qualList">' + Data.QUALITIES.map(q => '<option value="' + q + '">').join('') + '</datalist></div>' +
        '</div>' +
        '<div class="grid-2">' +
          '<div class="field"><span class="field-label">Códec de video</span><input class="input" id="fmVCodec" value="' + escapeHtml(v.videoCodec || '') + '" /></div>' +
          '<div class="field"><span class="field-label">Códec de audio</span><input class="input" id="fmACodec" value="' + escapeHtml(v.audioCodec || '') + '" /></div>' +
        '</div>' +
        '<div class="field"><span class="field-label">Sinopsis</span><textarea class="textarea" id="fmSynopsis" placeholder="Descripción del contenido">' + escapeHtml(v.synopsis || '') + '</textarea></div>' +
        '<div class="field"><span class="field-label">Notas</span><input class="input" id="fmNotes" value="' + escapeHtml(v.notes || '') + '" /></div>' +
      '</div>' +
      '<div data-panel="pistas" hidden>' +
        '<div class="hint" style="margin-bottom:10px">Lista dinámica generada a partir de las pistas detectadas en <b>este</b> archivo. No es una configuración global.</div>' +
        '<div id="fmTracks"></div>' +
        '<div style="display:flex;gap:8px;margin-top:12px">' +
          '<button class="btn btn-outlined" id="fmAddSub">' + Icons.svg('captions', 18) + 'Agregar subtítulo externo</button>' +
          '<button class="btn btn-outlined" id="fmDetect">' + Icons.svg('scan', 18) + 'Volver a detectar pistas</button>' +
        '</div>' +
      '</div>' +
      '<div data-panel="taxonomia" hidden><div id="fmTax"></div></div>' +
      '<div data-panel="imagen" hidden>' +
        '<div class="grid-2">' +
          '<div class="field"><span class="field-label">Miniatura horizontal</span><div style="display:flex;gap:8px;align-items:center"><div id="fmThumbPrev" style="width:150px;aspect-ratio:16/9;border-radius:8px;background-size:cover;background-position:center;background-color:var(--md-sys-color-surface-container-highest)"></div><button class="btn btn-outlined" id="fmReplaceThumb">' + Icons.svg('image', 18) + 'Reemplazar</button></div></div>' +
          '<div class="field"><span class="field-label">Carátula vertical</span><div style="display:flex;gap:8px;align-items:center"><div id="fmPosterPrev" style="width:90px;aspect-ratio:2/3;border-radius:8px;background-size:cover;background-position:center;background-color:var(--md-sys-color-surface-container-highest)"></div><button class="btn btn-outlined" id="fmReplacePoster">' + Icons.svg('image', 18) + 'Reemplazar</button></div></div>' +
        '</div>' +
        '<div class="hint">Si no se provee carátula vertical, se genera recortando la miniatura horizontal sin deformar.</div>' +
        '<button class="btn btn-tonal" id="fmGenPoster" style="margin-top:10px">' + Icons.svg('scan', 18) + 'Generar carátula desde miniatura</button>' +
      '</div>';

    const model = {
      id: v.id,
      title: v.title || '',
      year: v.year || new Date().getFullYear(),
      genre: v.genre || '',
      duration: v.duration || 0,
      quality: v.quality || '',
      videoCodec: v.videoCodec || '',
      audioCodec: v.audioCodec || '',
      synopsis: v.synopsis || '',
      notes: v.notes || '',
      path: v.path || '',
      source: v.source || Data.SAMPLE[0],
      thumbnail: v.thumbnail || null,
      poster: v.poster || null,
      categoryId: v.categoryId || null,
      tags: (v.tags || []).slice(),
      audioTracks: cloneTracks(v.audioTracks || []),
      subtitleTracks: cloneTracks(v.subtitleTracks || []),
      addedAt: v.addedAt || new Date().toISOString(),
      watched: v.watched || false,
      progress: v.progress || 0,
      rating: v.rating || 0,
      favorite: v.favorite || false,
      hidden: v.hidden || false,
      chapters: v.chapters || [],
      introStart: v.introStart || 0, introEnd: v.introEnd || 0,
      creditsStart: v.creditsStart || 0, creditsEnd: v.creditsEnd || 0,
      resolution: v.resolution || v.quality || '',
      sizeBytes: v.sizeBytes || 0
    };

    function cloneTracks(arr) { return JSON.parse(JSON.stringify(arr || [])); }

    /* tabs */
    $$('#fmTabs .tab', body).forEach(function (tab) {
      tab.addEventListener('click', function () {
        $$('#fmTabs .tab', body).forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        $$('[data-panel]', body).forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== tab.getAttribute('data-tab'); });
      });
    });

    /* preview helpers */
    function paintPreviews() {
      const tp = $('#fmThumbPrev', body), pp = $('#fmPosterPrev', body);
      tp.style.backgroundImage = model.thumbnail ? 'url(' + model.thumbnail + ')' : '';
      pp.style.backgroundImage = model.poster ? 'url(' + model.poster + ')' : '';
    }

    /* metadata extraction (simulated ExtractMetadataFromPathCommand) */
    function extractMetadata(path) {
      const base = path.split(/[\\/]/).pop().replace(/\.[A-Za-z0-9]+$/, '');
      const yearMatch = base.match(/(19|20)\d{2}/);
      const qMatch = base.match(/\b(2160p|1440p|1080p|720p|480p)\b/i);
      model.title = model.title || base.replace(/[._]/g, ' ').trim();
      if (yearMatch) model.year = parseInt(yearMatch[0], 10);
      if (qMatch) model.quality = model.quality || qMatch[1].toLowerCase();
      model.duration = model.duration || (600 + (base.length * 37) % 3600);
      model.videoCodec = model.videoCodec || 'HEVC';
      model.audioCodec = model.audioCodec || 'E-AC3';
      if (!model.thumbnail) model.thumbnail = Data.artWide(base);
      if (!model.poster) model.poster = Data.art(base);
      if (!model.audioTracks.length) {
        model.audioTracks = [
          { id: 'at-' + Date.now() + '-0', language: 'Español', codec: 'E-AC3 5.1', channels: 6, isDefault: true },
          { id: 'at-' + Date.now() + '-1', language: 'Inglés', codec: 'AC3 2.0', channels: 2, isDefault: false }
        ];
      }
      if (!model.subtitleTracks.length) {
        model.subtitleTracks = [
          { id: 'st-' + Date.now() + '-0', language: 'Español', format: 'embedded', path: null, isDefault: true }
        ];
      }
      syncForm();
      paintPreviews();
      renderTracks();
      toast('Metadatos extraídos del archivo.', 'success');
    }

    function syncForm() {
      $('#fmTitle', body).value = model.title;
      $('#fmYear', body).value = model.year;
      $('#fmGenre', body).value = model.genre;
      $('#fmDuration', body).value = model.duration;
      $('#fmQuality', body).value = model.quality;
      $('#fmVCodec', body).value = model.videoCodec;
      $('#fmACodec', body).value = model.audioCodec;
      $('#fmSynopsis', body).value = model.synopsis;
      $('#fmNotes', body).value = model.notes;
      $('#fmPath', body).value = model.path;
    }

    /* tracks panel */
    function renderTracks() {
      const host = $('#fmTracks', body);
      host.innerHTML = '';
      const subTitle = document.createElement('div');
      subTitle.className = 'pp-title-sm';
      subTitle.textContent = 'Pistas de subtítulo (' + model.subtitleTracks.length + ')';
      host.appendChild(subTitle);
      if (!model.subtitleTracks.length) {
        const e = document.createElement('div'); e.className = 'hint'; e.textContent = 'Este archivo no trae subtítulos embebidos.'; host.appendChild(e);
      }
      model.subtitleTracks.forEach(function (st, i) {
        const row = document.createElement('div');
        row.className = 'pp-opt';
        const combo = comboBox({
          label: 'Idioma', values: Data.LANGUAGES, value: st.language, allowCreate: false,
          onChange: function (val) { st.language = val; }
        });
        combo.querySelector('input').style.width = '160px';
        row.appendChild(combo);
        const fmt = document.createElement('span');
        fmt.className = 'pill' + (st.format === 'embedded' ? ' primary' : '');
        fmt.textContent = st.format === 'embedded' ? 'embebido' : 'externo';
        row.appendChild(fmt);
        const def = document.createElement('button');
        def.className = 'icon-btn sm' + (st.isDefault ? ' active' : '');
        def.innerHTML = Icons.svg('check', 19);
        def.title = 'Marcar como pista por defecto';
        def.addEventListener('click', function () {
          model.subtitleTracks.forEach(function (x) { x.isDefault = false; });
          st.isDefault = true;
          renderTracks();
        });
        row.appendChild(def);
        const del = document.createElement('button');
        del.className = 'icon-btn sm';
        del.innerHTML = Icons.svg('delete', 19);
        del.title = 'Quitar pista';
        del.addEventListener('click', function () { model.subtitleTracks.splice(i, 1); renderTracks(); });
        row.appendChild(del);
        host.appendChild(row);
      });

      const auTitle = document.createElement('div');
      auTitle.className = 'pp-title-sm';
      auTitle.style.marginTop = '14px';
      auTitle.textContent = 'Pistas de audio (' + model.audioTracks.length + ')';
      host.appendChild(auTitle);
      model.audioTracks.forEach(function (at, i) {
        const row = document.createElement('div');
        row.className = 'pp-opt';
        const combo = comboBox({
          values: Data.LANGUAGES, value: at.language, allowCreate: false,
          onChange: function (val) { at.language = val; }
        });
        combo.querySelector('input').style.width = '160px';
        row.appendChild(combo);
        const c = document.createElement('span');
        c.className = 'pill';
        c.textContent = at.codec + ' · ' + at.channels + 'ch';
        row.appendChild(c);
        const def = document.createElement('button');
        def.className = 'icon-btn sm' + (at.isDefault ? ' active' : '');
        def.innerHTML = Icons.svg('check', 19);
        def.title = 'Marcar como pista por defecto';
        def.addEventListener('click', function () {
          model.audioTracks.forEach(function (x) { x.isDefault = false; });
          at.isDefault = true;
          renderTracks();
        });
        row.appendChild(def);
        host.appendChild(row);
      });
    }

    /* taxonomy panel */
    function renderTax() {
      const host = $('#fmTax', body);
      host.innerHTML = '';
      const catField = document.createElement('div');
      catField.className = 'field';
      catField.innerHTML = '<span class="field-label">Categoría (selección única)</span>';
      const catCombo = comboBox({
        values: Store.state.categories.map(function (c) { return c.name; }),
        value: (Store.state.categories.find(function (c) { return c.id === model.categoryId; }) || {}).name || null,
        placeholder: 'Buscar categoría…',
        onChange: function (val) {
          const c = Store.state.categories.find(function (x) { return x.name === val; });
          model.categoryId = c ? c.id : null;
        }
      });
      catField.appendChild(catCombo);
      host.appendChild(catField);

      const tagField = document.createElement('div');
      tagField.className = 'field';
      tagField.innerHTML = '<span class="field-label">Etiquetas (selección múltiple)</span>';
      const tagCombo = comboBox({
        values: Store.state.tags, value: model.tags, multiple: true, placeholder: 'Buscar o crear etiqueta…',
        onChange: function (vals) {
          model.tags = vals;
          vals.forEach(function (t) {
            if (Store.state.tags.indexOf(t) < 0) Store.dispatch(Store.actions.CREATE_TAG(t));
          });
        }
      });
      tagField.appendChild(tagCombo);
      host.appendChild(tagField);

      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'La categoría agrupa de forma amplia; las etiquetas identifican de forma específica. Ambas se administran desde Taxonomía.';
      host.appendChild(hint);
    }

    /* browse + extract */
    $('#fmBrowse', body).addEventListener('click', function () {
      openFileExplorer({
        kind: 'video', title: 'Seleccionar video',
        onPick: function (files) {
          model.path = files[0].path;
          extractMetadata(model.path);
        }
      });
    });
    $('#fmDetect', body).addEventListener('click', function () {
      if (!model.path) { toast('Selecciona primero un archivo.', 'error'); return; }
      extractMetadata(model.path);
    });
    $('#fmAddSub', body).addEventListener('click', function () {
      openFileExplorer({
        kind: 'subtitle', title: 'Adjuntar subtítulo a este video',
        onPick: function (files) {
          model.subtitleTracks.push({
            id: 'st-' + Date.now(), language: 'Español', format: 'external', path: files[0].path, isDefault: false
          });
          renderTracks();
          toast('Subtítulo adjuntado a este video.', 'success');
        }
      });
    });
    $('#fmReplaceThumb', body).addEventListener('click', function () {
      openFileExplorer({
        kind: 'image', title: 'Reemplazar miniatura horizontal',
        onPick: function (files) { model.thumbnail = Data.artWide(files[0].name); paintPreviews(); }
      });
    });
    $('#fmReplacePoster', body).addEventListener('click', function () {
      openFileExplorer({
        kind: 'image', title: 'Reemplazar carátula vertical',
        onPick: function (files) { model.poster = Data.art(files[0].name); paintPreviews(); }
      });
    });
    $('#fmGenPoster', body).addEventListener('click', function () {
      model.poster = Data.art(model.title);
      paintPreviews();
      toast('Carátula generada desde la miniatura horizontal.', 'success');
    });

    ['fmTitle', 'fmYear', 'fmGenre', 'fmDuration', 'fmQuality', 'fmVCodec', 'fmACodec', 'fmSynopsis', 'fmNotes'].forEach(function (id) {
      const key = id.replace('fm', '').toLowerCase();
      const map = { title: 'title', year: 'year', genre: 'genre', duration: 'duration', quality: 'quality', vcodec: 'videoCodec', acodec: 'audioCodec', synopsis: 'synopsis', notes: 'notes' };
      $('#' + id, body).addEventListener('input', function (e) {
        let val = e.target.value;
        if (map[key] === 'year' || map[key] === 'duration') val = parseInt(val, 10) || 0;
        model[map[key]] = val;
        if (map[key] === 'title') model.poster = Data.art(val), model.thumbnail = Data.artWide(val), paintPreviews();
      });
    });

    openDialog({
      title: isEdit ? 'Editar contenido' : 'Agregar contenido',
      wide: true,
      body: body.innerHTML,
      onOpen: function (b) {
        body = b;
        initBindings();
        paintPreviews();
        renderTracks();
        renderTax();
      },
      actions: [
        { label: 'Cancelar', variant: 'text' },
        {
          label: isEdit ? 'Guardar cambios' : 'Agregar a la biblioteca',
          variant: 'filled',
          onClick: function () {
            if (!model.path) { toast('Selecciona el archivo de video.', 'error'); return false; }
            if (!model.title) { toast('El título no puede quedar vacío.', 'error'); return false; }
            if (opts.onSave) opts.onSave(model);
          }
        }
      ]
    });

    function initBindings() {
      $$('#fmTabs .tab', body).forEach(function (tab) {
        tab.addEventListener('click', function () {
          $$('#fmTabs .tab', body).forEach(function (t) { t.classList.remove('active'); });
          tab.classList.add('active');
          $$('[data-panel]', body).forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== tab.getAttribute('data-tab'); });
        });
      });
      $('#fmBrowse', body).addEventListener('click', function () {
        openFileExplorer({
          kind: 'video', title: 'Seleccionar video',
          onPick: function (files) { model.path = files[0].path; extractMetadata(model.path); }
        });
      });
      $('#fmDetect', body).addEventListener('click', function () {
        if (!model.path) { toast('Selecciona primero un archivo.', 'error'); return; }
        extractMetadata(model.path);
      });
      $('#fmAddSub', body).addEventListener('click', function () {
        openFileExplorer({
          kind: 'subtitle', title: 'Adjuntar subtítulo a este video',
          onPick: function (files) {
            model.subtitleTracks.push({ id: 'st-' + Date.now(), language: 'Español', format: 'external', path: files[0].path, isDefault: false });
            renderTracks(); toast('Subtítulo adjuntado a este video.', 'success');
          }
        });
      });
      $('#fmReplaceThumb', body).addEventListener('click', function () {
        openFileExplorer({ kind: 'image', title: 'Reemplazar miniatura horizontal', onPick: function (f) { model.thumbnail = Data.artWide(f[0].name); paintPreviews(); } });
      });
      $('#fmReplacePoster', body).addEventListener('click', function () {
        openFileExplorer({ kind: 'image', title: 'Reemplazar carátula vertical', onPick: function (f) { model.poster = Data.art(f[0].name); paintPreviews(); } });
      });
      $('#fmGenPoster', body).addEventListener('click', function () { model.poster = Data.art(model.title); paintPreviews(); toast('Carátula generada.', 'success'); });
      var fmap = { fmTitle: 'title', fmYear: 'year', fmGenre: 'genre', fmDuration: 'duration', fmQuality: 'quality', fmVCodec: 'videoCodec', fmACodec: 'audioCodec', fmSynopsis: 'synopsis', fmNotes: 'notes' };
      Object.keys(fmap).forEach(function (id) {
        $('#' + id, body).addEventListener('input', function (e) {
          var val = e.target.value;
          if (fmap[id] === 'year' || fmap[id] === 'duration') val = parseInt(val, 10) || 0;
          model[fmap[id]] = val;
          if (fmap[id] === 'title') { model.poster = Data.art(val); model.thumbnail = Data.artWide(val); paintPreviews(); }
        });
      });
    }
  }

  /* ---------------- helpers ---------------- */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function formatBytes(b) {
    if (!b) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0, n = b;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return n.toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
  }
  function formatDuration(sec) {
    if (!sec && sec !== 0) return '--:--';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
             : m + ':' + String(s).padStart(2, '0');
  }
  function timeAgo(iso) {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return 'hace ' + Math.floor(diff / 60) + ' min';
    if (diff < 86400) return 'hace ' + Math.floor(diff / 3600) + ' h';
    if (diff < 2592000) return 'hace ' + Math.floor(diff / 86400) + ' d';
    return d.toLocaleDateString('es');
  }

  global.UI = {
    $: $, $$: $$, toast: toast, openDialog: openDialog, closeDialog: closeDialog,
    closeAllDialogs: closeAllDialogs, hasOpenDialog: hasOpenDialog,
    comboBox: comboBox, switchRow: switchRow, openFileExplorer: openFileExplorer,
    openMediaForm: openMediaForm, escapeHtml: escapeHtml, formatBytes: formatBytes,
    formatDuration: formatDuration, timeAgo: timeAgo
  };
})(window);
