# YouTube Örnek Oyunlar

Kayrahan projesi için ilham/referans olarak incelenecek YouTube Playables (ve benzeri) oyun örnekleri.

## Linkler

1. https://www.youtube.com/playables/Ugkxto-OwJZo4rm8Xl2Nj3K403nHlYThf-sr
2. https://www.youtube.com/playables/UgkxuIJWZNF2yjYZBROSWi56ThCfkPWhf1BU
3. https://www.youtube.com/playables/UgkxxJFnJx0jogPkEtc1bICU4EL2rbUW8kE5
4. https://www.youtube.com/playables/UgkxUP2ow18nGLszSTR08Kg8z1RU1cGNUY_5
5. https://www.youtube.com/playables/UgkxAa2Gygx3bQRx4kOraVwUFW_3mO1tH0h5

---

## YouTube Playables Analizi (2026)

> **Veri notu:** Playables tarama sayfası (`youtube.com/playables`) tamamen JavaScript ile
> yükleniyor ve oyun başına gerçek izlenme/oynanma sayıları herkese açık bir API'de yok.
> Bu yüzden "en çok izlenen / tarihe göre" tam sıralama otomatik çekilemiyor. Aşağıdaki
> analiz, basın/derleme kaynaklarındaki **popüler/öne çıkan** oyunlara ve sektörün
> hyper-casual başarı ilkelerine dayanır.

### Öne çıkan / popüler oyunlar ve türleri
| Oyun | Tür | Neden tutuyor |
|------|-----|---------------|
| Adorable Home | Cozy / dekorasyon | Rahatlatıcı, stressiz, "geri gelme" hissi |
| Farm Land | Çiftlik simülasyonu | Basit ama bağımlılık yapan döngü |
| Find Out | Gizli nesne bulmaca | Merak + "bir tane daha" hissi |
| Thief Puzzle / Stealth Master | Bulmaca / gizlilik | Tek dokunuş çözüm, anlık tatmin |
| Magic Tiles 3 | Ritim / zamanlama | Tek dokunuş, refleks |
| Race Master 3D | Yarış / arcade | Hızlı, kısa tur |
| Cut the Rope, Angry Birds, 8 Ball, Solitaire | Klasikler | Tanıdık, anında anlaşılır |

**Baskın türler:** Cozy/rahatlatıcı, bulmaca/gizli-nesne, tek-dokunuş arcade (koşu/ritim/zamanlama), tanıdık klasikler.

### Başarı ilkeleri (hepsinde ortak)
1. **Anında anlaşılır** — kurallar saniyeler içinde kavranır, tutorial gerektirmez.
2. **Tek dokunuş / minimal kontrol** — özellikle mobilde tek parmakla oynanır.
3. **Kısa oturum** — bir tur < 1-2 dk; "boşlukta bir el at" hissi.
4. **Dengeli zorluk** — ne çok kolay ne çok zor; kademeli artar.
5. **Tatmin edici geri bildirim** — ses, titreşim, animasyon, parıltı.
6. **Tekrar oynatma kancası** — skor/en iyi skor, yıldız, günlük, toplama/biriktirme meta'sı.
7. **Paylaşılabilirlik** — skoru/sonucu paylaşma.

### Bizim oyuna / yol haritasına uygulanabilir çıkarımlar
Mevcut Kayrahan platform oyunumuz zaten birçoğunu karşılıyor (basit kontrol, kısa
bölüm, ses+titreşim, skor, en iyi skor). İleriye dönük **içerik artırma** için en
yüksek uyumlu yeni oyun fikirleri (hepsi çocuk-dostu, özgün, HTML5 canvas ile yapılabilir):

1. **Kayrahan Koşu (Endless Runner)** — otomatik koşu, **tek dokunuş zıpla**, engel/çukur atla,
   para topla, mesafe = skor. Playables'ın en tutan tek-dokunuş arcade kalıbı; mevcut
   karakter/sanat/motoru tekrar kullanır. **(En yüksek öncelik)**
2. **Bul Bakalım (Gizli Nesne)** — sevimli sahnede saklı eşyaları bul. Cozy + bulmaca; çocuklara uygun.
3. **Topla & Süsle (Cozy meta)** — bölümlerde toplanan parayla Kayrahan'a kostüm/oda süsü aç.
   Geri gelme (retention) kancası.
4. **Ritim/Zamanlama dokunuş oyunu** — tek dokunuşla doğru anda bas (Magic Tiles benzeri, özgün tema).
5. **Eşleştirme/Merge bulmaca** — basit emoji/şekil eşleştirme.

> Strateji: Playables tek büyük oyundan çok **birden çok küçük, anında oynanır oyunu** ödüllendiriyor.

### KARAR (kullanıcının bulduğu yüksek-oynanmalı örneğe göre)
Referans: **"Dessert DIY"** — `youtube.com/playables/Ugkx5iFcTcmiJFaj-5nMnXmpDh0cqrH3lTxi`
(kullanıcı **~63 milyon oynanma** gördü). Mekanik: bir tatlıyı (kek/dondurma) **dokunarak
süsle** (krema rengi seç, çilek/çikolata/şeker/yıldız ekle) → **servis et** → para kazan →
yeni süsleme malzemeleri aç. Rahatlatıcı, başarısızlık yok, çok yüksek tekrar oynanırlık.

➡️ **Yapılacak oyun: "Kayrahan'ın Tatlı Dükkânı" 🧁 (tatlı süsleme)**
- Dokunarak krema + süs ekle, servis et, para kazan, yeni süs/renk aç
- Çocuk-dostu, özgün (telifsiz), HTML5 canvas — Playables SDK uyumlu
- İlerleme `saveData` ile kalıcı
- Klasör: `playable-dessert/`

> Not: "Kayrahan'ın Evi" (cozy) prototipi denendi ama beğenilmedi, kaldırıldı.


