// ============================================================
// PULSELINE — admin.js
// ============================================================
(function(){
  const db = Pulseline.initFirebase();
  if (!db) return;

  const params = new URLSearchParams(location.search);
  let sessionId = params.get('session');
  let songs = []; // local builder list before creation
  let currentData = null; // last known snapshot of the session
  let chipEls = {}; // participantId -> chip element (stage view)

  const el = (id) => document.getElementById(id);
  const viewCreate = el('viewCreate'), viewControl = el('viewControl'),
        viewStage = el('viewStage'), viewResults = el('viewResults');

  function showView(name){
    viewCreate.style.display = name === 'create' ? '' : 'none';
    viewControl.style.display = name === 'control' ? '' : 'none';
    viewStage.style.display = name === 'stage' ? '' : 'none';
    viewResults.style.display = name === 'results' ? '' : 'none';
  }

  // ---------------- CREATE VIEW ----------------
  function renderSongList(){
    const list = el('songList');
    list.innerHTML = '';
    if (songs.length === 0){
      list.innerHTML = '<div class="empty-state" style="padding:16px;">No songs yet</div>';
      return;
    }
    songs.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'song-list-item';
      row.innerHTML = `
        <span class="num mono">${i+1}</span>
        <div class="info">
          <div class="t">${Pulseline.escapeHtml(s.title)}</div>
          ${s.artist ? `<div class="a">${Pulseline.escapeHtml(s.artist)}</div>` : ''}
        </div>
        <button class="icon-btn" data-up="${i}" title="Move up">↑</button>
        <button class="icon-btn" data-down="${i}" title="Move down">↓</button>
        <button class="icon-btn" data-remove="${i}" title="Remove">✕</button>
      `;
      list.appendChild(row);
    });
    list.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => {
      songs.splice(Number(b.dataset.remove), 1); renderSongList();
    });
    list.querySelectorAll('[data-up]').forEach(b => b.onclick = () => {
      const i = Number(b.dataset.up); if (i > 0){ [songs[i-1], songs[i]] = [songs[i], songs[i-1]]; renderSongList(); }
    });
    list.querySelectorAll('[data-down]').forEach(b => b.onclick = () => {
      const i = Number(b.dataset.down); if (i < songs.length - 1){ [songs[i+1], songs[i]] = [songs[i], songs[i+1]]; renderSongList(); }
    });
  }

  el('addSongBtn').onclick = () => {
    const t = el('songTitle').value.trim();
    const a = el('songArtist').value.trim();
    if (!t){ Pulseline.toast('Enter a song title'); return; }
    songs.push({ title: t, artist: a });
    el('songTitle').value = ''; el('songArtist').value = '';
    el('songTitle').focus();
    renderSongList();
  };
  el('songTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') el('addSongBtn').click(); });
  el('songArtist').addEventListener('keydown', (e) => { if (e.key === 'Enter') el('addSongBtn').click(); });

  el('createBtn').onclick = async () => {
    const name = el('sessionName').value.trim() || 'Untitled session';
    if (songs.length === 0){ Pulseline.toast('Add at least one song first'); return; }
    el('createBtn').disabled = true;
    const id = Pulseline.genSessionCode();
    const payload = {
      name, status: 'lobby', currentIndex: -1, createdAt: Date.now(),
      songs: songs, participants: {}, votes: {}
    };
    try{
      await db.ref('sessions/' + id).set(payload);
      const mine = Pulseline.lsGet('pulseline_admin_sessions', []);
      mine.unshift({ id, name, ts: Date.now() });
      Pulseline.lsSet('pulseline_admin_sessions', mine.slice(0, 20));
      location.search = '?session=' + id;
    } catch(err){
      Pulseline.toast('Could not create session: ' + err.message);
      el('createBtn').disabled = false;
    }
  };

  // ---------------- CONTROL / STAGE / RESULTS ----------------
  function setupJoinLink(id){
    const link = location.origin + location.pathname.replace(/admin\.html$/, 'join.html') + '?session=' + id;
    el('joinLink').value = link;
    el('qrImg').src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(link);
  }
  el('copyLinkBtn').onclick = async () => {
    try{ await navigator.clipboard.writeText(el('joinLink').value); Pulseline.toast('Link copied'); }
    catch(e){ el('joinLink').select(); document.execCommand('copy'); Pulseline.toast('Link copied'); }
  };

  el('startBtn').onclick = () => {
    db.ref('sessions/' + sessionId).update({ status: 'playing', currentIndex: 0 });
  };
  el('prevBtn').onclick = () => {
    if (!currentData) return;
    const idx = Math.max(0, (currentData.currentIndex || 0) - 1);
    db.ref('sessions/' + sessionId + '/currentIndex').set(idx);
  };
  el('nextBtn').onclick = () => {
    if (!currentData) return;
    const idx = (currentData.currentIndex || 0) + 1;
    if (idx >= currentData.songs.length){
      db.ref('sessions/' + sessionId + '/status').set('ended');
    } else {
      db.ref('sessions/' + sessionId + '/currentIndex').set(idx);
    }
  };
  el('endBtn').onclick = () => {
    if (confirm('End this session for everyone?')) db.ref('sessions/' + sessionId + '/status').set('ended');
  };

  function renderLobby(data){
    const grid = el('participantGrid');
    const participants = data.participants || {};
    const ids = Object.keys(participants);
    el('joinCount').textContent = ids.length;
    el('lobbyEmpty').style.display = ids.length ? 'none' : '';
    grid.querySelectorAll('.chip').forEach(c => { if (!participants[c.dataset.pid]) c.remove(); });
    ids.forEach(pid => {
      let chip = grid.querySelector(`.chip[data-pid="${pid}"]`);
      const p = { id: pid, ...participants[pid] };
      if (!chip){
        chip = Pulseline.renderChip(p, { showName: true });
        grid.appendChild(chip);
      }
    });
  }

  function renderStage(data){
    el('stageIdx').textContent = `SONG ${data.currentIndex + 1} / ${data.songs.length}`;
    const song = data.songs[data.currentIndex] || {};
    el('stageTitle').textContent = song.title || '—';
    el('stageArtist').textContent = song.artist || '';
    el('prevBtn').disabled = data.currentIndex <= 0;

    const participants = data.participants || {};
    const votes = (data.votes && data.votes[data.currentIndex]) || {};
    const zoneEls = {
      skip: document.querySelector('#stageZones .zone.skip'),
      neutral: document.querySelector('#stageZones .zone.neutral'),
      play: document.querySelector('#stageZones .zone.play'),
    };
    const counts = { skip: 0, neutral: 0, play: 0 };

    Object.keys(participants).forEach(pid => {
      const choice = (votes[pid] && votes[pid].choice) || 'neutral';
      counts[choice]++;
      const p = { id: pid, ...participants[pid] };
      let chip = chipEls[pid];
      if (!chip){
        chip = Pulseline.renderChip(p);
        chipEls[pid] = chip;
        zoneEls[choice].appendChild(chip);
      } else if (chip.parentElement !== zoneEls[choice]){
        Pulseline.moveWithFlip(chip, zoneEls[choice]);
      }
    });
    // remove chips for participants who left
    Object.keys(chipEls).forEach(pid => {
      if (!participants[pid]){ chipEls[pid].remove(); delete chipEls[pid]; }
    });

    Object.keys(counts).forEach(k => {
      document.querySelector(`[data-count="${k}"]`).textContent = counts[k];
    });
  }

  function renderResults(data){
    const list = el('resultsList');
    list.innerHTML = '';
    const votesAll = data.votes || {};
    data.songs.forEach((song, i) => {
      const votes = votesAll[i] || {};
      const counts = { skip: 0, neutral: 0, play: 0 };
      Object.values(votes).forEach(v => { if (counts[v.choice] !== undefined) counts[v.choice]++; });
      const total = Math.max(1, counts.skip + counts.neutral + counts.play);
      const row = document.createElement('div');
      row.className = 'results-song';
      row.innerHTML = `
        <div class="spread">
          <strong>${Pulseline.escapeHtml(song.title)}</strong>
          <span class="mono" style="color:var(--text-dim); font-size:12px;">${song.artist ? Pulseline.escapeHtml(song.artist) : ''}</span>
        </div>
        <div class="results-bar">
          <div style="width:${counts.skip/total*100}%; background:var(--skip)"></div>
          <div style="width:${counts.neutral/total*100}%; background:var(--neutral)"></div>
          <div style="width:${counts.play/total*100}%; background:var(--play)"></div>
        </div>
        <div class="mono" style="font-size:11px; color:var(--text-dim); margin-top:4px;">
          skip ${counts.skip} · neutral ${counts.neutral} · play ${counts.play}
        </div>
      `;
      list.appendChild(row);
    });
  }

  function updateStatusPill(status){
    const pill = el('statusPill');
    pill.className = 'pill ' + (status === 'playing' ? 'live' : status === 'ended' ? 'ended' : 'lobby');
    pill.textContent = status === 'playing' ? 'LIVE' : status === 'ended' ? 'ENDED' : 'LOBBY';
  }

  function attach(id){
    setupJoinLink(id);
    db.ref('sessions/' + id).on('value', (snap) => {
      const data = snap.val();
      if (!data){ Pulseline.toast('Session not found'); showView('create'); return; }
      currentData = data;
      updateStatusPill(data.status);
      if (data.status === 'lobby'){ showView('control'); renderLobby(data); }
      else if (data.status === 'playing'){ showView('stage'); renderStage(data); }
      else if (data.status === 'ended'){ showView('results'); renderResults(data); }
    }, (err) => {
      Pulseline.toast('Connection error: ' + err.message);
    });
  }

  // ---------------- boot ----------------
  if (sessionId){
    attach(sessionId);
  } else {
    showView('create');
    renderSongList();
  }
})();
