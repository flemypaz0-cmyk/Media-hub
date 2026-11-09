/* =====================================================================
   MediaHub — Player
   Video overlay (scrub preview, speed, A-B repeat, chapters, image
   adjustments, subtitle styling, PiP, cast, sleep timer) + music
   mini-player with queue, equalizer and crossfade.
   ===================================================================== */
(function (global) {
  'use strict';

  const { $, $$, toast } = UI;

  const video = { el: null, item: null, ab: { a: null, b: null }, timer: null, nextTimer: null, panel: null, hideTimer: null };

  /* ===================== VIDEO PLAYER ===================== */
  function initVideo() {
    video.el = $('#videoEl');
    const stage = $('#playerStage');

    /* --- play/pause --- */
    $('#pcPlay').addEventListener('click', togglePlay);
    $('#closePlayer').addEventListener('click', closeVideo);

    /* --- seeking --- */
    const track = $('#pcTrack');
    function seekFromEvent(e) {
      const rect = track.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const dur = video.el.duration || 0;
      video.el.currentTime = ratio * dur;
      updateProgress();
    }
    track.addEventListener('click', seekFromEvent);

    /* --- hover preview (YouTube style) --- */
    track.addEventListener('mousemove', function (e) {
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const dur = video.el.duration || 0;
      const t = ratio * dur;
      const preview = $('#scrubPreview');
      const thumb = $('#spThumb');
      const time = $('#spTime');
      time.textContent = UI.formatDuration(t);
      /* deterministic "scene" thumbnail derived from the time position */
      thumb.style.backgroundImage = Data.artWide('escena ' + Math.floor(t / 30));
      const stageRect = stage.getBoundingClientRect();
      preview.hidden = false;
      const x = rect.left - stageRect.left + ratio * rect.width;
      preview.style.left = Math.max(90, Math.min(stageRect.width - 90, x)) + 'px';
    });
    track.addEventListener('mouseleave', function () { $('#scrubPreview').hidden = true; });

    /* --- volume --- */
    $('#pcVolume').addEventListener('input', function (e) {
      video.el.volume = e.target.value / 100;
      video.el.muted = e.target.value === 0;
      Store.dispatch(Store.actions.SET({ volume: e.target.value }));
    });

    /* --- speed (bidirectional slider, centred at 1x) --- */
    const speed = $('#pcSpeed');
    speed.addEventListener('input', function () {
      const pct = (speed.value - 100) / 100;           /* -0.5 .. +2 */
      const rate = 1 + pct;
      video.el.playbackRate = rate;
      $('#pcSpeedVal').textContent = formatRate(rate);
      Store.dispatch(Store.actions.SET({ playbackRate: rate }));
    });
    speed.addEventListener('dblclick', function () { speed.value = 100; speed.dispatchEvent(new Event('input')); });

    /* --- skip buttons --- */
    $('#pcBack').addEventListener('click', function () { skip(-10); });
    $('#pcFwd').addEventListener('click', function () { skip(10); });
    $('#pcRepeat').addEventListener('click', function () {
      video.el.currentTime = 0;
      video.el.play();
      feedback('repeat');
      toast('Reproduciendo desde el inicio.');
    });

    /* --- A-B repeat --- */
    $('#pcAbBtn').addEventListener('click', function () {
      const ab = video.ab;
      if (ab.a === null) { ab.a = video.el.currentTime; toast('Punto A marcado en ' + UI.formatDuration(ab.a)); }
      else if (ab.b === null) { ab.b = video.el.currentTime; $('#pcAb').hidden = false; toast('Punto B marcado en ' + UI.formatDuration(ab.b)); }
      else { ab.a = null; ab.b = null; $('#pcAb').hidden = true; toast('Repetición A-B desactivada.'); }
    });

    /* --- panels --- */
    $('#pcAudioTrack').addEventListener('click', function () { openPanel('audio'); });
    $('#pcSubTrack').addEventListener('click', function () { openPanel('subs'); });
    $('#pcQuality').addEventListener('click', function () { openPanel('quality'); });
    $('#pcChapters').addEventListener('click', function () { openPanel('chapters'); });
    $('#pcImage').addEventListener('click', function () { openPanel('image'); });
    $('#pcSubStyle').addEventListener('click', function () { openPanel('substyle'); });
    $('#pcSleep').addEventListener('click', function () { openPanel('sleep'); });
    $('#pcKeys').addEventListener('click', function () { openPanel('keys'); });
    $('#ppClose').addEventListener('click', function () { $('#playerPanel').hidden = true; });

    /* --- PiP / fullscreen / cast --- */
    $('#pPipBtn').addEventListener('click', function () {
      if (document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) document.exitPictureInPicture();
        else video.el.requestPictureInPicture().catch(function () { toast('Picture-in-picture no disponible en este navegador.', 'error'); });
      } else toast('Picture-in-picture no disponible en este navegador.', 'error');
    });
    $('#pFsBtn').addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else stage.requestFullscreen().catch(function () { toast('Pantalla completa no disponible.', 'error'); });
    });
    $('#pCastBtn').addEventListener('click', function () {
      openPanel('cast');
    });

    /* --- media events --- */
    video.el.addEventListener('timeupdate', updateProgress);
    video.el.addEventListener('loadedmetadata', function () {
      $('#pcTotal').textContent = UI.formatDuration(video.el.duration);
      updateProgress();
    });
    video.el.addEventListener('play', function () { setPlayIcon(true); });
    video.el.addEventListener('pause', function () { setPlayIcon(false); });
    video.el.addEventListener('error', function () {
      toast('No se pudo cargar el medio de demostración.', 'error');
    });
    video.el.addEventListener('ended', onEnded);

    /* --- keyboard shortcuts --- */
    document.addEventListener('keydown', function (e) {
      if ($('#playerOverlay').hidden) return;
      const prof = Store.selectors.currentProfile(Store.state);
      if (!prof.preferences.keyboardShortcuts) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].indexOf(e.target.tagName) >= 0) return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'ArrowRight': skip(10); break;
        case 'ArrowLeft': skip(-10); break;
        case 'j': skip(-30); break;
        case 'l': skip(30); break;
        case 'ArrowUp': e.preventDefault(); video.el.volume = Math.min(1, video.el.volume + 0.1); $('#pcVolume').value = video.el.volume * 100; break;
        case 'ArrowDown': e.preventDefault(); video.el.volume = Math.max(0, video.el.volume - 0.1); $('#pcVolume').value = video.el.volume * 100; break;
        case 'm': video.el.muted = !video.el.muted; break;
        case 'f': $('#pFsBtn').click(); break;
        case 'p': $('#pPipBtn').click(); break;
        case 'c': $('#pcSubTrack').click(); break;
        case 'a': $('#pcAudioTrack').click(); break;
        case 'i': $('#pcImage').click(); break;
        case 'r': $('#pcRepeat').click(); break;
        case 'Escape': closeVideo(); break;
      }
    });

    /* --- hide controls on idle --- */
    stage.addEventListener('mousemove', function () {
      $('#playerOverlay').classList.remove('ui-hidden');
      clearTimeout(video.hideTimer);
      video.hideTimer = setTimeout(function () {
        if (!video.el.paused) $('#playerOverlay').classList.add('ui-hidden');
      }, 2600);
    });
    stage.addEventListener('mouseleave', function () {
      if (!video.el.paused) $('#playerOverlay').classList.add('ui-hidden');
    });
  }

  function formatRate(r) {
    return (Math.round(r * 100) / 100).toString().replace('.', ',') + 'x';
  }

  function feedback(icon) {
    const f = $('#playerFeedback');
    f.innerHTML = Icons.svg(icon, 40);
    f.hidden = false;
    clearTimeout(f._t);
    f._t = setTimeout(function () { f.hidden = true; }, 550);
  }

  function setPlayIcon(playing) {
    $('#pcPlay').innerHTML = Icons.svg(playing ? 'pause' : 'play', 24);
    $('#pcPlay').setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
  }

  function skip(sec) {
    if (!video.el) return;
    video.el.currentTime = Math.max(0, Math.min(video.el.duration || 0, video.el.currentTime + sec));
    feedback(sec > 0 ? 'forward10' : 'replay10');
  }

  function togglePlay() {
    if (!video.el) return;
    if (video.el.paused) { video.el.play(); feedback('play'); } else { video.el.pause(); feedback('pause'); }
  }

  function updateProgress() {
    if (!video.el) return;
    const dur = video.el.duration || 0;
    const pct = dur ? (video.el.currentTime / dur) * 100 : 0;
    $('#pcFill').style.width = pct + '%';
    $('#pcHandle').style.left = pct + '%';
    $('#pcCurrent').textContent = UI.formatDuration(video.el.currentTime);
    if (video.ab.a !== null) {
      const a = (video.ab.a / (dur || 1)) * 100;
      const b = video.ab.b !== null ? (video.ab.b / (dur || 1)) * 100 : pct;
      const el = $('#pcAb');
      el.hidden = false;
      el.style.left = a + '%';
      el.style.width = Math.max(0, b - a) + '%';
    }
    /* skip intro / credits visibility */
    const t = video.el.currentTime;
    const item = video.item;
    if (item && item.introEnd > 0) $('#skipIntroBtn').hidden = !(t >= item.introStart && t < item.introEnd);
    if (item && item.creditsEnd > item.creditsStart) $('#skipCreditsBtn').hidden = !(t >= item.creditsStart && t < item.creditsEnd);

    /* persist progress */
    if (item && dur > 0 && Math.abs(video.el.currentTime - (video._lastSave || 0)) > 10) {
      video._lastSave = video.el.currentTime;
      if (item.kind === 'video') Store.dispatch(Store.actions.UPDATE_PROGRESS({ id: item.id, progress: video.el.currentTime }));
    }
  }

  function openVideo(item, opts) {
    opts = opts || {};
    video.item = item;
    video.ab = { a: null, b: null };
    $('#playerOverlay').hidden = false;
    $('#playerTitle').textContent = item.title;
    $('#playerSubtitle').textContent = (item.seriesTitle ? item.seriesTitle + ' · T' + item.seasonNumber + 'E' + item.number + ' · ' : '') + (item.path || '');
    video.el.src = item.source || Data.SAMPLE[0];
    video.el.volume = (Store.state.volume || 80) / 100;
    $('#pcVolume').value = Store.state.volume || 80;
    $('#pcSpeed').value = Math.round((Store.state.playbackRate || 1) * 100);
    $('#pcSpeedVal').textContent = formatRate(Store.state.playbackRate || 1);
    video.el.playbackRate = Store.state.playbackRate || 1;
    $('#pcAb').hidden = true;
    setPlayIcon(true);
    $('#skipIntroBtn').hidden = true;
    $('#skipCreditsBtn').hidden = true;
    if (item.progress > 0 && item.progress < item.duration - 20) {
      video.el.addEventListener('loadedmetadata', function once() {
        video.el.currentTime = item.progress;
        video.el.removeEventListener('loadedmetadata', once);
      });
    }
    video.el.play().catch(function () { /* autoplay blocked, user can press play */ });

    /* next episode countdown */
    setupNextEpisode(item);

    /* apply stored image adjustments + subtitle style */
    applyImageAdjustments();
    applySubtitleStyle();
  }

  function onEnded() {
    const item = video.item;
    if (!item) return;
    if (item.kind === 'video') {
      Store.dispatch(Store.actions.MARK_VIDEO_WATCHED(item.id));
    } else if (item.seriesId) {
      Store.dispatch(Store.actions.MARK_EPISODE_WATCHED({ seriesId: item.seriesId, episodeId: item.id }));
    }
    /* advance to the next episode of the same series, if any */
    if (item.kind === 'episode' && Store.state.autoplayNext) {
      const ser = Store.state.series.find(function (s) { return s.id === item.seriesId; });
      if (ser) {
        let next = null;
        ser.seasons.forEach(function (sn) {
          sn.episodes.forEach(function (e) {
            if (!next && e.number === item.number + 1) next = e;
          });
        });
        if (next) {
          const nextItem = Object.assign({ kind: 'episode', seriesId: ser.id, seriesTitle: ser.title, seasonNumber: item.seasonNumber }, next);
          setTimeout(function () { openVideo(nextItem); }, 900);
          toast('Siguiente episodio: ' + next.title, 'info');
          return;
        }
      }
    }
    toast('Reproducción finalizada.', 'success');
  }

  function closeVideo() {
    $('#playerOverlay').hidden = true;
    if (video.el) { video.el.pause(); video.el.removeAttribute('src'); video.el.load(); }
    clearTimeout(video.nextTimer);
    $('#nextEpPanel').hidden = true;
    $('#playerPanel').hidden = true;
    video.item = null;
  }

  /* --- skip intro / credits --- */
  function initSkipButtons() {
    $('#skipIntroBtn').addEventListener('click', function () {
      if (!video.item) return;
      video.el.currentTime = video.item.introEnd;
      toast('Intro saltada.');
    });
    $('#skipCreditsBtn').addEventListener('click', function () {
      if (!video.item) return;
      video.el.currentTime = video.item.creditsEnd;
      toast('Créditos saltados.');
    });
  }

  /* --- next episode with cancellable countdown --- */
  function setupNextEpisode(item) {
    const panel = $('#nextEpPanel');
    clearTimeout(video.nextTimer);
    panel.hidden = true;
    if (!item || item.kind !== 'episode') return;
    if (!Store.state.autoplayNext) return;

    const ser = Store.state.series.find(function (s) { return s.id === item.seriesId; });
    if (!ser) return;
    let next = null;
    ser.seasons.forEach(function (sn) {
      sn.episodes.forEach(function (e) {
        if (!next && e.number === item.number + 1 && (sn.number === item.seasonNumber || item.number + 1 <= sn.episodes.length)) next = e;
      });
    });
    if (!next) return;

    let count = 5;
    $('#neTitle').textContent = next.title;
    $('#neCount').textContent = count;
    panel.hidden = false;

    const tick = function () {
      if (count <= 0) {
        panel.hidden = true;
        const nextItem = Object.assign({ kind: 'episode', seriesId: ser.id, seriesTitle: ser.title, seasonNumber: item.seasonNumber }, next);
        openVideo(nextItem);
        return;
      }
      $('#neCount').textContent = count;
      count--;
      video.nextTimer = setTimeout(tick, 1000);
    };
    video.nextTimer = setTimeout(tick, 1000);

    $('#neCancel').onclick = function () { clearTimeout(video.nextTimer); panel.hidden = true; toast('Reproducción automática cancelada.', 'info'); };
    $('#nePlay').onclick = function () {
      clearTimeout(video.nextTimer);
      panel.hidden = true;
      const nextItem = Object.assign({ kind: 'episode', seriesId: ser.id, seriesTitle: ser.title, seasonNumber: item.seasonNumber }, next);
      openVideo(nextItem);
    };
  }

  /* --- settings panels --- */
  function openPanel(kind) {
    const panel = $('#playerPanel');
    const body = $('#ppBody');
    const title = $('#ppTitle');
    body.innerHTML = '';

    if (kind === 'audio') {
      title.textContent = 'Pista de audio';
      const tracks = (video.item && video.item.audioTracks) || [];
      body.appendChild(optionRow('Ninguna', false, function () {
        tracks.forEach(function (t) { t.isDefault = false; });
      }, !tracks.some(function (t) { return t.isDefault; })));
      tracks.forEach(function (t) {
        body.appendChild(optionRow(t.language + ' · ' + t.codec, t.isDefault, function () {
          tracks.forEach(function (x) { x.isDefault = false; });
          t.isDefault = true;
        }, t.isDefault));
      });
    }

    if (kind === 'subs') {
      title.textContent = 'Pista de subtítulos';
      const tracks = (video.item && video.item.subtitleTracks) || [];
      body.appendChild(optionRow('Ninguno', false, function () {
        tracks.forEach(function (t) { t.isDefault = false; });
        $('#subOverlay').hidden = true;
      }, !tracks.some(function (t) { return t.isDefault; })));
      tracks.forEach(function (t) {
        body.appendChild(optionRow(t.language + ' · ' + (t.format === 'embedded' ? 'embebido' : 'externo'), t.isDefault, function () {
          tracks.forEach(function (x) { x.isDefault = false; });
          t.isDefault = true;
          showSubtitleSample(t.language);
        }, t.isDefault));
      });
      const add = document.createElement('button');
      add.className = 'btn btn-outlined';
      add.innerHTML = Icons.svg('plus', 18) + 'Adjuntar subtítulo externo';
      add.addEventListener('click', function () {
        UI.openFileExplorer({
          kind: 'subtitle', title: 'Adjuntar a este video',
          onPick: function (files) {
            if (!video.item.subtitleTracks) video.item.subtitleTracks = [];
            video.item.subtitleTracks.push({ id: 'st-' + Date.now(), language: 'Español', format: 'external', path: files[0].path, isDefault: true });
            toast('Subtítulo adjuntado al video en reproducción.', 'success');
            openPanel('subs');
          }
        });
      });
      body.appendChild(add);
    }

    if (kind === 'quality') {
      title.textContent = 'Calidad de reproducción';
      const opts = ['Automática', '2160p', '1440p', '1080p', '720p', '480p'];
      opts.forEach(function (o, i) {
        body.appendChild(optionRow(o, i === 0, function () { toast('Calidad: ' + o); }));
      });
    }

    if (kind === 'chapters') {
      title.textContent = 'Capítulos';
      const ch = (video.item && video.item.chapters) || [];
      if (!ch.length) {
        const e = document.createElement('div');
        e.className = 'hint';
        e.textContent = 'Este contenido no tiene capítulos definidos.';
        body.appendChild(e);
      }
      ch.forEach(function (c) {
        const r = optionRow(c.title + '  ·  ' + UI.formatDuration(c.start), false, function () {
          video.el.currentTime = c.start;
          toast('Capítulo: ' + c.title);
        });
        r.querySelector('.pp-opt-tx span').textContent = UI.formatDuration(c.start) + ' → ' + UI.formatDuration(c.end);
        body.appendChild(r);
      });
    }

    if (kind === 'image') {
      title.textContent = 'Ajustes de imagen';
      const a = Store.state.imageAdjustments;
      const fields = [
        ['contrast', 'Contraste', 50, 200], ['brightness', 'Brillo', 50, 200],
        ['sharpness', 'Nitidez', 0, 200], ['saturation', 'Saturación', 0, 200],
        ['shadows', 'Sombras', 0, 200], ['highlights', 'Luces altas', 0, 200],
        ['gamma', 'Gamma', 50, 200], ['denoise', 'Reducción de ruido', 0, 100]
      ];
      fields.forEach(function (f) {
        const row = document.createElement('div');
        row.className = 'pp-row';
        row.innerHTML = '<label>' + f[1] + '</label><input type="range" min="' + f[2] + '" max="' + f[3] + '" value="' + a[f[0]] + '" style="width:150px" /><span class="pp-val">' + a[f[0]] + '</span>';
        const input = row.querySelector('input');
        const val = row.querySelector('.pp-val');
        input.addEventListener('input', function () {
          a[f[0]] = parseInt(input.value, 10);
          val.textContent = input.value;
          applyImageAdjustments();
        });
        body.appendChild(row);
      });
      body.appendChild(UI.switchRow('Tone-mapping HDR → SDR', 'Para pantallas que no soportan HDR', a.toneMapping, function (v) {
        a.toneMapping = v;
        applyImageAdjustments();
      }));
      const reset = document.createElement('button');
      reset.className = 'btn btn-outlined';
      reset.textContent = 'Restablecer a valores por defecto';
      reset.addEventListener('click', function () {
        Object.assign(a, { contrast: 100, brightness: 100, sharpness: 100, saturation: 100, shadows: 100, highlights: 100, gamma: 100, denoise: 0, toneMapping: false });
        Store.dispatch(Store.actions.SET({ imageAdjustments: a }));
        openPanel('image');
        applyImageAdjustments();
      });
      body.appendChild(reset);
    }

    if (kind === 'substyle') {
      title.textContent = 'Ajustes de subtítulos';
      const st = Store.state.subtitleStyle;
      const sizes = [['size', 'Tamaño', 60, 200], ['opacity', 'Opacidad', 0, 100], ['offset', 'Sincronización (ms)', -5000, 5000]];
      sizes.forEach(function (f) {
        const row = document.createElement('div');
        row.className = 'pp-row';
        row.innerHTML = '<label>' + f[1] + '</label><input type="range" min="' + f[2] + '" max="' + f[3] + '" value="' + st[f[0]] + '" style="width:140px" /><span class="pp-val">' + st[f[0]] + '</span>';
        const input = row.querySelector('input');
        const val = row.querySelector('.pp-val');
        input.addEventListener('input', function () {
          st[f[0]] = parseInt(input.value, 10);
          val.textContent = input.value;
          applySubtitleStyle();
        });
        body.appendChild(row);
      });
      const fontRow = document.createElement('div');
      fontRow.className = 'field';
      fontRow.innerHTML = '<span class="field-label">Fuente</span>';
      const sel = document.createElement('select');
      sel.className = 'select';
      ['Roboto', 'Roboto Slab', 'Georgia', 'Verdana', 'Monospace'].forEach(function (f) {
        const o = document.createElement('option');
        o.value = f; o.textContent = f;
        if (st.font === f) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () { st.font = sel.value; applySubtitleStyle(); });
      fontRow.appendChild(sel);
      body.appendChild(fontRow);

      const colRow = document.createElement('div');
      colRow.className = 'pp-row';
      colRow.innerHTML = '<label>Color</label><input type="color" value="' + st.color + '" style="width:56px;height:34px;border:0;background:none" /><label style="flex:0">Fondo</label><input type="color" value="' + st.bg + '" style="width:56px;height:34px;border:0;background:none" />';
      const cols = colRow.querySelectorAll('input[type=color]');
      cols[0].addEventListener('input', function () { st.color = cols[0].value; applySubtitleStyle(); });
      cols[1].addEventListener('input', function () { st.bg = cols[1].value; applySubtitleStyle(); });
      body.appendChild(colRow);

      const posRow = document.createElement('div');
      posRow.className = 'pp-row';
      posRow.innerHTML = '<label>Posición</label>';
      const posSel = document.createElement('select');
      posSel.className = 'select';
      ['bottom', 'top', 'middle'].forEach(function (p) {
        const o = document.createElement('option');
        o.value = p;
        o.textContent = { bottom: 'Abajo', top: 'Arriba', middle: 'Centro' }[p];
        if (st.position === p) o.selected = true;
        posSel.appendChild(o);
      });
      posSel.addEventListener('change', function () { st.position = posSel.value; applySubtitleStyle(); });
      posRow.appendChild(posSel);
      body.appendChild(posRow);
    }

    if (kind === 'sleep') {
      title.textContent = 'Temporizador de suspensión';
      [5, 10, 15, 30, 45, 60, 90].forEach(function (m) {
        body.appendChild(optionRow(m + ' minutos', Store.state.sleepTimer === m, function () {
          Store.dispatch(Store.actions.SET({ sleepTimer: m }));
          clearTimeout(video.timer);
          video.timer = setTimeout(function () {
            video.el.pause();
            toast('El reproductor se pausó por el temporizador.');
            Store.dispatch(Store.actions.SET({ sleepTimer: 0 }));
          }, m * 60000);
          toast('Temporizador de ' + m + ' minutos activado.');
          openPanel('sleep');
        }));
      });
      if (Store.state.sleepTimer) {
        const off = document.createElement('button');
        off.className = 'btn btn-text';
        off.textContent = 'Cancelar temporizador';
        off.addEventListener('click', function () {
          clearTimeout(video.timer);
          Store.dispatch(Store.actions.SET({ sleepTimer: 0 }));
          toast('Temporizador cancelado.');
          openPanel('sleep');
        });
        body.appendChild(off);
      }
    }

    if (kind === 'keys') {
      title.textContent = 'Atajos de teclado';
      const keys = [
        ['Espacio / K', 'Reproducir o pausar'], ['J / L', 'Retroceder 30 s / avanzar 30 s'],
        ['← / →', 'Saltar 10 s'], ['↑ / ↓', 'Volumen'], ['M', 'Silenciar'],
        ['F', 'Pantalla completa'], ['P', 'Picture-in-picture'], ['C', 'Pista de subtítulos'],
        ['A', 'Pista de audio'], ['I', 'Ajustes de imagen'], ['R', 'Repetir desde el inicio'], ['Esc', 'Cerrar reproductor']
      ];
      const tbl = document.createElement('div');
      tbl.className = 'pp-list';
      keys.forEach(function (k) {
        const r = document.createElement('div');
        r.className = 'pp-opt';
        r.innerHTML = '<span class="pp-opt-tx"><b>' + k[0] + '</b><span>' + k[1] + '</span></span>';
        tbl.appendChild(r);
      });
      body.appendChild(tbl);
    }

    if (kind === 'cast') {
      title.textContent = 'Dispositivos en la red local';
      ['Escritorio — Chrome (1080p)', 'TV del salón — Fire TV', 'Auriculares Bluetooth', 'ChromeCast Ultra'].forEach(function (d, i) {
        body.appendChild(optionRow(d, false, function () { toast('Transmitiendo a: ' + d); }));
      });
    }

    panel.hidden = false;
  }

  function optionRow(label, selected, onClick, isSelected) {
    const r = document.createElement('div');
    r.className = 'pp-opt' + ((isSelected !== undefined ? isSelected : selected) ? ' sel' : '');
    r.innerHTML = '<span class="pp-opt-tx"><b></b><span></span></span>';
    r.querySelector('b').textContent = label;
    r.addEventListener('click', function () { onClick(); });
    return r;
  }

  function applyImageAdjustments() {
    if (!video.el) return;
    const a = Store.state.imageAdjustments;
    const f = 'brightness(' + (a.brightness / 100) + ') contrast(' + (a.contrast / 100) + ') saturate(' + (a.saturation / 100) + ')';
    video.el.style.filter = f + (a.toneMapping ? ' sepia(.08)' : '');
  }

  function applySubtitleStyle() {
    const st = Store.state.subtitleStyle;
    const el = $('#subOverlay');
    el.style.fontSize = (st.size / 100) * 1.6 + 'rem';
    el.style.color = st.color;
    el.style.background = st.bg;
    el.style.opacity = st.opacity / 100;
    el.style.fontFamily = "'" + st.font + "', sans-serif";
    el.style.bottom = st.position === 'bottom' ? '118px' : (st.position === 'top' ? 'auto' : '50%');
    el.style.top = st.position === 'top' ? '90px' : (st.position === 'middle' ? '50%' : 'auto');
  }

  function showSubtitleSample(lang) {
    const el = $('#subOverlay');
    el.textContent = '[' + lang + '] Ejemplo de subtítulo sincronizado';
    el.hidden = false;
    setTimeout(function () { if (el.textContent.indexOf('Ejemplo') === 0) el.hidden = true; }, 3500);
  }

  /* ===================== MUSIC MINI PLAYER ===================== */
  const music = { queue: [], index: 0, playing: false, timer: null, position: 0, duration: 0, el: null };

  function initMusic() {
    music.el = $('#mpSeek');
    music.audio = $('#audioEl');
    if (music.audio) {
      music.audio.volume = (Store.state.volume || 70) / 100;
      music.audio.addEventListener('timeupdate', function () {
        if (!music.audio.duration || isNaN(music.audio.duration)) return;
        music.position = music.audio.currentTime;
        music.duration = music.audio.duration;
        updateMusicUI();
      });
      music.audio.addEventListener('ended', function () {
        if (Store.state.repeatMode === 'one') { music.audio.currentTime = 0; music.audio.play(); return; }
        playQueueStep(1);
      });
      music.audio.addEventListener('play', function () { music.playing = true; $('#mpPlay').innerHTML = Icons.svg('pause', 20); });
      music.audio.addEventListener('pause', function () { music.playing = false; $('#mpPlay').innerHTML = Icons.svg('play', 20); });
      music.audio.addEventListener('error', function () {
        /* fall back to the simulated timeline when the source cannot be decoded */
        music.audioFailed = true;
      });
    }
    $('#mpPlay').addEventListener('click', toggleMusic);
    $('#mpNext').addEventListener('click', function () { playQueueStep(1); });
    $('#mpPrev').addEventListener('click', function () { playQueueStep(-1); });
    $('#mpShuffle').addEventListener('click', function () {
      Store.dispatch(Store.actions.SET({ shuffle: !Store.state.shuffle }));
      $('#mpShuffle').classList.toggle('active', Store.state.shuffle);
      toast('Aleatorio inteligente ' + (Store.state.shuffle ? 'activado' : 'desactivado'), 'info');
    });
    $('#mpRepeat').addEventListener('click', function () {
      const order = ['off', 'all', 'one'];
      const next = order[(order.indexOf(Store.state.repeatMode) + 1) % 3];
      Store.dispatch(Store.actions.SET({ repeatMode: next }));
      $('#mpRepeat').classList.toggle('active', next !== 'off');
      toast('Repetición: ' + ({ off: 'desactivada', all: 'toda la cola', one: 'pista actual' })[next], 'info');
    });
    $('#mpVol').addEventListener('input', function (e) {
      if (music.audio) music.audio.volume = e.target.value / 100;
      Store.dispatch(Store.actions.SET({ volume: e.target.value }));
    });
    music.el.addEventListener('input', function (e) {
      if (music.duration) {
        music.position = (e.target.value / 100) * music.duration;
        if (music.audio && music.audio.duration) music.audio.currentTime = music.position;
        updateMusicUI();
      }
    });
    $('#mpQueueBtn').addEventListener('click', openQueuePanel);
    $('#mpEqBtn').addEventListener('click', openEqPanel);
  }

  function playTracks(tracks, startIndex) {
    music.queue = tracks.slice();
    music.index = startIndex || 0;
    playQueueStep(0);
  }

  function playQueueStep(delta) {
    if (!music.queue.length) return;
    if (delta === 0 && music.index >= music.queue.length) music.index = 0;
    music.index = (music.index + delta + music.queue.length) % music.queue.length;
    const t = music.queue[music.index];
    if (!t) return;
    Store.dispatch(Store.actions.PLAY_TRACK(t.id));
    $('#miniPlayer').hidden = false;
    document.body.classList.add('has-mini');
    $('#mpTitle').textContent = t.title;
    $('#mpArtist').textContent = t.artistName + ' · ' + t.albumTitle;
    $('#mpArt').style.backgroundImage = 'url(' + (t.cover || '') + ')';
    music.position = 0;
    music.duration = t.duration || 240;
    music.playing = true;
    $('#mpPlay').innerHTML = Icons.svg('pause', 20);
    if (music.audio && t.source) {
      music.audio.src = t.source;
      music.audio.volume = (Store.state.volume || 70) / 100;
      music.audio.play().catch(function () { /* autoplay may be blocked until a user gesture */ });
    }
    startMusicTimer();
    if (Store.state.visualizer) startVisualizer();
    renderTrackRows();
  }

  function toggleMusic() {
    music.playing = !music.playing;
    $('#mpPlay').innerHTML = Icons.svg(music.playing ? 'pause' : 'play', 20);
    if (music.audio && music.audio.src) {
      if (music.playing) music.audio.play().catch(function () {});
      else music.audio.pause();
    }
    if (music.playing) startMusicTimer(); else clearInterval(music.timer);
  }

  function startMusicTimer() {
    clearInterval(music.timer);
    music.timer = setInterval(function () {
      if (!music.playing) return;
      /* the audio element is the source of truth when it is playing */
      if (music.audio && !music.audio.paused && !music.audio.ended && music.audio.duration) return;
      music.position += 1;
      if (music.position >= music.duration) {
        if (Store.state.repeatMode === 'one') music.position = 0;
        else { playQueueStep(1); return; }
      }
      updateMusicUI();
    }, 1000);
  }

  function updateMusicUI() {
    const pct = music.duration ? (music.position / music.duration) * 100 : 0;
    music.el.value = pct;
    $('#mpTime').textContent = UI.formatDuration(music.position);
    $('#mpDur').textContent = UI.formatDuration(music.duration);
  }

  function renderTrackRows() {
    const rows = document.querySelectorAll('[data-track]');
    rows.forEach(function (r) {
      const id = r.getAttribute('data-track');
      const playing = music.queue[music.index] && music.queue[music.index].id === id;
      r.classList.toggle('playing', !!playing);
    });
  }

  function openQueuePanel() {
    const body = document.createElement('div');
    body.innerHTML = '<div class="hint" style="margin-bottom:10px">Arrastra para reordenar la cola de reproducción.</div>';
    const list = document.createElement('div');
    list.className = 'track-list';
    list.draggable = false;
    music.queue.forEach(function (t, i) {
      const row = document.createElement('div');
      row.className = 'track-row' + (i === music.index ? ' playing' : '');
      row.draggable = true;
      row.innerHTML = '<div class="track-idx">' + (i + 1) + '</div>' +
        '<div><div class="track-name">' + UI.escapeHtml(t.title) + '</div><div class="track-artist">' + UI.escapeHtml(t.artistName) + '</div></div>' +
        '<div class="track-artist">' + UI.formatDuration(t.duration) + '</div>' +
        '<button class="icon-btn sm" data-q="' + i + '">' + Icons.svg('close', 18) + '</button>';
      row.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        music.index = i; playQueueStep(0);
      });
      row.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', String(i)); });
      row.addEventListener('dragover', function (e) { e.preventDefault(); row.style.background = 'var(--md-sys-color-primary-container)'; });
      row.addEventListener('dragleave', function () { row.style.background = ''; });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        row.style.background = '';
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const to = i;
        const item = music.queue.splice(from, 1)[0];
        music.queue.splice(to, 0, item);
        music.index = to;
        openQueuePanel();
      });
      list.appendChild(row);
    });
    body.appendChild(list);
    UI.openDialog({ title: 'Cola de reproducción', body: body.innerHTML, onOpen: function (b) { b.innerHTML = body.innerHTML; }, actions: [
      { label: 'Cerrar', variant: 'text' },
      { label: 'Limpiar cola', variant: 'outlined', onClick: function () { music.queue = []; music.playing = false; $('#miniPlayer').hidden = true; document.body.classList.remove('has-mini'); toast('Cola vaciada.', 'info'); } }
    ] });
    UI.$$('.dialog-scrim [data-q]', document).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        const i = parseInt(b.getAttribute('data-q'), 10);
        music.queue.splice(i, 1);
        if (music.index >= music.queue.length) music.index = Math.max(0, music.queue.length - 1);
        openQueuePanel();
      });
    });
  }

  function openEqPanel() {
    const eq = Store.state.equalizer;
    const body = document.createElement('div');
    body.innerHTML =
      '<div class="chips" style="margin-bottom:14px">' +
      ['Flat', 'Rock', 'Pop', 'Jazz', 'Classical', 'Bass boost'].map(function (p) {
        return '<button class="chip ' + (eq.preset === p ? 'selected' : '') + '" data-eq="' + p + '">' + p + '</button>';
      }).join('') + '</div>' +
      '<div style="display:flex;gap:6px;align-items:flex-end;height:130px">' +
      eq.gains.map(function (g, i) {
        return '<div style="flex:1;text-align:center"><input type="range" min="-12" max="12" value="' + g + '" data-band="' + i + '" style="width:100%;height:100px;writing-mode:vertical-lr;direction:rtl" /><div class="hint" style="font-size:.6rem">' + (i * 2 + 3) + 'K</div></div>';
      }).join('') + '</div>';
    UI.openDialog({
      title: 'Ecualizador gráfico',
      body: body.innerHTML,
      onOpen: function (b) {
        b.innerHTML = body.innerHTML;
        UI.$$('[data-eq]', b).forEach(function (btn) {
          btn.addEventListener('click', function () {
            eq.preset = btn.getAttribute('data-eq');
            eq.enabled = true;
            applyPreset(eq);
            Store.dispatch(Store.actions.SET({ equalizer: eq }));
            openEqPanel();
          });
        });
        UI.$$('[data-band]', b).forEach(function (inp) {
          inp.addEventListener('input', function () {
            eq.gains[parseInt(inp.getAttribute('data-band'), 10)] = parseInt(inp.value, 10);
            eq.enabled = true;
            eq.preset = 'Manual';
            Store.dispatch(Store.actions.SET({ equalizer: eq }));
          });
        });
      },
      actions: [{ label: 'Cerrar', variant: 'filled' }]
    });
  }

  function applyPreset(eq) {
    const presets = {
      Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      Rock: [6, 4, 1, -2, -3, 0, 4, 6, 6, 5],
      Pop: [-2, 2, 5, 6, 4, 1, -1, -1, 1, 2],
      Jazz: [3, 2, 1, 2, -1, -1, 0, 2, 3, 4],
      Classical: [4, 3, 1, 0, -1, -1, 0, 2, 3, 4],
      'Bass boost': [9, 7, 4, 1, 0, 0, 0, 0, 0, 0]
    };
    eq.gains = (presets[eq.preset] || presets.Flat).slice();
  }

  /* --- visualizer --- */
  let vizTimer = null;
  function startVisualizer() {
    const box = $('#visualizerBox');
    if (!box) return;
    box.hidden = false;
    const bars = box.querySelectorAll('i');
    clearInterval(vizTimer);
    vizTimer = setInterval(function () {
      bars.forEach(function (b) {
        b.style.height = (20 + Math.random() * 80) + '%';
      });
    }, 120);
  }

  global.Player = {
    initVideo: initVideo,
    initSkipButtons: initSkipButtons,
    initMusic: initMusic,
    openVideo: openVideo,
    closeVideo: closeVideo,
    playTracks: playTracks,
    startVisualizer: startVisualizer,
    music: music,
    toggleMusic: toggleMusic,
    currentMusicId: function () { return music.queue[music.index] ? music.queue[music.index].id : null; }
  };
})(window);
