/* =========================================================================
   Pofi'nin Macerası — basit, çocuk dostu platform oyunu
   - Dikey (portrait) 540x960 canvas
   - Klavye (← → / Boşluk) + dokunmatik kontroller
   - YouTube Playables SDK entegrasyonu (firstFrameReady / gameReady /
     onPause / onResume / saveData / loadData)
   - Tek dosya, harici görsel YOK (boyut çok küçük, telif sorunu yok)
   Karakter "Pofi" özgündür; Mario veya başka bir markaya ait değildir.
   ========================================================================= */

(() => {
  'use strict';

  // ---------------------------------------------------------------------
  // 1) YouTube Playables SDK — güvenli sarmalayıcı
  //    YouTube dışında (ör. masaüstü tarayıcı) `ytgame` tanımsızdır;
  //    bu yüzden her çağrıyı kontrol ediyoruz ki oyun her yerde çalışsın.
  // ---------------------------------------------------------------------
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
      saveData(obj) {
        try {
          if (hasSDK) return ytgame.game.saveData(JSON.stringify(obj));
          localStorage.setItem('pofi_save', JSON.stringify(obj)); // yerel test için
        } catch (e) {}
      },
      async loadData() {
        try {
          if (hasSDK) { const s = await ytgame.game.loadData(); return s ? JSON.parse(s) : null; }
          const s = localStorage.getItem('pofi_save'); return s ? JSON.parse(s) : null;
        } catch (e) { return null; }
      },
    };
  })();

  // ---------------------------------------------------------------------
  // 2) Canvas ve ölçekleme (oranı koruyarak ekrana sığdır)
  // ---------------------------------------------------------------------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;   // 540
  const H = canvas.height;  // 960

  function resize() {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width  = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------------
  // 2b) Ses efektleri (Web Audio ile sentezlenir — harici dosya yok)
  //     SDK'nın ses iznine saygılıdır; ilk kullanıcı hareketinde başlar.
  // ---------------------------------------------------------------------
  const Sound = (() => {
    let actx = null;
    let muted = false; // SDK ses kapalıysa true

    function ensure() {
      if (!actx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) actx = new AC();
      }
      if (actx && actx.state === 'suspended') actx.resume();
      return actx;
    }

    // Tek bir ton çal (tip, başlangıç frekansı, süre, ses, bitiş frekansı).
    function tone(type, freq, dur, vol, freqTo) {
      if (muted) return;
      const ac = ensure();
      if (!ac) return;
      const t = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (freqTo) osc.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    return {
      unlock() { ensure(); },                 // kullanıcı hareketinde çağrılır
      setMuted(m) { muted = m; },
      jump() { tone('square', 320, 0.14, 0.18, 620); },
      coin() { tone('square', 880, 0.07, 0.16); setTimeout(() => tone('square', 1320, 0.10, 0.16), 70); },
      win()  { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone('triangle', f, 0.16, 0.2), i * 110)); },
      hurt() { tone('sawtooth', 300, 0.25, 0.2, 90); },
    };
  })();

  // ---------------------------------------------------------------------
  // 3) Girdiler — klavye + dokunmatik
  // ---------------------------------------------------------------------
  const input = { left: false, right: false, jump: false };

  addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') input.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { input.jump = true; e.preventDefault(); }
  });
  addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') input.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') input.jump = false;
  });

  function bindButton(id, key) {
    const el = document.getElementById(id);
    const on  = (e) => { input[key] = true;  e.preventDefault(); };
    const off = (e) => { input[key] = false; e.preventDefault(); };
    el.addEventListener('touchstart', on,  { passive: false });
    el.addEventListener('touchend',   off, { passive: false });
    el.addEventListener('touchcancel',off, { passive: false });
    el.addEventListener('mousedown',  on);
    el.addEventListener('mouseup',    off);
    el.addEventListener('mouseleave', off);
  }
  bindButton('btn-left',  'left');
  bindButton('btn-right', 'right');
  bindButton('btn-jump',  'jump');

  // Dokunuş/tıklama: giriş ekranında başlat, kazanınca/bitince yeniden oyna.
  function advanceFromScreen() {
    if (state === 'start' || state === 'win' || state === 'over') startGame();
  }
  canvas.addEventListener('pointerdown', advanceFromScreen);
  addEventListener('keydown', (e) => {
    if ((state !== 'play') && (e.code === 'Space' || e.code === 'Enter')) startGame();
  });

  // ---------------------------------------------------------------------
  // 4) Bölüm verisi (basit, tek bölüm)
  //    Zemin + platformlar + paralar + bayrak (hedef).
  // ---------------------------------------------------------------------
  const GROUND_Y = H - 90;
  const LEVEL_W = 2600; // bölüm yatayda canvas'tan uzun → kamera kayar

  const platforms = [
    { x: 0,    y: GROUND_Y, w: LEVEL_W, h: 90 },     // zemin
    { x: 320,  y: 740, w: 160, h: 26 },
    { x: 560,  y: 630, w: 150, h: 26 },
    { x: 820,  y: 720, w: 160, h: 26 },
    { x: 1080, y: 600, w: 150, h: 26 },
    { x: 1320, y: 700, w: 170, h: 26 },
    { x: 1620, y: 600, w: 150, h: 26 },
    { x: 1880, y: 690, w: 160, h: 26 },
    { x: 2150, y: 590, w: 150, h: 26 },
  ];

  const coinsTemplate = [
    { x: 380, y: 690 }, { x: 610, y: 580 }, { x: 880, y: 670 },
    { x: 1130, y: 550 }, { x: 1380, y: 650 }, { x: 1670, y: 550 },
    { x: 1940, y: 640 }, { x: 2200, y: 540 }, { x: 1000, y: 820 },
    { x: 500, y: 820 }, { x: 1500, y: 820 }, { x: 2000, y: 820 },
  ];

  const goal = { x: LEVEL_W - 180, y: GROUND_Y - 200, w: 16, h: 200 };

  // ---------------------------------------------------------------------
  // 5) Oyuncu (Pofi) ve oyun durumu
  // ---------------------------------------------------------------------
  const player = {
    x: 80, y: GROUND_Y - 70, w: 46, h: 54,
    vx: 0, vy: 0, onGround: false, face: 1, anim: 0,
  };

  // Karakter görseli (assets/hero.png). Yüklenirse çizilen "Pofi" yerine
  // bu resim kullanılır; yoksa otomatik olarak vektör Pofi'ye düşer.
  const hero = new Image();
  let heroLoaded = false;
  hero.onload = () => { heroLoaded = true; };
  hero.onerror = () => { heroLoaded = false; };
  hero.src = 'assets/hero.png';

  let coins = [];
  let score = 0;
  let best = 0;
  let cameraX = 0;
  let state = 'start'; // 'start' | 'play' | 'win' | 'over'
  let paused = false;
  let blink = 0;
  let particles = [];   // koşma/iniş toz efekti
  let runDust = 0;      // koşarken toz çıkış sayacı

  // Ayak altında toz püskürt (n adet, dir: -1 sol / +1 sağ / 0 rastgele).
  function spawnDust(px, py, n, dir) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x: px + (Math.random() * 10 - 5),
        y: py + (Math.random() * 4 - 2),
        vx: (dir || (Math.random() * 2 - 1)) * (0.4 + Math.random() * 1.3),
        vy: -(0.2 + Math.random() * 0.9),
        life: 1, decay: 0.03 + Math.random() * 0.03,
        r: 3 + Math.random() * 4,
      });
    }
  }

  const GRAVITY = 0.9;
  const MOVE = 0.9;
  const MAX_SPEED = 6.5;
  const FRICTION = 0.8;
  const JUMP_V = -17;

  // Bölümü baştan kurar (durumu değiştirmez).
  function resetLevel() {
    player.x = 80; player.y = GROUND_Y - 70;
    player.vx = 0; player.vy = 0; player.onGround = false;
    coins = coinsTemplate.map(c => ({ ...c, taken: false, bob: Math.PI * (c.x % 7) }));
    score = 0;
    cameraX = 0;
    particles = [];
  }

  // Oyunu başlatır (giriş ekranından veya yeniden oynamadan).
  function startGame() {
    Sound.unlock();                  // ses bağlamını kullanıcı hareketinde aç
    Sound.setMuted(!SDK.audioEnabled());
    resetLevel();
    state = 'play';
  }

  // ---------------------------------------------------------------------
  // 6) Çarpışma yardımcıları (AABB)
  // ---------------------------------------------------------------------
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ---------------------------------------------------------------------
  // 7) Güncelleme (fizik)
  // ---------------------------------------------------------------------
  function update() {
    if (paused) return;
    if (state !== 'play') { blink += 0.08; return; }

    // Yatay hareket
    if (input.left)  { player.vx -= MOVE; player.face = -1; }
    if (input.right) { player.vx += MOVE; player.face = 1; }
    if (!input.left && !input.right) player.vx *= FRICTION;
    player.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, player.vx));

    // Zıplama
    if (input.jump && player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
      Sound.jump();
      spawnDust(player.x + player.w / 2, player.y + player.h, 5, 0); // kalkış tozu
    }

    // Yerçekimi
    player.vy += GRAVITY;
    if (player.vy > 22) player.vy = 22;

    // --- X ekseni hareketi + çarpışma ---
    player.x += player.vx;
    for (const p of platforms) {
      if (aabb(player, p)) {
        if (player.vx > 0) player.x = p.x - player.w;
        else if (player.vx < 0) player.x = p.x + p.w;
        player.vx = 0;
      }
    }
    // Bölüm sınırları
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > LEVEL_W) player.x = LEVEL_W - player.w;

    // --- Y ekseni hareketi + çarpışma ---
    player.y += player.vy;
    const impactV = player.vy;          // çarpma anındaki hız (iniş tozu için)
    player.onGround = false;
    for (const p of platforms) {
      if (aabb(player, p)) {
        if (player.vy > 0) {
          player.y = p.y - player.h; player.onGround = true;
          if (impactV > 8) spawnDust(player.x + player.w / 2, player.y + player.h, 6, 0); // iniş tozu
        } else if (player.vy < 0) player.y = p.y + p.h;
        player.vy = 0;
      }
    }

    // Animasyon sayacı + koşma tozu
    if (Math.abs(player.vx) > 0.5 && player.onGround) {
      player.anim += 0.25;
      // Arkadan toz (koştuğu belli olsun): daha sık ve birden fazla
      if (++runDust % 4 === 0) spawnDust(player.x + player.w / 2 - player.face * 12, player.y + player.h, 2, -player.face);
    }

    // Toz parçacıklarını güncelle
    for (let i = particles.length - 1; i >= 0; i--) {
      const d = particles[i];
      d.x += d.vx; d.y += d.vy; d.vy += 0.04; d.vx *= 0.94; d.life -= d.decay;
      if (d.life <= 0) particles.splice(i, 1);
    }

    // Paralar
    for (const c of coins) {
      if (c.taken) continue;
      c.bob += 0.1;
      const box = { x: c.x - 14, y: c.y - 14, w: 28, h: 28 };
      if (aabb(player, box)) { c.taken = true; score++; Sound.coin(); }
    }

    // Hedef bayrağı
    if (aabb(player, goal)) {
      state = 'win';
      Sound.win();
      if (score > best) best = score;
      SDK.saveData({ best, lastScore: score, won: true });
    }

    // Kamera oyuncuyu takip eder
    const target = player.x - W * 0.4;
    cameraX += (target - cameraX) * 0.1;
    cameraX = Math.max(0, Math.min(cameraX, LEVEL_W - W));
  }

  // ---------------------------------------------------------------------
  // 8) Çizim
  // ---------------------------------------------------------------------
  function drawBackground() {
    // Gökyüzü gradyanı
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8fd3ff');
    g.addColorStop(1, '#d9f4ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Tepeler (paralaks — yavaş kayar)
    ctx.fillStyle = '#bdebc1';
    for (let i = -1; i < 6; i++) {
      const hx = i * 520 - (cameraX * 0.3) % 520;
      ctx.beginPath();
      ctx.arc(hx + 260, GROUND_Y + 40, 260, Math.PI, 0);
      ctx.fill();
    }

    // Bulutlar
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 5; i++) {
      const cx = (i * 360 - (cameraX * 0.15)) % (W + 360);
      const x = cx < 0 ? cx + W + 360 : cx;
      const y = 120 + (i % 3) * 90;
      cloud(x, y);
    }
  }

  function cloud(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, 7); ctx.arc(x + 28, y + 6, 32, 0, 7);
    ctx.arc(x + 62, y, 24, 0, 7); ctx.fill();
  }

  function drawPlatform(p) {
    const x = p.x - cameraX;
    if (x + p.w < 0 || x > W) return;
    // Toprak
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(x, p.y, p.w, p.h);
    // Çim üstü
    ctx.fillStyle = '#5fd068';
    ctx.fillRect(x, p.y, p.w, 12);
  }

  function drawCoin(c) {
    if (c.taken) return;
    const x = c.x - cameraX;
    if (x + 20 < 0 || x - 20 > W) return;
    const yy = c.y + Math.sin(c.bob) * 4;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(x, yy, 13, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffb703';
    ctx.beginPath(); ctx.arc(x, yy, 13, 0, 7); ctx.lineWidth = 3; ctx.strokeStyle = '#ffb703'; ctx.stroke();
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(x - 2, yy - 7, 4, 14);
  }

  function drawGoal() {
    const x = goal.x - cameraX;
    if (x + 120 < 0 || x > W) return;
    // Direk
    ctx.fillStyle = '#cfcfcf';
    ctx.fillRect(x, goal.y, goal.w, goal.h);
    // Bayrak
    ctx.fillStyle = '#ff5d73';
    ctx.beginPath();
    ctx.moveTo(x + goal.w, goal.y + 6);
    ctx.lineTo(x + goal.w + 70, goal.y + 26);
    ctx.lineTo(x + goal.w, goal.y + 46);
    ctx.closePath(); ctx.fill();
  }

  function drawParticles() {
    for (const d of particles) {
      const px = d.x - cameraX;
      if (px < -20 || px > W + 20) continue;
      ctx.globalAlpha = Math.max(0, d.life) * 0.55;
      ctx.fillStyle = '#e8dcc0';
      ctx.beginPath();
      ctx.arc(px, d.y, d.r * (1.3 - d.life * 0.4), 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    const x = player.x - cameraX;
    const y = player.y;

    // --- Prosedürel animasyon parametreleri ---
    const running = player.onGround && Math.abs(player.vx) > 0.5;
    let sx = 1, sy = 1, rot = 0, bob = 0;
    if (!player.onGround) {
      // Havada: zıpla-uza / düş-sıkış (squash & stretch) + yöne yatış
      const v = Math.max(-18, Math.min(18, player.vy));
      sy = 1 + (-v) / 80;          // yukarı çıkarken uzar
      sx = 1 - (-v) / 130;         //   ve hafif incelir
      rot = player.face * 0.14;    // hareket yönüne yatar
    } else if (running) {
      // Koşma: hareket yönüne ÖNE EĞİLME + hafif adım sallanması + çok az bob
      const stride = Math.sin(player.anim);
      rot = player.face * 0.13 + stride * 0.05;  // öne eğil (yöne göre) + sallan
      bob = Math.abs(stride) * 1.5;              // çok hafif dikey hareket
      sy = 1 - Math.abs(stride) * 0.03;
      sx = 1 + Math.abs(stride) * 0.03;
    }
    const bounce = running ? Math.sin(player.anim) * 1.5 : 0;

    // Karakter resmi yüklüyse onu çiz (yön çevirme dahil), yoksa vektör Pofi.
    if (heroLoaded) {
      const ar = hero.naturalWidth / hero.naturalHeight || 1;
      const dh = player.h * 1.5;        // resmi biraz büyük göster
      const dw = dh * ar;
      ctx.save();
      ctx.translate(x + player.w / 2, y + player.h - bob); // ayak noktasına hizala
      ctx.rotate(rot);                                     // yatış (ekran uzayında)
      ctx.scale(player.face * sx, sy);                     // yön + squash/stretch
      ctx.drawImage(hero, -dw / 2, -dh, dw, dh);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(x + player.w / 2, y + player.h / 2 + bounce);
    ctx.scale(player.face, 1);

    // Gövde (yuvarlak, sevimli mor "Pofi")
    ctx.fillStyle = '#7c5cff';
    roundRect(-player.w / 2, -player.h / 2, player.w, player.h, 16);
    ctx.fill();
    // Karın
    ctx.fillStyle = '#d7ccff';
    roundRect(-player.w / 2 + 8, -2, player.w - 16, player.h / 2 - 4, 12);
    ctx.fill();
    // Göz
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(8, -12, 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#1b2540';
    ctx.beginPath(); ctx.arc(11, -12, 4, 0, 7); ctx.fill();
    // Yanak
    ctx.fillStyle = 'rgba(255,120,150,0.5)';
    ctx.beginPath(); ctx.arc(-6, -2, 5, 0, 7); ctx.fill();

    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawHUD() {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(16, 16, 150, 56, 14); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(44, 44, 14, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('× ' + score, 64, 46);
  }

  function drawCenterText(title, subtitle) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(title, W / 2, H / 2 - 40);
    if (Math.floor(blink) % 2 === 0) {
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(subtitle, W / 2, H / 2 + 40);
    }
    ctx.textAlign = 'left';
  }

  function drawStartScreen() {
    drawBackground();

    // Başlık
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1b2540';
    ctx.font = 'bold 58px sans-serif';
    ctx.fillText('Maceraya', W / 2, 180);
    ctx.fillText('Başla!', W / 2, 250);

    // Karakter görseli (yüklüyse) ortada büyük gösterilir
    if (heroLoaded) {
      const ar = hero.naturalWidth / hero.naturalHeight || 1;
      const dh = 360;
      const dw = dh * ar;
      ctx.drawImage(hero, W / 2 - dw / 2, H / 2 - dh / 2 + 30, dw, dh);
    } else {
      ctx.fillStyle = '#1b2540';
      ctx.font = '26px sans-serif';
      ctx.fillText('(karakter resmi: assets/hero.png)', W / 2, H / 2);
    }

    // Yanıp sönen "başla" ipucu
    if (Math.floor(blink) % 2 === 0) {
      ctx.fillStyle = '#1b2540';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText('▶ Dokun ve Başla', W / 2, H - 180);
    }
    ctx.textAlign = 'left';
  }

  const controlsEl = document.getElementById('touch-controls');
  function render() {
    ctx.clearRect(0, 0, W, H);
    controlsEl.style.visibility = (state === 'play') ? 'visible' : 'hidden';

    if (state === 'start') { drawStartScreen(); return; }

    drawBackground();
    for (const p of platforms) drawPlatform(p);
    drawGoal();
    for (const c of coins) drawCoin(c);
    drawParticles();
    drawPlayer();
    drawHUD();

    if (state === 'win') drawCenterText('Tebrikler! 🎉', 'Tekrar oyna — dokun');
  }

  // ---------------------------------------------------------------------
  // 9) Ana döngü
  // ---------------------------------------------------------------------
  let firstFrameSent = false;
  function loop() {
    update();
    render();

    // İlk kare çizildi → SDK'ya bildir
    if (!firstFrameSent) {
      firstFrameSent = true;
      SDK.firstFrameReady();
    }
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------------
  // 10) Başlat
  // ---------------------------------------------------------------------
  async function boot() {
    const saved = await SDK.loadData();
    if (saved && typeof saved.best === 'number') best = saved.best;

    resetLevel();      // bölümü hazırla
    state = 'start';   // giriş ekranıyla başla

    // Duraklat/devam (YouTube oyunu arka plana alınca)
    SDK.onPause(() => { paused = true; });
    SDK.onResume(() => { paused = false; });

    // Ses izni değişimini takip et (YouTube'da kullanıcı sesi açıp kapatınca)
    Sound.setMuted(!SDK.audioEnabled());
    SDK.onAudioEnabledChange((enabled) => { Sound.setMuted(!enabled); });

    loop();

    // Oyun oynanmaya hazır → SDK'ya bildir
    SDK.gameReady();
  }

  boot();
})();
