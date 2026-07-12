// ============================================================
// PULSELINE — join.js
// ============================================================
(function(){
  const db = Pulseline.initFirebase();
  if (!db) return;

  const el = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const sessionId = params.get('session');

  const views = ['viewJoin','viewWaiting','viewStage','viewEnded','viewMissing'];
  function showView(name){
    views.forEach(v => el(v).style.display = (v === name) ? '' : 'none');
  }

  if (!sessionId){ showView('viewMissing'); return; }

  const storeKey = 'pulseline_participant_' + sessionId;
  let me = Pulseline.lsGet(storeKey, null); // { id, name, pfp }
  let pendingPfp = null;
  let chipEls = {};
  let lastRenderedIndex = -1;
  let myChoice = null;
  let listenerAttached = false;

  // ---------------- pfp picker ----------------
  el('pfpInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try{
      pendingPfp = await Pulseline.resizeImageFile(file);
      el('pfpPreview').style.backgroundImage = `url(${pendingPfp})`;
      el('pfpPreview').textContent = '';
    } catch(err){
      Pulseline.toast('Could not use that photo — try another');
    }
  });

  el('joinBtn').onclick = async () => {
    const name = el('nameInput').value.trim();
    if (!name){ Pulseline.toast('Enter your name'); return; }
    el('joinBtn').disabled = true;
    const id = Pulseline.genId();
    const participant = { name, pfp: pendingPfp || null, joinedAt: Date.now() };
    try{
      await db.ref(`sessions/${sessionId}/participants/${id}`).set(participant);
      me = { id, ...participant };
      Pulseline.lsSet(storeKey, me);
      if (listenerAttached && lastData){
        // listener is already running (from the initial peek) — just re-render with what we have
        handleData(lastData);
      } else {
        attachSessionListener();
      }
    } catch(err){
      Pulseline.toast('Could not join: ' + err.message);
      el('joinBtn').disabled = false;
    }
  };

  // ---------------- vote casting ----------------
  function castVote(choice, currentIndex){
    if (!me) return;
    myChoice = choice;
    db.ref(`sessions/${sessionId}/votes/${currentIndex}/${me.id}`).set({ choice, ts: Date.now() });
  }

  document.querySelectorAll('#viewStage .zone, #viewStage .side-label').forEach(zoneEl => {
    zoneEl.addEventListener('click', () => {
      if (!lastData) return;
      castVote(zoneEl.dataset.choice, lastData.currentIndex);
    });
  });

  // ---------------- rendering ----------------
  let lastData = null;

  function renderStage(data){
    if (data.currentIndex !== lastRenderedIndex){
      lastRenderedIndex = data.currentIndex;
      myChoice = null; // fresh song, no vote cast client-side yet (server default handled below)
    }
    el('stageIdx').textContent = `SONG ${data.currentIndex + 1} / ${data.songs.length}`;
    const song = data.songs[data.currentIndex] || {};
    el('stageTitle').textContent = song.title || '—';
    el('stageArtist').textContent = song.artist || '';

    const participants = data.participants || {};
    const votes = (data.votes && data.votes[data.currentIndex]) || {};
    const zoneEls = {
      skip: document.querySelector('#viewStage .zone.skip'),
      neutral: document.querySelector('#viewStage .zone.neutral'),
      play: document.querySelector('#viewStage .zone.play'),
    };
    const counts = { skip: 0, neutral: 0, play: 0 };

    Object.keys(participants).forEach(pid => {
      const choice = (votes[pid] && votes[pid].choice) || 'neutral';
      counts[choice]++;
      const p = { id: pid, ...participants[pid] };
      const isMe = me && pid === me.id;
      let chip = chipEls[pid];
      if (!chip){
        chip = Pulseline.renderChip(p, { isMe });
        chipEls[pid] = chip;
        zoneEls[choice].appendChild(chip);
      } else if (chip.parentElement !== zoneEls[choice]){
        Pulseline.moveWithFlip(chip, zoneEls[choice]);
      }
    });
    Object.keys(chipEls).forEach(pid => {
      if (!participants[pid]){ chipEls[pid].remove(); delete chipEls[pid]; }
    });
    // highlight active zone for me
    document.querySelectorAll('#viewStage .zone').forEach(z => z.classList.remove('active-choice'));
    if (me && votes[me.id]) {
      const z = document.querySelector(`#viewStage .zone.${votes[me.id].choice}`);
      if (z) z.classList.add('active-choice');
    }

    Object.keys(counts).forEach(k => {
      document.querySelector(`#viewStage [data-count="${k}"]`).textContent = counts[k];
    });
  }

  function renderWaiting(data){
    const wrap = el('myChipWrap');
    wrap.innerHTML = '';
    if (me) wrap.appendChild(Pulseline.renderChip(me, { showName: true }));
  }

  function handleData(data){
    lastData = data;
    el('joinSessionName').textContent = data.name || '';

    if (!me){
      // not joined yet — allow joining even mid-session (late join)
      showView('viewJoin');
      return;
    }
    if (!data.participants || !data.participants[me.id]){
      // our record vanished (host reset?) — let them rejoin
      me = null; Pulseline.lsSet(storeKey, null);
      showView('viewJoin');
      return;
    }

    if (data.status === 'lobby'){ showView('viewWaiting'); renderWaiting(data); }
    else if (data.status === 'playing'){ showView('viewStage'); renderStage(data); }
    else if (data.status === 'ended'){ showView('viewEnded'); }
  }

  function attachSessionListener(){
    if (listenerAttached) return;
    listenerAttached = true;
    db.ref('sessions/' + sessionId).on('value', (snap) => {
      const data = snap.val();
      if (!data){ showView('viewMissing'); return; }
      handleData(data);
    }, (err) => {
      Pulseline.toast('Connection error: ' + err.message);
    });
  }

  // ---------------- boot ----------------
  // A single live listener drives every screen, whether we've joined yet or
  // not — it needs to react if the host starts the session while someone
  // is mid-way through filling out the join form.
  attachSessionListener();
})();