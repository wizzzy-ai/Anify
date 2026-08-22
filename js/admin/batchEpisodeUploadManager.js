(function (global) {
  'use strict';

  const MAX_RETRIES = 3;
  const STORAGE_KEY = 'anify-r2-multipart-sessions-v1';

  const state = { tasks: [], running: 0, paused: false, concurrency: 4, timer: null, nextBatchOrder: 1 };
  const $ = (id) => document.getElementById(id);
  const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(bytes > 1024 * 1024 * 1024 ? 0 : 1)} ${bytes > 1024 * 1024 * 1024 ? 'GB' : 'MB'}`;
  const isVideoFile = (file) => String(file?.type || '').startsWith('video/') || /\.(mp4|webm|mkv|mov|avi)$/i.test(String(file?.name || ''));

  function token() { return typeof global.getAuthToken === 'function' ? global.getAuthToken() : null; }
  async function api(path, body) {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }
  function detectEpisode(name) {
    const base = String(name).replace(/\.[^.]+$/, '');
    // Supports S01E01, Episode 01, Ep-01, a plain "01", and common
    // release names such as Anime_Title_-_01_720p_Subbed.mp4.
    const match = base.match(/\bS\d{1,2}E(\d{1,3})\b/i)
      || base.match(/(?:episode|ep)[\s._-]*(\d{1,3})\b/i)
      || base.match(/(?:^|[\s._-])(\d{1,3})(?=[\s._-]|$)/)
      || base.match(/^\s*(\d{1,3})\s*$/);
    return match ? Number(match[1]) : null;
  }
  function sessions() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } }
  function saveSession(task) {
    const all = sessions();
    all[task.sessionKey] = { name: task.file.name, size: task.file.size, episode: task.episode, key: task.key, uploadId: task.uploadId, partSize: task.partSize, parts: task.parts };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
  function clearSession(task) { const all = sessions(); delete all[task.sessionKey]; localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); }
  function taskStatus(task) {
    if (task.status === 'uploading') return `⬆️ Uploading ${Math.round(task.progress)}%`;
    return ({ waiting: '⏳ Waiting', needs_episode: '⚠️ Episode number required', duplicate: `⚠️ Duplicate Episode ${task.episode}`, paused: '⏸ Paused', processing: '⚙️ Processing', completed: '✅ Completed', failed: `❌ ${task.error || 'Failed'}`, conflict: '⚠️ Episode already exists', cancelled: '🚫 Cancelled', skipped: '⏭ Skipped' }[task.status] || task.status);
  }
  function render() {
    const list = $('batch-upload-list'); const summary = $('batch-upload-summary'); if (!list || !summary) return;
    // Keep all anime batches in one scheduler, but show an admin only the
    // queue belonging to the anime whose Episode Hub is currently open.
    const visible = state.tasks.map((task, index) => ({ task, index }))
      .filter(({ task }) => String(task.animeId) === String(global.currentHubAnime?.id));
    const tasks = visible.map(({ task }) => task);
    const total = tasks.reduce((n, t) => n + t.file.size, 0);
    const doneBytes = tasks.reduce((n, t) => n + (t.file.size * (t.progress || 0) / 100), 0);
    const completed = tasks.filter(t => t.status === 'completed').length;
    const failed = tasks.filter(t => t.status === 'failed').length;
    const skipped = tasks.filter(t => t.status === 'skipped').length;
    const speed = tasks.reduce((n, t) => n + (t.status === 'uploading' ? (t.speed || 0) : 0), 0);
    const percent = total ? doneBytes / total * 100 : 0;
    const numbered = tasks.filter((task) => Number.isFinite(Number(task.episode))).map((task) => Number(task.episode));
    const sortedLabel = numbered.length ? `✓ Sorted: Episode ${Math.min(...numbered)} → Episode ${Math.max(...numbered)}` : '⚠ Episode numbers required';
    summary.innerHTML = `${tasks.length} episodes for <b>${global.currentHubAnime?.title || 'this anime'}</b> • ${mb(total)} • <b>${completed}/${tasks.length}</b> completed${skipped ? ` • ${skipped} skipped` : ''}${failed ? ` • ${failed} failed` : ''}<br><span class="text-[10px] text-gold-400 font-bold">${sortedLabel}</span><div class="h-2 mt-2 rounded bg-black/10 dark:bg-white/10 overflow-hidden"><div class="h-full bg-gold-400" style="width:${percent}%"></div></div><span class="text-[10px]">${Math.round(percent)}% • ${mb(doneBytes)} uploaded • ${state.running}/${state.concurrency} uploads active globally${speed ? ` • ↑ ${mb(speed)}/s • ETA ${Math.ceil((total - doneBytes) / speed)}s` : ''}</span>`;
    list.innerHTML = visible.map(({ task: t, index: i }) => `<div class="p-3 rounded-xl border border-white/10 bg-black/5 dark:bg-white/5 text-xs">
      <div class="flex justify-between gap-3"><span class="font-bold truncate">🎬 ${t.file.name}</span><span>Ep. <input data-episode="${i}" type="number" min="1" value="${t.episode || ''}" class="w-12 bg-transparent border-b border-gold-400 text-center" ${!['waiting', 'conflict', 'needs_episode'].includes(t.status) ? 'disabled' : ''}></span></div>
      <div class="mt-1 text-[10px] text-gray-500">🍥 ${t.animeTitle || 'Unknown anime'} • Batch ${t.batchOrder}</div>
      <div class="mt-2 h-1.5 rounded bg-black/10 dark:bg-white/10 overflow-hidden"><div class="h-full bg-gold-400" style="width:${t.progress || 0}%"></div></div>
      <div class="mt-1 flex justify-between text-gray-500"><span>${taskStatus(t)}</span><span>${mb(t.file.size)} ${t.speed ? `• ↑ ${mb(t.speed)}/s • ETA ${Math.ceil((t.file.size - t.loaded) / t.speed)}s` : ''}</span></div>
      <div class="mt-2 flex gap-2">${t.status === 'conflict' ? `<button data-replace="${i}" class="text-gold-400">Replace</button><button data-skip="${i}" class="text-gray-400">Skip</button>` : ''}${t.status === 'failed' ? `<button data-retry="${i}" class="text-gold-400">Retry</button>` : ''}${['uploading', 'paused', 'waiting', 'needs_episode', 'duplicate'].includes(t.status) ? `<button data-pause="${i}" class="text-gray-400">${t.status === 'paused' ? 'Resume' : 'Pause'}</button><button data-cancel="${i}" class="text-red-400">Cancel</button>` : ''}</div></div>`).join('');
    list.querySelectorAll('[data-episode]').forEach(el => { el.onchange = () => { const task = state.tasks[el.dataset.episode]; task.episode = Number(el.value) || null; recalculateBatchStatuses(task.batchOrder, task.animeId); sortByEpisode(); render(); }; });
    list.querySelectorAll('[data-replace]').forEach(el => el.onclick = () => { const t = state.tasks[el.dataset.replace]; t.status = 'waiting'; t.replace = true; render(); });
    list.querySelectorAll('[data-skip]').forEach(el => el.onclick = () => { state.tasks[el.dataset.skip].status = 'skipped'; render(); });
    list.querySelectorAll('[data-retry]').forEach(el => el.onclick = () => retry(state.tasks[el.dataset.retry]));
    list.querySelectorAll('[data-pause]').forEach(el => el.onclick = () => togglePause(state.tasks[el.dataset.pause]));
    list.querySelectorAll('[data-cancel]').forEach(el => el.onclick = () => cancel(state.tasks[el.dataset.cancel]));
  }
  function scheduleRender() { if (!state.timer) state.timer = setTimeout(() => { state.timer = null; render(); }, 500); }
  function select(files) {
    const anime = global.currentHubAnime; if (!anime) return;
    const existing = new Set((anime.episodesMedia || []).map(e => Number(e.episodeNumber)));
    const batchOrder = state.nextBatchOrder++;
    const newTasks = [...files].filter(isVideoFile).map((file, fileOrder) => {
      const episode = detectEpisode(file.name);
      return {
        file,
        fileOrder,
        animeId: anime.id,
        animeTitle: anime.title,
        batchOrder,
        existingEpisodes: anime.episodesMedia || [],
        episode,
        status: !episode ? 'needs_episode' : (existing.has(episode) ? 'conflict' : 'waiting'),
        progress: 0, loaded: 0, retries: 0,
        sessionKey: `${anime.id}:${file.name}:${file.size}:${episode}`,
      };
    });
    // The filename detector remains available as a hint, but the episode saved
    // for this batch follows the selected file order. Thus the third selected
    // file is Episode 3 even when its release name contains `_15_`.
    // Sort this newly selected batch by the detected filename number before
    // assigning sequential episode numbers. Example: _17_, _20_, _19_ becomes
    // _17_, _19_, _20_ and is saved as Episodes 1, 2, 3.
    newTasks.sort((a, b) => (a.episode || Number.MAX_SAFE_INTEGER) - (b.episode || Number.MAX_SAFE_INTEGER) || (a.fileOrder - b.fileOrder));
    newTasks.forEach((task, index) => {
      task.detectedEpisode = task.episode;
      task.episode = index + 1;
      task.status = task.existingEpisodes.some((existingEpisode) => Number(existingEpisode.episodeNumber) === task.episode)
        ? 'conflict'
        : 'waiting';
    });
    state.tasks.push(...newTasks);
    recalculateBatchStatuses(batchOrder, anime.id);
    sortByEpisode();
    console.log('[BATCH UPLOAD] Added batch:', { animeTitle: anime.title, files: newTasks.length, batchOrder });
    render();
  }
  function sortByEpisode() {
    // Mutate the actual scheduler array, not just the rendered cards.
    state.tasks.sort((a, b) => (a.batchOrder - b.batchOrder)
      || ((a.season || 1) - (b.season || 1))
      || ((a.episode || Number.MAX_SAFE_INTEGER) - (b.episode || Number.MAX_SAFE_INTEGER))
      || ((a.fileOrder || 0) - (b.fileOrder || 0))
      || a.file.name.localeCompare(b.file.name, undefined, { numeric: true }));
  }
  function recalculateBatchStatuses(batchOrder, animeId) {
    const batch = state.tasks.filter((task) => task.batchOrder === batchOrder && String(task.animeId) === String(animeId));
    const counts = new Map();
    batch.forEach((task) => { if (task.episode) counts.set(task.episode, (counts.get(task.episode) || 0) + 1); });
    batch.forEach((task) => {
      if (['uploading', 'processing', 'completed', 'cancelled', 'skipped'].includes(task.status)) return;
      if (!task.episode) task.status = 'needs_episode';
      else if (counts.get(task.episode) > 1) task.status = 'duplicate';
      else if (task.existingEpisodes?.some((episode) => Number(episode.episodeNumber) === task.episode)) task.status = 'conflict';
      else task.status = 'waiting';
    });
  }
  function autoNumber() {
    const startInput = $('batch-upload-start-episode');
    let nextEpisode = Math.max(1, Number(startInput?.value) || 1);
    const currentAnimeTasks = state.tasks.filter((task) => String(task.animeId) === String(global.currentHubAnime?.id));
    const latestBatch = Math.max(0, ...currentAnimeTasks.map((task) => Number(task.batchOrder) || 0));
    state.tasks
      .filter((task) => String(task.animeId) === String(global.currentHubAnime?.id) && task.batchOrder === latestBatch && task.status === 'needs_episode')
      .sort((a, b) => (a.batchOrder - b.batchOrder) || ((a.fileOrder || 0) - (b.fileOrder || 0)))
      .forEach((task) => {
        task.episode = nextEpisode++;
        const duplicate = (task.existingEpisodes || []).some((episode) => Number(episode.episodeNumber) === task.episode);
        task.status = duplicate ? 'conflict' : 'waiting';
      });
    sortByEpisode();
    render();
  }
  async function upload(task) {
    const anime = { id: task.animeId, episodesMedia: task.existingEpisodes || [] };
    if (!anime.id || !task.episode) throw new Error('Choose a valid episode number.');
    task.status = 'uploading'; task.controller = new AbortController(); scheduleRender();
    const saved = sessions()[task.sessionKey];
    if (saved && saved.name === task.file.name && saved.size === task.file.size) {
      task.key = saved.key; task.uploadId = saved.uploadId; task.partSize = saved.partSize || 50 * 1024 * 1024; task.parts = saved.parts || [];
      const remote = await api('/api/admin/r2-multipart/parts', { key: task.key, uploadId: task.uploadId });
      task.parts = remote.parts.map(p => ({ partNumber: p.partNumber, etag: p.etag }));
    } else {
      const session = await api('/api/admin/r2-multipart/init', { animeId: anime.id, season: 1, episodeNumber: task.episode, filename: task.file.name, mimeType: task.file.type, size: task.file.size });
      Object.assign(task, session, { parts: [] }); saveSession(task);
    }
    const partSize = task.partSize; const count = Math.ceil(task.file.size / partSize); const complete = new Map(task.parts.map(p => [p.partNumber, p]));
    task.loaded = [...complete.values()].reduce((n, p) => n + (p.size || partSize), 0);
    for (let partNumber = 1; partNumber <= count; partNumber++) {
      if (complete.has(partNumber)) continue;
      while (task.paused) { task.status = 'paused'; scheduleRender(); await new Promise(r => setTimeout(r, 300)); }
      task.status = 'uploading'; const start = (partNumber - 1) * partSize; const blob = task.file.slice(start, Math.min(start + partSize, task.file.size));
      const signed = await api('/api/admin/r2-multipart/sign-part', { key: task.key, uploadId: task.uploadId, partNumber, mimeType: task.file.type });
      const before = Date.now(); const response = await fetch(signed.url, { method: 'PUT', body: blob, headers: { 'Content-Type': task.file.type }, signal: task.controller.signal });
      if (!response.ok) throw new Error(`R2 rejected part ${partNumber} (${response.status}).`);
      const etag = response.headers.get('etag'); if (!etag) throw new Error('R2 CORS must expose the ETag response header.');
      task.parts.push({ partNumber, etag }); task.loaded = start + blob.size; task.progress = task.loaded / task.file.size * 100; task.speed = blob.size / Math.max(1, (Date.now() - before) / 1000); saveSession(task); scheduleRender();
    }
    task.status = 'processing'; scheduleRender();
    const completedParts = task.parts.filter((part) => Number(part.partNumber) > 0 && part.etag);
    if (!completedParts.length) throw new Error('No uploaded parts were recorded. Please retry this episode; the upload session was incomplete.');
    const completeResult = await api('/api/admin/r2-multipart/complete', { key: task.key, uploadId: task.uploadId, parts: completedParts });
    // Keep qualities already attached to an episode. The existing API preserves
    // its view counter, while this avoids batch replacement erasing other tracks.
    const currentEpisode = (anime.episodesMedia || []).find((episode) => Number(episode.episodeNumber) === Number(task.episode));
    const payload = {
      sub: { qualities: { ...(currentEpisode?.sub?.qualities || {}), '1080p': completeResult.url }, keys: { '1080p': completeResult.key }, storageProvider: 'r2', sizes: { '1080p': task.file.size }, mimeTypes: { '1080p': task.file.type } },
      dub: { qualities: { ...(currentEpisode?.dub?.qualities || {}) } },
      status: 'Airing',
    };
    const response = await fetch(`/api/anime/${anime.id}/episodes/${task.episode}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({})); if (!response.ok || !data.ok) throw new Error(data.error || 'Episode metadata could not be saved.');
    if (global.updateLocalAnimeData) global.updateLocalAnimeData(data.anime);
    if (String(global.currentHubAnime?.id) === String(task.animeId)) global.currentHubAnime = data.anime;
    task.progress = 100; task.status = 'completed'; clearSession(task); scheduleRender();
  }
  async function run(task) {
    try { await upload(task); }
    catch (error) {
      if (task.cancelled) task.status = 'cancelled';
      else if (task.paused || error.name === 'AbortError') task.status = 'paused';
      else if (task.retries < MAX_RETRIES) {
        task.retries++;
        task.status = 'waiting';
        task.error = `Retry ${task.retries}/${MAX_RETRIES} in ${2 ** task.retries}s`;
        scheduleRender();
        await new Promise(resolve => setTimeout(resolve, (2 ** task.retries) * 1000));
      } else { task.status = 'failed'; task.error = error.message; }
      scheduleRender();
    } finally { state.running--; pump(); }
  }
  function pump() { if (state.paused) return; sortByEpisode(); while (state.running < state.concurrency) { const task = state.tasks.find(t => t.status === 'waiting' && t.episode); if (!task) break; state.running++; run(task); } render(); }
  function start() {
    state.concurrency = Number($('batch-upload-concurrency')?.value) || 4;
    state.paused = false;
    const eligible = state.tasks.filter(task => task.status === 'waiting' && task.episode);
    console.log('[BATCH UPLOAD] Start requested:', { selected: state.tasks.length, eligible: eligible.length, concurrency: state.concurrency });
    if (!state.tasks.length) return alert('Select or drop video files first.');
    if (!eligible.length) return alert('Enter an episode number for each file and choose Replace or Skip for duplicates before uploading.');
    pump();
  }
  function retry(task) { task.status = 'waiting'; task.error = ''; task.retries++; pump(); }
  function togglePause(task) { task.paused = !task.paused; if (task.paused && task.controller) task.controller.abort(); else if (!task.paused) { task.status = 'waiting'; pump(); } render(); }
  async function cancel(task) { task.cancelled = true; task.controller?.abort(); if (task.key && task.uploadId) await api('/api/admin/r2-multipart/abort', { key: task.key, uploadId: task.uploadId }).catch(() => {}); clearSession(task); task.status = 'cancelled'; render(); }
  function init() {
    const input = $('batch-episode-files'); if (!input || input.dataset.bound) return; input.dataset.bound = 'true';
    input.onchange = () => select(input.files); $('batch-upload-start').onclick = start;
    $('batch-upload-auto-number').onclick = autoNumber;
    $('batch-upload-pause-all').onclick = () => {
      state.paused = !state.paused;
      if (state.paused) {
        state.tasks.filter(task => task.status === 'uploading').forEach((task) => { task.paused = true; task.controller?.abort(); });
      } else {
        state.tasks.filter(task => task.status === 'paused').forEach((task) => { task.paused = false; task.status = 'waiting'; });
        pump();
      }
      render();
    };
    const drop = $('batch-upload-drop'); ['dragover', 'dragleave', 'drop'].forEach(type => drop.addEventListener(type, (e) => { e.preventDefault(); if (type === 'drop') select(e.dataTransfer.files); })); render();
  }
  global.initBatchEpisodeUpload = init;
})(window);
