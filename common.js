// ============================================================
// PULSELINE — shared helpers used by both admin.html and join.html
// ============================================================

const Pulseline = (() => {

  // ---------- firebase ----------
  function initFirebase(){
    if (!window.FIREBASE_CONFIG || window.FIREBASE_CONFIG.apiKey === "YOUR_API_KEY"){
      showConfigWarning();
      return null;
    }
    if (!firebase.apps.length){
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    return firebase.database();
  }

  function showConfigWarning(){
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:#0B0E14;color:#EAECF3;display:flex;align-items:center;justify-content:center;padding:24px;z-index:9999;font-family:Inter,sans-serif;text-align:center;';
    el.innerHTML = `<div style="max-width:480px">
      <h2 style="font-family:'Space Grotesk',sans-serif;margin-bottom:12px;">Firebase not configured</h2>
      <p style="color:#8C93A6;line-height:1.6;">Open <code>firebase-config.js</code> and paste in your own Firebase project keys.
      See README.md for step-by-step setup (takes about 3 minutes, free tier is enough).</p>
    </div>`;
    document.body.appendChild(el);
  }

  // ---------- ids ----------
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  function genSessionCode(len = 5){
    let s = '';
    for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return s;
  }
  function genId(){
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // ---------- colors from name (fallback avatar) ----------
  const PALETTE = ['#7B61FF','#FF4D6D','#7CFF6B','#FFC24D','#4DD3FF','#FF7BE5'];
  function colorFromString(str){
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return PALETTE[Math.abs(hash) % PALETTE.length];
  }
  function initialsFromName(name){
    return (name || '?').trim().split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase();
  }

  // ---------- pfp file -> resized base64 jpeg ----------
  function resizeImageFile(file, size = 96){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Could not decode image'));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          // cover-crop to square
          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale, h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------- render an avatar chip element ----------
  function renderChip(participant, { showName = false, isMe = false } = {}){
    const el = document.createElement('div');
    el.className = 'chip' + (isMe ? ' me' : '');
    el.dataset.pid = participant.id;
    if (participant.pfp){
      el.style.backgroundImage = `url(${participant.pfp})`;
    } else {
      el.style.background = colorFromString(participant.name || participant.id);
      el.textContent = initialsFromName(participant.name);
    }
    if (showName){
      const tag = document.createElement('div');
      tag.className = 'name-tag';
      tag.textContent = participant.name || '';
      el.appendChild(tag);
    }
    return el;
  }

  // ---------- FLIP animation: smoothly slide `el` when it's moved to `newParent` ----------
  function moveWithFlip(el, newParent){
    const first = el.getBoundingClientRect();
    newParent.appendChild(el);
    const last = el.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (dx === 0 && dy === 0) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    // force reflow then animate to final position
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.55s cubic-bezier(.22,1,.36,1)';
        el.style.transform = '';
      });
    });
  }

  // ---------- local storage helpers ----------
  function lsGet(key, fallback = null){
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function lsSet(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function toast(msg){
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  function escapeHtml(str){
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  return {
    initFirebase, genSessionCode, genId, colorFromString, initialsFromName,
    resizeImageFile, renderChip, moveWithFlip, lsGet, lsSet, toast, escapeHtml
  };
})();
