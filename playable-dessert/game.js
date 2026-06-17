/* =========================================================================
   Kayrahan'ın Tatlı Dükkânı — tatlı süsleme (decorate) oyunu
   - Dikey 540x960 canvas, tamamen dokunmayla
   - Krema rengi seç → keke dokunarak süs ekle (çilek, çikolata, şeker, kalp...)
   - "Servis Et" → para kazan → kilitli süsleri aç
   - İlerleme Playables SDK / localStorage ile kalıcı (saveData)
   - Özgün çizim; harici görsel sadece Kayrahan (şef) resmi
   ========================================================================= */
(() => {
  'use strict';

  // --- 1) Playables SDK ---
  const SDK = (() => {
    const hasSDK = typeof window.ytgame !== 'undefined' && !window.__noPlayablesSDK;
    return {
      hasSDK,
      firstFrameReady() { try { if (hasSDK) ytgame.game.firstFrameReady(); } catch (e) {} },
      gameReady()       { try { if (hasSDK) ytgame.game.gameReady(); } catch (e) {} },
      onPause(fn)       { try { if (hasSDK) ytgame.system.onPause(fn); } catch (e) {} },
      onResume(fn)      { try { if (hasSDK) ytgame.system.onResume(fn); } catch (e) {} },
      audioEnabled()    { try { return hasSDK ? ytgame.system.isAudioEnabled() : true; } catch (e) { return true; } },
      onAudioEnabledChange(fn) { try { if (hasSDK) ytgame.system.onAudioEnabledChange(fn); } catch (e) {} },
      sendScore(v)      { try { if (hasSDK) ytgame.engagement.sendScore({ value: v }); } catch (e) {} },
      // Hem SDK (YouTube bulut) hem localStorage'a yaz → her ortamda kalıcı.
      saveData(o) {
        const s = JSON.stringify(o);
        try { if (hasSDK) ytgame.game.saveData(s); } catch (e) {}
        try { localStorage.setItem('kayrahan_tatli', s); } catch (e) {}
      },
      async loadData() {
        try { if (hasSDK) { const s = await ytgame.game.loadData(); if (s) return JSON.parse(s); } } catch (e) {}
        try { const s = localStorage.getItem('kayrahan_tatli'); if (s) return JSON.parse(s); } catch (e) {}
        return null;
      },
    };
  })();

  // --- 2) Ses + haptik ---
  const Sound = (() => {
    let ac = null, muted = false;
    function ensure() { if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) ac = new A(); } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
    function tone(type, f, dur, vol, fTo) {
      if (muted) return; const a = ensure(); if (!a) return;
      const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (fTo) o.frequency.exponentialRampToValueAtTime(fTo, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
    }
    return {
      unlock() { ensure(); }, setMuted(m) { muted = m; },
      pop()  { tone('triangle', 700, 0.06, 0.14, 1000); },
      pick() { tone('sine', 520, 0.05, 0.12, 680); },
      serve(){ [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone('triangle', f, 0.14, 0.18), i * 90)); },
      buy()  { [659, 988].forEach((f, i) => setTimeout(() => tone('triangle', f, 0.12, 0.18), i * 90)); },
      nope() { tone('sawtooth', 200, 0.16, 0.13, 150); },
    };
  })();
  const Haptics = (() => {
    const ok = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    let on = true;
    return { setEnabled(v) { on = v; }, buzz(p) { if (ok && on) { try { navigator.vibrate(p); } catch (e) {} } } };
  })();

  // --- 3) Canvas ---
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  function resize() { const s = Math.min(window.innerWidth / W, window.innerHeight / H); canvas.style.width = Math.floor(W * s) + 'px'; canvas.style.height = Math.floor(H * s) + 'px'; }
  addEventListener('resize', resize); resize();

  const hero = new Image(); let heroLoaded = false; hero.onload = () => { heroLoaded = true; }; hero.src = 'assets/hero.png';

  // --- 4) İçerik tanımı ---
  // Kek merkezi ve süs yerleştirme bölgesi (krema kubbesi)
  const CAKE = { cx: 270, top: 250, plateY: 470 };
  const FROST = { cx: 270, cy: 360, rx: 130, ry: 92 };   // süs yerleştirme elipsi

  const COLORS = [
    { id: 'pink',   c: '#ff8fb3' },
    { id: 'choco',  c: '#7a4a2b' },
    { id: 'vanilla',c: '#ffe6a8' },
    { id: 'mint',   c: '#9be3c4' },
    { id: 'blue',   c: '#9ec9ff' },
  ];

  // free:true → açık; değilse price ile kilitli
  const TOPPINGS = [
    { id: 'strawberry', free: true },
    { id: 'choco',      free: true },
    { id: 'sprinkle',   free: true },
    { id: 'heart',      free: true },
    { id: 'cherry',     price: 15 },
    { id: 'star',       price: 30 },
  ];

  // --- 5) Durum ---
  let coins = 0;
  let served = 0;
  let unlocked = { strawberry: true, choco: true, sprinkle: true, heart: true };
  let soundOn = true, hapticsOn = true;
  let frosting = '#ff8fb3';     // seçili krema rengi
  let tool = 'strawberry';      // seçili süs
  let placed = [];              // [{type,x,y,rot,col}]
  let confetti = [];
  let toast = null, toastFx = 0;
  let serveFlash = 0;           // servis kutlama animasyonu
  let tms = 0;                  // zaman
  let firstFrameSent = false;

  function applyAudio() { Sound.setMuted(!soundOn || !SDK.audioEnabled()); }
  function save() { SDK.saveData({ coins, served, unlocked, soundOn, hapticsOn }); }
  function showToast(txt) { toast = txt; toastFx = 90; }

  // --- 6) Tıklanabilir bölgeler ---
  const soundBtn  = { x: W - 58,  y: 16, w: 46, h: 46 };
  const hapticBtn = { x: W - 112, y: 16, w: 46, h: 46 };
  const serveBtn  = { x: W / 2 - 150, y: 770, w: 300, h: 74 };
  const clearBtn  = { x: W - 76, y: 700, w: 60, h: 56 };
  function colorRect(i) { const sw = 58, gap = 14, total = COLORS.length * sw + (COLORS.length - 1) * gap; const x0 = (W - total) / 2; return { x: x0 + i * (sw + gap), y: 520, w: sw, h: 58 }; }
  function topRect(i)   { const sw = 70, gap = 12, total = TOPPINGS.length * sw + (TOPPINGS.length - 1) * gap; const x0 = (W - total) / 2; return { x: x0 + i * (sw + gap), y: 612, w: sw, h: 70 }; }

  // --- 7) Girdi ---
  function cpoint(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; }
  const inBox = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  const inFrost = (p) => ((p.x - FROST.cx) ** 2) / (FROST.rx ** 2) + ((p.y - FROST.cy) ** 2) / (FROST.ry ** 2) <= 1;

  function selectTopping(it) {
    if (it.free || unlocked[it.id]) { tool = it.id; Sound.pick(); Haptics.buzz(8); return; }
    // kilitli → satın al
    if (coins >= it.price) { coins -= it.price; unlocked[it.id] = true; tool = it.id; Sound.buy(); Haptics.buzz([15, 30, 15]); showToast('Yeni süs açıldı!'); save(); }
    else { Sound.nope(); Haptics.buzz(30); showToast(it.price + ' 🪙 gerekli'); }
  }

  function placeTopping(p) {
    if (placed.length >= 60) return;
    if (tool === 'sprinkle') {
      for (let i = 0; i < 6; i++) placed.push({ type: 'sprinkle', x: p.x + (Math.random() * 30 - 15), y: p.y + (Math.random() * 20 - 10), rot: Math.random() * 6, col: ['#ff5d73', '#ffd23f', '#5fd068', '#7c5cff', '#5ec5ff'][i % 5] });
    } else {
      placed.push({ type: tool, x: p.x, y: p.y, rot: Math.random() * 0.6 - 0.3 });
    }
    Sound.pop(); Haptics.buzz(8);
  }

  function serve() {
    if (placed.length === 0) { showToast('Önce süsle!'); Sound.nope(); return; }
    const reward = 5 + Math.min(20, placed.length);
    coins += reward; served++;
    Sound.serve(); Haptics.buzz([20, 40, 20]);
    showToast('Mükemmel!  +' + reward + ' 🪙');
    serveFlash = 60;
    for (let i = 0; i < 40; i++) confetti.push({ x: 270 + (Math.random() * 200 - 100), y: 340, vx: (Math.random() * 6 - 3), vy: -(2 + Math.random() * 6), life: 1, decay: 0.012 + Math.random() * 0.01, c: ['#ff5d73', '#ffd23f', '#5fd068', '#7c5cff', '#5ec5ff', '#ff8fb3'][i % 6], r: 4 + Math.random() * 4 });
    SDK.sendScore(served);
    save();
    setTimeout(() => { placed = []; }, 650);  // kısa kutlamadan sonra yeni kek
  }

  canvas.addEventListener('pointerdown', (e) => {
    Sound.unlock(); applyAudio();
    const p = cpoint(e);
    if (inBox(p, soundBtn))  { soundOn = !soundOn; applyAudio(); Haptics.buzz(10); save(); return; }
    if (inBox(p, hapticBtn)) { hapticsOn = !hapticsOn; Haptics.setEnabled(hapticsOn); if (hapticsOn) Haptics.buzz(20); save(); return; }
    if (inBox(p, serveBtn))  { serve(); return; }
    if (inBox(p, clearBtn))  { if (placed.length) { placed = []; Sound.pick(); } return; }
    for (let i = 0; i < COLORS.length; i++) if (inBox(p, colorRect(i))) { frosting = COLORS[i].c; Sound.pick(); Haptics.buzz(8); return; }
    for (let i = 0; i < TOPPINGS.length; i++) if (inBox(p, topRect(i))) { selectTopping(TOPPINGS[i]); return; }
    if (inFrost(p)) placeTopping(p);
  });

  // sürükleyerek de süs serpebilmek için (basılıyken hareket)
  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => { const p = cpoint(e); dragging = inFrost(p); });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; const p = cpoint(e); if (inFrost(p) && tms % 3 === 0) placeTopping(p); });
  addEventListener('pointerup', () => { dragging = false; });

  // --- 8) Güncelleme ---
  function update() {
    tms++;
    if (toastFx > 0) toastFx--;
    if (serveFlash > 0) serveFlash--;
    for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.x += c.vx; c.y += c.vy; c.vy += 0.18; c.life -= c.decay; if (c.life <= 0) confetti.splice(i, 1); }
  }

  // --- 9) Çizim ---
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function drawTopping(type, x, y, rot, col) {
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    switch (type) {
      case 'strawberry':
        ctx.fillStyle = '#ff3b5c'; ctx.beginPath(); ctx.moveTo(0, 16); ctx.quadraticCurveTo(-14, 2, -10, -8); ctx.quadraticCurveTo(0, -14, 10, -8); ctx.quadraticCurveTo(14, 2, 0, 16); ctx.fill();
        ctx.fillStyle = '#3fa34d'; ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(0, -16); ctx.lineTo(8, -8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffe06a'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc((i % 2 ? 4 : -4), -2 + i * 4, 1.2, 0, 7); ctx.fill(); }
        break;
      case 'choco':
        ctx.fillStyle = '#4e2e16'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 7, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#6b3f1f'; ctx.beginPath(); ctx.ellipse(-2, -2, 4, 3, 0, 0, 7); ctx.fill();
        break;
      case 'cherry':
        ctx.strokeStyle = '#6b3f1f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(6, -6, 8, 2); ctx.moveTo(0, -14); ctx.quadraticCurveTo(-6, -6, -8, 2); ctx.stroke();
        ctx.fillStyle = '#e01e3c'; ctx.beginPath(); ctx.arc(-8, 6, 7, 0, 7); ctx.arc(8, 6, 7, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-10, 3, 2, 0, 7); ctx.arc(6, 3, 2, 0, 7); ctx.fill();
        break;
      case 'heart':
        ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-12, -2, -7, -12, 0, -5); ctx.bezierCurveTo(7, -12, 12, -2, 0, 9); ctx.fill();
        break;
      case 'star':
        ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#ffab00'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? 5 : 11, a = -Math.PI / 2 + i * Math.PI / 5; const px = Math.cos(a) * r, py = Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case 'sprinkle':
        ctx.fillStyle = col || '#ff5d73'; roundRect(-5, -2, 10, 4, 2); ctx.fill();
        break;
    }
    ctx.restore();
  }

  function drawCake() {
    const cx = CAKE.cx;
    // Tabak
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(cx, CAKE.plateY, 170, 34, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e7e7ef'; ctx.beginPath(); ctx.ellipse(cx, CAKE.plateY + 8, 150, 24, 0, 0, 7); ctx.fill();
    // Kek kalıbı (wrapper)
    ctx.fillStyle = '#e6a23c';
    ctx.beginPath(); ctx.moveTo(cx - 92, 410); ctx.lineTo(cx + 92, 410); ctx.lineTo(cx + 74, CAKE.plateY - 4); ctx.lineTo(cx - 74, CAKE.plateY - 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = -3; i <= 3; i++) { ctx.fillRect(cx + i * 24 - 3, 410, 6, 96); }
    // Krema (seçili renk) — kubbe
    ctx.fillStyle = frosting;
    ctx.beginPath(); ctx.moveTo(cx - 104, 414);
    ctx.quadraticCurveTo(cx - 120, 320, cx - 50, 300);
    ctx.quadraticCurveTo(cx, 250, cx + 50, 300);
    ctx.quadraticCurveTo(cx + 120, 320, cx + 104, 414);
    ctx.closePath(); ctx.fill();
    // Krema parlaması
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.ellipse(cx - 30, 330, 40, 22, -0.4, 0, 7); ctx.fill();
    // tepe sürahi
    ctx.fillStyle = frosting; ctx.beginPath(); ctx.arc(cx, 286, 16, 0, 7); ctx.fill();
  }

  function drawConfetti() { for (const c of confetti) { ctx.globalAlpha = Math.max(0, c.life); ctx.fillStyle = c.c; ctx.fillRect(c.x, c.y, c.r, c.r); } ctx.globalAlpha = 1; }

  function drawToggle(b, icon, isOn) {
    ctx.fillStyle = isOn ? 'rgba(120,60,90,0.5)' : 'rgba(120,60,90,0.3)'; roundRect(b.x, b.y, b.w, b.h, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; roundRect(b.x, b.y, b.w, b.h, 12); ctx.stroke();
    ctx.globalAlpha = isOn ? 1 : 0.5; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '26px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(icon, b.x + b.w / 2, b.y + b.h / 2 + 1); ctx.globalAlpha = 1;
    if (!isOn) { ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x + 10, b.y + 10); ctx.lineTo(b.x + b.w - 10, b.y + b.h - 10); ctx.stroke(); }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  function iconForTopping(id) { return { strawberry: '🍓', choco: '🍫', sprinkle: '🌈', heart: '❤️', cherry: '🍒', star: '⭐' }[id]; }

  function drawPalettes() {
    // Krema renkleri
    ctx.fillStyle = 'rgba(0,0,0,0.30)'; roundRect(20, 506, W - 40, 80, 14); ctx.fill();
    for (let i = 0; i < COLORS.length; i++) {
      const r = colorRect(i), sel = frosting === COLORS[i].c;
      ctx.fillStyle = COLORS[i].c; ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2 - 3, 0, 7); ctx.fill();
      ctx.lineWidth = sel ? 5 : 2; ctx.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,0.6)'; ctx.stroke();
    }
    // Süsler
    ctx.fillStyle = 'rgba(0,0,0,0.30)'; roundRect(20, 600, W - 40, 94, 14); ctx.fill();
    for (let i = 0; i < TOPPINGS.length; i++) {
      const it = TOPPINGS[i], r = topRect(i), have = it.free || unlocked[it.id], sel = tool === it.id;
      ctx.fillStyle = sel ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.12)'; roundRect(r.x, r.y, r.w, r.h, 12); ctx.fill();
      if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; roundRect(r.x, r.y, r.w, r.h, 12); ctx.stroke(); }
      ctx.globalAlpha = have ? 1 : 0.6;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '34px sans-serif'; ctx.fillStyle = '#fff';
      ctx.fillText(iconForTopping(it.id), r.x + r.w / 2, r.y + 32);
      if (!have) {
        ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#ffd23f'; ctx.fillText('🔒' + it.price, r.x + r.w / 2, r.y + 58);
      }
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  function drawButtons() {
    // Servis
    ctx.fillStyle = placed.length ? '#ff5d8f' : 'rgba(150,150,160,0.6)';
    roundRect(serveBtn.x, serveBtn.y, serveBtn.w, serveBtn.h, 18); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Servis Et 🍽️', serveBtn.x + serveBtn.w / 2, serveBtn.y + serveBtn.h / 2);
    // Temizle
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(clearBtn.x, clearBtn.y, clearBtn.w, clearBtn.h, 12); ctx.fill();
    ctx.font = '28px sans-serif'; ctx.fillText('🧽', clearBtn.x + clearBtn.w / 2, clearBtn.y + clearBtn.h / 2 + 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  function drawHUD() {
    // Para
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(16, 16, 150, 50, 14); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(42, 41, 13, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(coins, 62, 42);
    // Başlık
    ctx.fillStyle = 'rgba(0,0,0,0.30)'; roundRect(W / 2 - 120, 16, 240, 40, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🧁 Tatlı Dükkânı', W / 2, 37);
    ctx.textAlign = 'left';
    drawToggle(soundBtn, '🔊', soundOn); drawToggle(hapticBtn, '📳', hapticsOn);
    // İpucu / kutlama
    ctx.textAlign = 'center'; ctx.font = 'bold 19px sans-serif';
    ctx.fillStyle = serveFlash > 0 ? '#ff3b78' : 'rgba(120,60,90,0.85)';
    ctx.fillText(serveFlash > 0 ? '🎉 Harika tatlı! 🎉' : 'Renk seç · keke dokun · servis et', W / 2, 96);
    // Toast
    if (toastFx > 0 && toast) {
      ctx.globalAlpha = Math.min(1, toastFx / 25);
      ctx.fillStyle = 'rgba(0,0,0,0.8)'; roundRect(W / 2 - 130, 116, 260, 44, 12); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(toast, W / 2, 139); ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    // arka plan zemin
    ctx.fillStyle = '#ffd9e6'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffe9f1'; ctx.fillRect(0, 470, W, H - 470);
    // şef Kayrahan (köşe)
    if (heroLoaded) { const ar = hero.naturalWidth / hero.naturalHeight || 1, dh = 150, dw = dh * ar; ctx.globalAlpha = 0.95; ctx.drawImage(hero, 8, 150 - 0, dw, dh); ctx.globalAlpha = 1; }
    drawCake();
    for (const s of placed) drawTopping(s.type, s.x, s.y, s.rot, s.col);
    drawConfetti();
    drawPalettes();
    drawButtons();
    drawHUD();
  }

  function loop() {
    update(); render();
    if (!firstFrameSent) { firstFrameSent = true; SDK.firstFrameReady(); }
    requestAnimationFrame(loop);
  }

  // --- 10) Başlat ---
  async function boot() {
    const s = await SDK.loadData();
    if (s) {
      if (typeof s.coins === 'number') coins = s.coins;
      if (typeof s.served === 'number') served = s.served;
      if (s.unlocked) unlocked = Object.assign(unlocked, s.unlocked);
      if (s.soundOn === false) soundOn = false;
      if (s.hapticsOn === false) hapticsOn = false;
    }
    Haptics.setEnabled(hapticsOn); applyAudio();
    SDK.onAudioEnabledChange(() => applyAudio());
    SDK.onPause(() => {}); SDK.onResume(() => {});
    loop();
    SDK.gameReady();
  }
  boot();
})();
