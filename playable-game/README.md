# Pofi'nin Macerası 🟣

Çocuklar için basit, **dikey (portrait)** modda çalışan HTML5 platform oyunu.
YouTube Playables'a yüklenmek üzere tasarlandı.

- **Özgün karakter "Pofi"** — herhangi bir markaya ait değildir (telif güvenli).
- Koş, zıpla, paraları topla, bayrağa ulaş.
- Klavye (← → / Boşluk) **ve** dokunmatik kontroller.
- Harici görsel/ses dosyası yok → boyut çok küçük (30MB sınırının çok altında).

## Dosyalar
```
playable-game/
├── index.html   # Playables SDK burada, oyun kodundan ÖNCE yüklenir
├── style.css    # Dikey sahne + dokunmatik kontroller
├── game.js      # Oyun motoru, fizik, SDK çağrıları
└── assets/
    └── hero.png # Karakter resmi (giriş ekranı + oyuncu)
```

## Karakter resmini ekleme
- Resmi `assets/hero.png` adıyla koy (**PNG, şeffaf arka plan** önerilir).
- Yüklenince hem **giriş ekranında** hem **oyun içinde** otomatik kullanılır.
- Dosya yoksa oyun, yedek vektör karakter "Pofi" ile çalışır (kod değişmeden).

## Yerel test
```bash
npx http-server playable-game -p 4321 -c-1
# tarayıcıda: http://127.0.0.1:4321
```
YouTube dışında SDK script'i 404 verir; oyun yine de normal çalışır (SDK çağrıları güvenli sarmalanmıştır).

## YouTube Playables'a yükleme (resmi adımlar)
1. Kanalın Playables'a **onboard** edilmiş olmalı (erişim/davet gerekir).
2. `playable-game/` klasörünü **ZIP**'le (kökte `index.html` olacak şekilde).
3. [Playables Developer Portal](https://developers.google.com/youtube/gaming/playables/developer_portal) → **Add a new game**.
4. Başlık, tür, açıklama + ZIP + kapak görselleri + monetizasyon.
5. **Create release** → **Verify and test** (web/Android/iOS test) → **Submit for Certification**.

## Uygulanan SDK çağrıları
- `firstFrameReady()` — ilk kare çizilince
- `gameReady()` — oyun oynanmaya hazır olunca
- `onPause()` / `onResume()` — arka plana alınınca duraklat
- `saveData()` / `loadData()` — en yüksek skoru kaydet

## Yapılacaklar (fikirler)
- [ ] Düşman/engel ekle
- [ ] Birden fazla bölüm
- [ ] Ses efektleri (`isAudioEnabled()` kontrolüyle)
- [ ] Skor tablosu
