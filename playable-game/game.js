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
      sendScore(v) { try { if (hasSDK) ytgame.engagement.sendScore({ value: v }); } catch (e) {} },
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

    // Arka plan müziği — neşeli, döngülü, alçak sesli (harici dosya yok).
    let musicTimer = null, mi = 0;
    const MELODY = [659, 0, 784, 659, 523, 0, 587, 659, 880, 0, 784, 659, 587, 0, 523, 0];
    const BASS   = [131, 0, 0, 0, 98, 0, 0, 0, 147, 0, 0, 0, 98, 0, 0, 0];
    function musicStep() {
      mi++;
      if (muted) return;
      const ac = ensure();
      if (!ac) return;
      const t = ac.currentTime;
      const play = (f, type, vol, dur) => {
        if (!f) return;
        const osc = ac.createOscillator(), g = ac.createGain();
        osc.type = type; osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g).connect(ac.destination);
        osc.start(t); osc.stop(t + dur + 0.02);
      };
      play(MELODY[mi % MELODY.length], 'triangle', 0.05, 0.22);
      play(BASS[mi % BASS.length], 'sine', 0.06, 0.30);
    }

    return {
      unlock() { ensure(); },                 // kullanıcı hareketinde çağrılır
      setMuted(m) { muted = m; },
      jump() { tone('square', 320, 0.14, 0.18, 620); },
      coin() { tone('square', 880, 0.07, 0.16); setTimeout(() => tone('square', 1320, 0.10, 0.16), 70); },
      win()  { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone('triangle', f, 0.16, 0.2), i * 110)); },
      hurt() { tone('sawtooth', 300, 0.25, 0.2, 90); },
      power() { [659, 880, 1175].forEach((f, i) => setTimeout(() => tone('triangle', f, 0.12, 0.2), i * 80)); },
      musicStart() { if (!musicTimer) { ensure(); musicTimer = setInterval(musicStep, 240); } },
      musicStop()  { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
    };
  })();

  // ---------------------------------------------------------------------
  // 2c) Haptik (titreşim) — web Vibration API (Playables SDK'da haptik yok).
  //     Desteklenmiyorsa/iframe izin vermiyorsa sessizce atlanır.
  //     enabled bayrağı ileride bir ayar düğmesine bağlanabilir.
  // ---------------------------------------------------------------------
  const Haptics = (() => {
    const ok = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    let enabled = true;
    return {
      supported: ok,
      setEnabled(v) { enabled = v; },
      isEnabled() { return enabled; },
      buzz(pattern) { if (ok && enabled) { try { navigator.vibrate(pattern); } catch (e) {} } },
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
    const on  = (e) => { input[key] = true;  Haptics.buzz(10); e.preventDefault(); }; // dokununca hafif tık
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

  // Dokunuş/tıklama veya Space/Enter: ekranlardan ilerle (advance fonksiyonu altta).
  canvas.addEventListener('pointerdown', () => advance());
  addEventListener('keydown', (e) => {
    if (state !== 'play' && (e.code === 'Space' || e.code === 'Enter')) advance();
  });

  // ---------------------------------------------------------------------
  // 4) Bölüm verisi (basit, tek bölüm)
  //    Zemin + platformlar + paralar + bayrak (hedef).
  // ---------------------------------------------------------------------
  const GROUND_Y = H - 90;

  // Bölüm parçalarını kısa yazmak için builder'lar.
  const gseg  = (x, w)               => ({ x, y: GROUND_Y,      w, h: 90 });            // katı zemin
  const step  = (x)                  => ({ x, y: GROUND_Y - 78, w: 70, h: 22 });        // kuyu ortası basamak (tek yönlü)
  const plat  = (x, y, w)            => ({ x, y, w, h: 24 });                            // para platformu (tek yönlü)
  const spike = (x, w = 52)          => ({ x, y: GROUND_Y - 24, w, h: 24 });            // diken
  const enemy = (x, dir, speed, min, max) => ({ x, y: GROUND_Y - 40, w: 40, h: 40, dir, speed, min, max });

  // Tüm bölümler. Yeni bölüm eklemek için diziye bir nesne daha ekle.
  const LEVELS = [
    { // --- BÖLÜM 1 ---
      w: 2600, startX: 80,
      ground: [gseg(0, 520), gseg(630, 540), gseg(1290, 560), gseg(1960, 640)],
      steps:  [step(540), step(1195), step(1872)],
      floating: [plat(300, 770, 140), plat(820, 760, 150), plat(1440, 770, 150), plat(2150, 760, 150)],
      coins: [
        { x: 200, y: 805 }, { x: 360, y: 720 }, { x: 575, y: 720 },
        { x: 760, y: 805 }, { x: 890, y: 710 }, { x: 1230, y: 720 },
        { x: 1380, y: 805 }, { x: 1510, y: 720 }, { x: 1905, y: 720 },
        { x: 2050, y: 805 }, { x: 2215, y: 710 },
      ],
      spikes: [spike(980), spike(1600)],
      enemies: [enemy(760, 1, 1.3, 700, 920), enemy(1400, -1, 1.5, 1330, 1560), enemy(2080, 1, 1.4, 2010, 2300)],
    },
    { // --- BÖLÜM 2 --- (daha uzun, daha çok kuyu, daha hızlı düşman)
      w: 2800, startX: 70,
      ground: [gseg(0, 460), gseg(580, 420), gseg(1130, 460), gseg(1700, 440), gseg(2260, 540)],
      steps:  [step(490), step(1035), step(1615), step(2170)],
      floating: [plat(250, 760, 130), plat(760, 740, 140), plat(1300, 760, 140), plat(1850, 750, 140), plat(2480, 760, 140)],
      coins: [
        { x: 160, y: 805 }, { x: 300, y: 710 }, { x: 490, y: 705 },
        { x: 760, y: 690 }, { x: 1035, y: 705 }, { x: 1300, y: 710 },
        { x: 1450, y: 805 }, { x: 1615, y: 705 }, { x: 1850, y: 700 },
        { x: 2050, y: 805 }, { x: 2170, y: 705 }, { x: 2480, y: 710 }, { x: 2560, y: 805 },
      ],
      spikes: [spike(780), spike(1350), spike(1950)],
      enemies: [
        enemy(200, 1, 1.6, 120, 400), enemy(650, 1, 1.8, 600, 740),
        enemy(1450, -1, 1.9, 1400, 1560), enemy(2400, 1, 1.8, 2300, 2700),
      ],
    },
    { // --- BÖLÜM 3 --- (en uzun: 5 kuyu, 5 hızlı düşman, 4 diken)
      w: 3000, startX: 70,
      ground: [
        gseg(0, 440), gseg(560, 400), gseg(1090, 390),
        gseg(1600, 400), gseg(2120, 420), gseg(2650, 350),
      ],
      steps: [step(465), step(990), step(1505), step(2025), step(2555)],
      floating: [
        plat(250, 760, 130), plat(720, 745, 130), plat(1200, 760, 130),
        plat(1720, 745, 130), plat(2250, 760, 130), plat(2780, 750, 130),
      ],
      coins: [
        { x: 160, y: 805 }, { x: 300, y: 710 }, { x: 465, y: 705 },
        { x: 640, y: 805 }, { x: 720, y: 690 }, { x: 990, y: 705 },
        { x: 1200, y: 710 }, { x: 1350, y: 805 }, { x: 1505, y: 705 },
        { x: 1720, y: 690 }, { x: 1900, y: 805 }, { x: 2025, y: 705 },
        { x: 2250, y: 710 }, { x: 2555, y: 705 }, { x: 2780, y: 700 }, { x: 2900, y: 805 },
      ],
      spikes: [spike(820), spike(1250), spike(1820), spike(2350)],
      enemies: [
        enemy(200, 1, 1.8, 120, 380), enemy(640, 1, 2.0, 600, 780),
        enemy(1350, -1, 2.0, 1300, 1450), enemy(1900, 1, 2.1, 1860, 1970),
        enemy(2440, -1, 2.2, 2380, 2520),
      ],
    },
    { // --- BÖLÜM 4 --- (6 segman, 5 kuyu, 6 düşman, 5 diken)
      w: 3200, startX: 70,
      ground: [
        gseg(0, 420), gseg(540, 400), gseg(1070, 400),
        gseg(1590, 420), gseg(2130, 430), gseg(2680, 520),
      ],
      steps: [step(445), step(965), step(1495), step(2035), step(2585)],
      floating: [
        plat(230, 760, 130), plat(700, 745, 130), plat(1200, 760, 130),
        plat(1720, 745, 130), plat(2280, 760, 130), plat(2950, 750, 130),
      ],
      coins: [
        { x: 160, y: 805 }, { x: 230, y: 710 }, { x: 445, y: 705 },
        { x: 620, y: 805 }, { x: 700, y: 690 }, { x: 965, y: 705 },
        { x: 1200, y: 710 }, { x: 1350, y: 805 }, { x: 1495, y: 705 },
        { x: 1720, y: 690 }, { x: 1900, y: 805 }, { x: 2035, y: 705 },
        { x: 2280, y: 710 }, { x: 2585, y: 705 }, { x: 2950, y: 700 }, { x: 3050, y: 805 },
      ],
      spikes: [spike(820), spike(1280), spike(1820), spike(2350), spike(2820)],
      enemies: [
        enemy(200, 1, 1.9, 120, 360), enemy(620, 1, 2.0, 580, 780),
        enemy(1350, -1, 2.1, 1320, 1440), enemy(1700, 1, 2.2, 1640, 1780),
        enemy(2250, -1, 2.2, 2170, 2300), enemy(3000, 1, 2.3, 2880, 3140),
      ],
    },
    { // --- BÖLÜM 5 --- (final: 7 segman, 6 kuyu, 6 hızlı düşman, 5 diken)
      w: 3400, startX: 70,
      ground: [
        gseg(0, 400), gseg(520, 360), gseg(1010, 370), gseg(1500, 380),
        gseg(2000, 380), gseg(2500, 380), gseg(3000, 400),
      ],
      steps: [step(425), step(915), step(1405), step(1905), step(2405), step(2905)],
      floating: [
        plat(200, 760, 120), plat(640, 745, 120), plat(1120, 760, 120), plat(1600, 745, 120),
        plat(2080, 760, 120), plat(2580, 745, 120), plat(3120, 755, 120),
      ],
      coins: [
        { x: 140, y: 805 }, { x: 200, y: 710 }, { x: 425, y: 705 },
        { x: 640, y: 690 }, { x: 915, y: 705 }, { x: 1120, y: 710 },
        { x: 1300, y: 805 }, { x: 1405, y: 705 }, { x: 1600, y: 690 },
        { x: 1780, y: 805 }, { x: 1905, y: 705 }, { x: 2080, y: 710 },
        { x: 2405, y: 705 }, { x: 2580, y: 690 }, { x: 2905, y: 705 },
        { x: 3120, y: 700 }, { x: 3250, y: 805 },
      ],
      spikes: [spike(700), spike(1180), spike(1680), spike(2180), spike(2680)],
      enemies: [
        enemy(200, 1, 2.0, 120, 340), enemy(1250, -1, 2.3, 1210, 1340),
        enemy(1780, 1, 2.3, 1740, 1840), enemy(2280, 1, 2.4, 2240, 2340),
        enemy(2780, 1, 2.4, 2740, 2840), enemy(3200, -1, 2.5, 3080, 3360),
      ],
    },
  ];

  // Bölüm temaları (atmosfer). Bölüm sayısından fazlaysa baştan döner.
  const THEMES = [
    { skyTop: '#8fd3ff', skyBot: '#d9f4ff', hill: '#bdebc1', grass: '#5fd068', soil: '#8b5a2b', cloud: 'rgba(255,255,255,0.9)', stars: false }, // gündüz
    { skyTop: '#ff8a5c', skyBot: '#ffd9a0', hill: '#d99a6c', grass: '#7bc56b', soil: '#7a4a26', cloud: 'rgba(255,238,220,0.85)', stars: false }, // gün batımı
    { skyTop: '#10193a', skyBot: '#37406e', hill: '#2b3358', grass: '#3f8a52', soil: '#4a3322', cloud: 'rgba(200,210,235,0.35)', stars: true },  // gece
  ];

  // Güçlendirmeler — bölüm başına (güvenli, kuyu/diken/düşmandan uzak noktalar).
  // type: 'heart' (+1 can) | 'star' (kısa dokunulmazlık + düşman yenme).
  const LEVEL_POWERS = [
    [{ x: 1700, y: 805, type: 'star' }],   // Bölüm 1
    [{ x: 1200, y: 805, type: 'heart' }],  // Bölüm 2
    [{ x: 1650, y: 805, type: 'star' }],   // Bölüm 3
    [{ x: 2450, y: 805, type: 'heart' }],  // Bölüm 4
    [{ x: 1100, y: 805, type: 'star' }],   // Bölüm 5
  ];

  // Aktif bölüm verisi (loadLevel ile doldurulur).
  let LEVEL_W, startX, platforms, solids, oneway, coinsTemplate, spikesTemplate, enemiesTemplate, powersTemplate, goal, theme;

  function loadLevel(i) {
    const L = LEVELS[i];
    LEVEL_W = L.w;
    startX = L.startX;
    solids = L.ground;                       // tam katı (her yönden çarpışır)
    oneway = L.steps.concat(L.floating);     // tek yönlü (altından geç, üstüne kon)
    platforms = L.ground.concat(L.steps, L.floating); // çizim için hepsi
    coinsTemplate = L.coins;
    spikesTemplate = L.spikes;
    enemiesTemplate = L.enemies;
    powersTemplate = LEVEL_POWERS[i] || [];
    goal = { x: LEVEL_W - 150, y: GROUND_Y - 200, w: 16, h: 200 };
    theme = THEMES[i % THEMES.length];
  }

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
  let state = 'start'; // 'start' | 'play' | 'levelclear' | 'win' | 'over'
  let paused = false;
  let blink = 0;
  let particles = [];   // koşma/iniş toz efekti
  let runDust = 0;      // koşarken toz çıkış sayacı
  let lives = 3;        // can hakkı (tur başına, kalıcı değil)
  let iframes = 0;      // hasar sonrası kısa dokunulmazlık (kare)
  let enemies = [];     // gezen düşmanlar (kopya)
  let spikes = [];      // dikenler (kopya)
  let powerups = [];    // güçlendirmeler (kopya)
  let starTime = 0;     // yıldız (dokunulmazlık) kalan kare
  let checkpointX = 80; // kuyuya düşünce geri doğacağı güvenli x
  let currentLevel = 0; // aktif bölüm indeksi

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

  // Aktif bölümü baştan kurar (CAN ve PUAN'a dokunmaz — bölümler arası taşınır).
  function resetLevel() {
    player.x = startX; player.y = GROUND_Y - 70;
    player.vx = 0; player.vy = 0; player.onGround = false;
    coins = coinsTemplate.map(c => ({ ...c, taken: false, bob: Math.PI * (c.x % 7) }));
    enemies = enemiesTemplate.map(e => ({ ...e, alive: true, anim: 0 }));
    spikes = spikesTemplate.map(s => ({ ...s }));
    powerups = powersTemplate.map(p => ({ ...p, taken: false, bob: Math.PI * (p.x % 7) }));
    cameraX = 0;
    particles = [];
    iframes = 0;
    starTime = 0;
    checkpointX = startX;
  }

  // Yeni oyun (giriş ekranından / Oyun Bitti / Tebrikler sonrası): Bölüm 1, 3 can.
  function startGame() {
    Sound.unlock();                  // ses bağlamını kullanıcı hareketinde aç
    Sound.setMuted(!SDK.audioEnabled());
    Sound.musicStart();              // arka plan müziği
    currentLevel = 0;
    lives = 3;
    score = 0;
    loadLevel(currentLevel);
    resetLevel();
    state = 'play';
  }

  // Sonraki bölüme geç (can ve puan korunur).
  function goToNextLevel() {
    currentLevel++;
    loadLevel(currentLevel);
    resetLevel();
    state = 'play';
  }

  // Ekranlardan ilerle: bölüm bittiyse sonrakine, diğerlerinde yeni oyun.
  function advance() {
    if (state === 'levelclear') goToNextLevel();
    else if (state === 'start' || state === 'win' || state === 'over') startGame();
  }

  // ---------------------------------------------------------------------
  // 6) Çarpışma yardımcıları (AABB)
  // ---------------------------------------------------------------------
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // Bir can eksilt; canlar biterse "Oyun Bitti".
  function loseLife() {
    lives--;
    Sound.hurt();
    Haptics.buzz(40);   // can kaybında belirgin titreşim
    if (lives <= 0) {
      state = 'over';
      if (score > best) best = score;
      SDK.saveData({ best, lastScore: score });
      SDK.sendScore(score);            // skoru YouTube'a gönder
    }
  }

  // Tehlikeye (diken/düşman) yandan değme: can git + geri savrul + dokunulmazlık.
  function hitContact(dir) {
    if (iframes > 0 || starTime > 0 || state !== 'play') return; // yıldızlıyken hasar yok
    loseLife();
    if (state === 'play') {
      iframes = 90;                 // ~1.5 sn dokunulmazlık
      player.vx = dir * 8;          // tehlikeden uzağa savrul
      player.vy = -9;
    }
  }

  // ---------------------------------------------------------------------
  // 7) Güncelleme (fizik)
  // ---------------------------------------------------------------------
  function update() {
    if (paused) return;
    if (state !== 'play') { blink += 0.08; return; }

    if (iframes > 0) iframes--;   // hasar sonrası dokunulmazlık geri sayımı
    if (starTime > 0) starTime--; // yıldız (güçlendirme) dokunulmazlığı

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

    // --- X ekseni hareketi + çarpışma (sadece KATI zeminler engeller) ---
    player.x += player.vx;
    for (const p of solids) {
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
    const prevBottom = player.y + player.h;   // hareketten ÖNCEki alt kenar
    player.y += player.vy;
    const impactV = player.vy;                // çarpma anındaki hız (iniş tozu için)
    player.onGround = false;
    let landedSeg = null;                     // bu kare basılan KATI zemin parçası

    // Katı zeminler: her yönden çarpışır
    for (const p of solids) {
      if (aabb(player, p)) {
        if (player.vy > 0) {
          player.y = p.y - player.h; player.onGround = true; landedSeg = p;
          if (impactV > 8) spawnDust(player.x + player.w / 2, player.y + player.h, 6, 0);
        } else if (player.vy < 0) player.y = p.y + p.h;
        player.vy = 0;
      }
    }
    // Tek yönlü platformlar: yalnızca DÜŞERKEN ve üstten gelirken kon
    for (const p of oneway) {
      if (player.vy > 0 && prevBottom <= p.y + 4 && aabb(player, p)) {
        player.y = p.y - player.h; player.vy = 0; player.onGround = true;
        if (impactV > 8) spawnDust(player.x + player.w / 2, player.y + player.h, 5, 0);
      }
    }

    // Checkpoint SADECE sağlam zeminde + kuyu kenarlarından uzağa kaydedilir
    // (yoksa kuyuya düşünce tekrar kuyuya doğup canlar peş peşe biterdi).
    if (landedSeg) {
      checkpointX = Math.min(Math.max(player.x, landedSeg.x + 24),
                             landedSeg.x + landedSeg.w - player.w - 24);
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

    // Güçlendirmeler
    for (const p of powerups) {
      if (p.taken) continue;
      p.bob += 0.1;
      const box = { x: p.x - 16, y: p.y - 16, w: 32, h: 32 };
      if (aabb(player, box)) {
        p.taken = true;
        Sound.power();
        Haptics.buzz([15, 30, 15]);                  // güçlendirme titreşimi
        if (p.type === 'heart') {
          if (lives < 3) lives++; else score += 5;   // dolu ise puan
        } else { // star
          starTime = 360;                            // ~6 sn dokunulmazlık
        }
      }
    }

    // Düşmanlar: gidip gel + çarpışma (üstüne basınca yen, yandan değince can git)
    for (const e of enemies) {
      if (!e.alive) continue;
      e.x += e.dir * e.speed;
      if (e.x <= e.min) { e.x = e.min; e.dir = 1; }
      if (e.x >= e.max) { e.x = e.max; e.dir = -1; }
      e.anim += 0.2;
      if (aabb(player, e)) {
        const stomp = player.vy > 0 && (player.y + player.h) < (e.y + e.h * 0.6);
        if (stomp || starTime > 0) {     // ezme VEYA yıldızlıyken dokunma → yen
          e.alive = false;
          if (stomp) player.vy = -12;     // ezince zıpla
          score += 2;
          Sound.coin();
          spawnDust(e.x + e.w / 2, e.y + e.h, 7, 0);
        } else {
          hitContact(player.x < e.x ? -1 : 1);
        }
      }
    }

    // Dikenler (statik): değince can git
    for (const s of spikes) {
      if (aabb(player, s)) hitContact(player.x < s.x ? -1 : 1);
    }

    // Kuyuya düşme: ekran altına inerse can git + checkpoint'e geri doğ
    if (player.y > H + 40) {
      loseLife();
      if (state === 'play') {
        player.x = checkpointX;
        player.y = GROUND_Y - player.h - 80;
        player.vx = 0; player.vy = 0;
        iframes = 70;
      }
    }

    // Hedef bayrağı
    if (aabb(player, goal)) {
      Sound.win();
      Haptics.buzz([20, 40, 20, 40]);    // bölüm/oyun bitişi titreşimi
      if (currentLevel < LEVELS.length - 1) {
        state = 'levelclear';            // sonraki bölüm var
      } else {
        state = 'win';                   // son bölüm bitti
        if (score > best) best = score;
        SDK.saveData({ best, lastScore: score, won: true });
        SDK.sendScore(score);            // skoru YouTube'a gönder
      }
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
    const th = theme || THEMES[0];
    // Gökyüzü gradyanı (temaya göre)
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.skyTop);
    g.addColorStop(1, th.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Yıldızlar (gece teması) — kameraya göre çok yavaş kayar
    if (th.stars) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 40; i++) {
        const sx = (i * 137 - cameraX * 0.1) % (W + 40);
        const x = sx < 0 ? sx + W + 40 : sx;
        const y = (i * 53) % (GROUND_Y - 120) + 20;
        const r = (i % 3 === 0) ? 1.8 : 1;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
    }

    // Tepeler (paralaks — yavaş kayar)
    ctx.fillStyle = th.hill;
    for (let i = -1; i < 6; i++) {
      const hx = i * 520 - (cameraX * 0.3) % 520;
      ctx.beginPath();
      ctx.arc(hx + 260, GROUND_Y + 40, 260, Math.PI, 0);
      ctx.fill();
    }

    // Bulutlar (gecede daha soluk)
    ctx.fillStyle = th.cloud;
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
    ctx.fillStyle = (theme || THEMES[0]).soil;
    ctx.fillRect(x, p.y, p.w, p.h);
    // Çim üstü
    ctx.fillStyle = (theme || THEMES[0]).grass;
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

  function drawEnemy(e) {
    if (!e.alive) return;
    const x = e.x - cameraX;
    if (x + e.w < 0 || x > W) return;
    const wob = Math.sin(e.anim) * 2;
    // Gövde (sevimli turuncu düşman)
    ctx.fillStyle = '#ff7043';
    roundRect(x, e.y + wob, e.w, e.h - wob, 10); ctx.fill();
    // Ayaklar
    ctx.fillStyle = '#c1440e';
    ctx.fillRect(x + 6, e.y + e.h - 6, 10, 6);
    ctx.fillRect(x + e.w - 16, e.y + e.h - 6, 10, 6);
    // Gözler (gidiş yönüne bakar)
    const ex = e.dir > 0 ? 4 : -4;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x + 14 + ex, e.y + 16 + wob, 7, 0, 7); ctx.arc(x + e.w - 14 + ex, e.y + 16 + wob, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#1b2540';
    ctx.beginPath(); ctx.arc(x + 14 + ex * 1.5, e.y + 16 + wob, 3.5, 0, 7); ctx.arc(x + e.w - 14 + ex * 1.5, e.y + 16 + wob, 3.5, 0, 7); ctx.fill();
    // Kaşlar (öfkeli)
    ctx.strokeStyle = '#1b2540'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 7, e.y + 8 + wob); ctx.lineTo(x + 19, e.y + 12 + wob);
    ctx.moveTo(x + e.w - 7, e.y + 8 + wob); ctx.lineTo(x + e.w - 19, e.y + 12 + wob); ctx.stroke();
  }

  function drawSpike(s) {
    const x = s.x - cameraX;
    if (x + s.w < 0 || x > W) return;
    const n = Math.max(2, Math.floor(s.w / 18));
    const step = s.w / n;
    ctx.fillStyle = '#9aa3ab';
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * step, s.y + s.h);
      ctx.lineTo(x + i * step + step / 2, s.y);
      ctx.lineTo(x + (i + 1) * step, s.y + s.h);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#6b7177'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, s.y + s.h); ctx.lineTo(x + s.w, s.y + s.h); ctx.stroke();
  }

  function drawStar(cx, cy, outer, inner) {
    ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#ff9e00'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = (i % 2) ? inner : outer;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  function drawPowerup(p) {
    if (p.taken) return;
    const x = p.x - cameraX;
    if (x + 24 < 0 || x - 24 > W) return;
    const yy = p.y + Math.sin(p.bob) * 4;
    if (p.type === 'heart') heart(x, yy, 15, true);
    else drawStar(x, yy, 16, 7);
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
    // Hasar sonrası dokunulmazlıkta yanıp sön
    if (iframes > 0 && Math.floor(iframes / 4) % 2 === 0) return;

    const x = player.x - cameraX;
    const y = player.y;

    // Yıldız (güçlendirme) parıltısı — biterken hızlı yanıp söner
    if (starTime > 0 && !(starTime < 90 && Math.floor(starTime / 5) % 2 === 0)) {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(starTime * 0.4);
      ctx.fillStyle = '#ffe06a';
      ctx.beginPath();
      ctx.arc(x + player.w / 2, y + player.h / 2, player.w * 1.15, 0, 7);
      ctx.fill();
      ctx.restore();
    }

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

  function heart(cx, cy, r, filled) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.9);
    ctx.bezierCurveTo(cx - r * 1.4, cy - r * 0.4, cx - r * 0.5, cy - r * 1.1, cx, cy - r * 0.3);
    ctx.bezierCurveTo(cx + r * 0.5, cy - r * 1.1, cx + r * 1.4, cy - r * 0.4, cx, cy + r * 0.9);
    ctx.closePath();
    if (filled) { ctx.fillStyle = '#ff4d6d'; ctx.fill(); }
    else { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill(); ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function drawHUD() {
    // Para sayacı (sol üst)
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(16, 16, 150, 56, 14); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(44, 44, 14, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('× ' + score, 64, 46);

    // Canlar (sağ üst) — 3 kalp
    for (let i = 0; i < 3; i++) {
      heart(W - 40 - i * 44, 44, 14, i < lives);
    }

    // Bölüm göstergesi (üst orta)
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(W / 2 - 70, 16, 140, 40, 12); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Bölüm ' + (currentLevel + 1) + ' / ' + LEVELS.length, W / 2, 37);
    ctx.textAlign = 'left';
  }

  // Metni maxWidth'e sığacak en büyük punto ile ayarlar (font'u set eder, puntoyu döner).
  function fitFont(text, maxWidth, maxSize) {
    let size = maxSize;
    ctx.font = 'bold ' + size + 'px sans-serif';
    while (size > 12 && ctx.measureText(text).width > maxWidth) {
      size -= 2;
      ctx.font = 'bold ' + size + 'px sans-serif';
    }
    return size;
  }

  function drawCenterText(title, subtitle) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    fitFont(title, W - 50, 64);                 // başlığı ekrana sığdır
    ctx.fillText(title, W / 2, H / 2 - 40);
    if (Math.floor(blink) % 2 === 0) {
      fitFont(subtitle, W - 50, 30);            // alt yazıyı da sığdır
      ctx.fillText(subtitle, W / 2, H / 2 + 40);
    }
    ctx.textAlign = 'left';
  }

  function drawStartScreen() {
    drawBackground();

    // Zemin şeridi (karakter üstünde dursun)
    ctx.fillStyle = (theme || THEMES[0]).soil;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = (theme || THEMES[0]).grass;
    ctx.fillRect(0, GROUND_Y, W, 14);

    ctx.textAlign = 'center';

    // Başlık — sarı dolgu + lacivert kontur (çizgi film hissi)
    const ts = fitFont('KAYRAHAN', W - 60, 78);
    ctx.font = 'bold ' + ts + 'px sans-serif';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9; ctx.strokeStyle = '#1b2540';
    ctx.strokeText('KAYRAHAN', W / 2, 150);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('KAYRAHAN', W / 2, 150);

    // Alt başlık
    ctx.fillStyle = '#1b2540';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('Macera Zamanı!', W / 2, 205);

    // En iyi skor (varsa)
    if (best > 0) {
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#1b2540';
      ctx.fillText('🏆 En İyi: ' + best, W / 2, 245);
    }

    // Karakter — zeminde durur ve hafifçe zıplar
    const bob = Math.abs(Math.sin(blink * 2)) * 14;
    if (heroLoaded) {
      const ar = hero.naturalWidth / hero.naturalHeight || 1;
      const dh = 320;
      const dw = dh * ar;
      ctx.drawImage(hero, W / 2 - dw / 2, GROUND_Y - dh + 6 - bob, dw, dh);
    } else {
      ctx.fillStyle = '#1b2540';
      ctx.font = '26px sans-serif';
      ctx.fillText('(karakter resmi: assets/hero.png)', W / 2, H / 2);
    }

    // Yanıp sönen "başla" ipucu (zeminin hemen üstünde)
    if (Math.floor(blink) % 2 === 0) {
      ctx.fillStyle = '#fff';
      ctx.lineWidth = 6; ctx.strokeStyle = '#1b2540';
      ctx.font = 'bold 34px sans-serif';
      ctx.strokeText('▶ Dokun ve Başla', W / 2, GROUND_Y - 70);
      ctx.fillText('▶ Dokun ve Başla', W / 2, GROUND_Y - 70);
    }

    // Kontrol ipucu (en altta)
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('← →  yürü   ·   ⤒  zıpla', W / 2, H - 34);

    ctx.textAlign = 'left';
  }

  const controlsEl = document.getElementById('touch-controls');
  function render() {
    ctx.clearRect(0, 0, W, H);
    controlsEl.style.visibility = (state === 'play') ? 'visible' : 'hidden';

    if (state === 'start') { drawStartScreen(); return; }

    drawBackground();
    // Kuyu karanlığı: zemin satırını koyu boya, zemin parçaları üstüne çizilince
    // sadece boşluklar (kuyular) karanlık kalır.
    ctx.fillStyle = '#241a10';
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    for (const p of platforms) drawPlatform(p);
    drawGoal();
    for (const s of spikes) drawSpike(s);
    for (const c of coins) drawCoin(c);
    for (const p of powerups) drawPowerup(p);
    for (const e of enemies) drawEnemy(e);
    drawParticles();
    drawPlayer();
    drawHUD();

    if (state === 'levelclear') drawCenterText('Bölüm ' + (currentLevel + 1) + ' Tamam! ✓', 'Sonraki bölüm — dokun');
    if (state === 'win') drawCenterText('Tebrikler! 🎉', 'Tekrar oyna — dokun');
    if (state === 'over') drawCenterText('Oyun Bitti', 'Tekrar dene — dokun');
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

    loadLevel(0);      // ilk bölümü yükle
    resetLevel();      // bölümü hazırla
    state = 'start';   // giriş ekranıyla başla

    // Duraklat/devam (YouTube oyunu arka plana alınca)
    SDK.onPause(() => { paused = true; Sound.musicStop(); });
    SDK.onResume(() => { paused = false; Sound.musicStart(); });

    // Ses izni değişimini takip et (YouTube'da kullanıcı sesi açıp kapatınca)
    Sound.setMuted(!SDK.audioEnabled());
    SDK.onAudioEnabledChange((enabled) => { Sound.setMuted(!enabled); });

    loop();

    // Oyun oynanmaya hazır → SDK'ya bildir
    SDK.gameReady();
  }

  boot();
})();
