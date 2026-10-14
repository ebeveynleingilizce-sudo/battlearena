# Aşama 4.6 — Tek cihazda iki oyuncu (Hot-seat)

Durum: Tasarım / uygulama bekliyor. Multiplayer ve sunucu yoktur.

## Oynanış sözleşmesi

- Mavi ve kırmızı oyuncu tek akıllı tahta veya telefonda sırayla cevaplar ve skill seçer.
- 3D savaş, asker üretimi, XP ve üs hasarı her zaman aynı 30 Hz simülasyonunda devam eder.
- Sırası gelmeyen oyuncunun **soru süresi ve skill seçme süresi** ilerlemez; bu yalnızca hot-seat modunda geçerlidir. Zamanı korumak için soru/skill deadline alanları simülasyon seviyesinde yönetilmeli, yalnızca DOM gizlemek yetmez.
- Her oyuncunun soru hakkı ayrı sayılır. 3/15/27... soru planı, bekleyen tur sayısı sınırı ve 10 saniyelik cevap bütçesi bozulmamalıdır.
- Aktif oyuncunun bekleyen skill hakkı varsa öncelikle skill gösterilir. Skill bitince aynı oyuncunun açık sorusuna dönülür. Sorusu yoksa sıradaki oyuncuya geçilir.
- Bir oyuncu cevapladığında veya cevap süresi dolduğunda sıra diğerine geçer. Aynı oyuncunun arka arkaya sınırsız hak almasını engelle.
- Takımların soru/skill RNG'si ve öldürmeden gelen XP'si birbirinden bağımsız kalır.
- Maç 300 saniyede veya üs yıkımıyla biter; aktif panel sonucu örtmemeli.
- Eski manuel takım seçimi geliştirme/test modu olarak korunur. Hot-seat normal oynanışta varsayılandır.
- Manuel oyuncu seçimlerinin takım kimliği simülasyon tarafından doğrulanmaya devam eder.

## Ekran

- Her an belirgin “SIRA MAVİDE / SIRA KIRMIZIDA” ve kalan süre.
- Akıllı tahta: geniş cevap alanları, dokunmatik hedefler en az 48 CSS px, uzaktan okunabilir yazı.
- Telefon: 390×844 dikey ve yatay düzen; 3D arena görünür, soru/skill kartları kaydırılabilir, yatay taşma yok.
- Sıra değişimi için 1 saniyelik görsel bildirim olabilir; savaş saati veya soruların 10 saniyelik bütçesi bu bildirim yüzünden kısalmamalı.
- Erişilebilir klavye odakları ve kontrast.

## Test kabul koşulları

1. Aynı seed + komutlar aynı sonucu verir; 15/30/60/144 FPS tutarlı.
2. İnaktif takım soru deadline'ı ve skill deadline'ı azalmaz; aktif takımın azalır.
3. 3. saniye açılan sorudan sonraki sıra adil; iki takım da soru alır.
4. Skill/soru çakışması soruyu kaybettirmez; geri dönünce aynı soru kimliği ve tam kalan süre.
5. Otomatik skill seçimi yalnızca aktif oyuncunun süresi dolduğunda olur.
6. 390×844, 1280×900 ve akıllı tahta 1920×1080 tarayıcı testi.
7. `npm test` ve `npm run build` başarılı.
8. Mevcut 69 test ve normal simülasyon davranışları korunur.

**Uygulama notu:** `src/questions.js`, `src/progression.js` ve `src/simulation.js` üzerinde testle doğrulanan hot-seat zamanlayıcısı; `src/local-player.js` ve `src/main.js` üzerinde otomatik sıra kontrolü; `src/question-ui.js`, `src/skill-ui.js`, `src/style.css` ve `index.html` üzerinde görünüm gerekir.
