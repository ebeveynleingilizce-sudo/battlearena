# Kritik soru/skill görünürlüğü düzeltmesi

## Kanıtlanan kök nedenler
1. Mobil 390×844 viewport'ta eski soru paneli y=652.6–972.6, skill paneli y=986.6–1473 idi. Üç kart DOM'da vardı, ancak tamamen ekran dışında kalıyordu. Masaüstünde kartlar dar sağ sütunda dikeydi; aşağıdaki kartlara kaydırmak gerekiyordu. Normal akışta yer alan panellerin görünürlük garantisi yoktu.
2. İlk soru 12 saniye bekliyordu. XP kaynaklı bekleyen skill hakları oluşunca soru paneli seçenekleri gizliyordu; kalan süre tüketiliyor ve soru daha sonra yeniden sunuluyordu. Bu, kısa maçta soru oynanışını uzun süre görünmez yapabiliyordu.
3. Skill ve soru panelleri ayrı takım seçimleri kullanıyordu. Skill tarafı diğer takımın level-up olayında takımı otomatik değiştirebiliyordu. Oyuncunun sorusu ile kartları aynı takımda olmayabiliyordu; herhangi bir takımda hak varsa panel açılıyordu.
4. Savaşın erken bitmesi (önceki varsayılan denemede ~57.5 sn) görünürlük sorununu büyütüyordu; XP/level-up/soru üretiminin çalışmamasının nedeni değildi. Denge/maç değerleri bu düzeltmede değiştirilmedi.

XP kazanımı, level-up, bekleyen hak, üç farklı seçenek, DOM bağları çalışıyordu: eski mobil tarayıcı ölçümünde LV2/LV3 ve 3 kart doğrulandı. Sorun çözümü XP verme veya elle level yükseltme üzerinden yapılmadı.

## Düzeltmeler
- İlk soru sabit simülasyon zamanında tam 3 saniyede. Sonraki planlı turlar 15,27,... saniye; cevap süresi 10 sn.
- Tek yerel oyuncu adaptörü: mavi/kırmızı seçimi soru ve skill UI tarafından paylaşılır. Kullanıcı seçimi otomatik değişmez. Sunucu oyuncu kimliğine dönüştürülebilir.
- Ortak ekran altı sabit panel, z-index 20. Seçilen takımın skill hakkı varsa soru panelinin yerini üç yatay kart alır. Kartlarda mevcut AbilityIcon ikonları, ad, açıklama ve rank; Kenney Adventure görselleri kullanılır. Mobilde kompakt üç sütun, dokunmatik seçenekler ve viewport sınırı.
- Skill açıkken yalnızca soru/geri bildirim süresi korunur. Aynı aktif soru kimliği ve seçenekleri saklanır; deadline her blocked tick için bir tick uzatılır. Savaş, maç saati, üretim, atış ve hasar hiç durmaz. Açık soru yeni planlı tur tarafından ezilmez.
- Kart seçimi sonraki sabit tickte gerçek takım istatistiklerini değiştirir; seçilen hak tüketilir ve panel kapanır. Birikmiş başka seviye hakkı varsa onun üç kartı gösterilir. Aktif ikon/rank HUD'da; seçilen takımın gerçek hasar/ateş/can/üretim/çift atış/yanma değerleri görünür.
- Dev-only ileri alma kontrolleri gerçek savaş ticklerini tekrarlar; simülasyona XP, level veya skill hakkı eklemez. Soru ileri alma bekleyen skill varken işlemez. Bu kontrollerin işlem kodu üretim JS'ten kaldırılır; üretim HTML'deki kontroller hidden kalır.

## Gerçek tarayıcı testleri
### Mobil 390×844
- Normal URL ve restart sonrası 3. saniyede potato sorusu görünür ve tıklanabilir oldu.
- Patates doğru cevap: yeşil geri bildirim, Shield 8 sn, bonus sayısı 1 ve simülasyon bitiş ticki 345. Takım XP'si hâlâ 0/40: cevap XP vermedi.
- Takım kırmızıya çevrildi: makas sorusunda pen seçildi; kırmızı pen, doğru scissors ve Türkçe açıklama göründü. Yanlış cevap bonus vermedi.
- Gerçek savaş replay'i ile kırmızı 40 XP / Level2; üç farklı kart açıldı. Panel y=584.5–836: 844 px ekranın içinde, üç kart yatay ve tıklanabilir.
- Fire Bullets seçildi: panel kapandı, HUD ikon rank1, gerçek yanma istatistiği 0→2/sn.
- Yeni gerçek öldürmelerle 100 toplam XP / Level3 ve üç yeni seçenek açıldı. Fire Bullets rank2 seçildi: yanma 2→4/sn.
- Ayrı mobil akışta mavi Double Shot seçimi %0→%20 olarak doğrulandı; kırmızının iki bekleyen hakkı mavi soru/atış akışını kilitlemedi.
- Yatay taşma yok; ekran görüntülerinde arena ve üsler görünür.

### Masaüstü 1280×900
- Normal başlangıçta 3 saniyelik soru, doğru patates/Shield ve yanlış pen/scissors açıklaması gerçekten tıklandı/görüldü.
- Gerçek öldürmelerle Level2; üç yatay kart. Iron Army seçimi gerçek asker maxHP 100→115.
- Sonraki gerçek Level3'te üç kart yeniden açıldı. Heavy Bullets seçimi gerçek takım hasarı 10→11.5.
- Üç kartın y=777.2–851.8 sınırları eşit, panel y=684.1–888: tamamen 900 px viewport içinde.
- Skill açıkken soru remainingTicks=216, savaş ticki 993→1429 olduğu halde remainingTicks=216 kaldı. Bu sırada savaş/maç süresi ilerledi.
- Yenilenen kontrollü akışta seçim öncesi soru `3:1:q2`, remaining=216, tick=540; seçim sonrası aynı `3:1:q2`, remaining=202, tick=559. Kalan 14 tick yalnızca tekrar cevaplanabilir olduktan sonra tüketildi. Aynı bird sorusu geri geldi; içerik/kimlik kaybolmadı.
- Son temiz masaüstü test sekmesinde error/warn console logları boş. Geliştirme sırasında ardışık dosya değişikliklerinin eski açık sekmede oluşturduğu geçici HMR hataları son temiz testte görülmedi.

Level-up testlerinde izin verilen geliştirici ileri alma kontrolü kullanıldı. Kontrol yalnızca gerçek çatışmayı hızlandırdı; XP ödülleri gerçek enemy death yolundan geldi. İlk soru/doğru/yanlış testleri normal URL'de gerçek zamanla yapıldı.

## Otomatik test ve build
`npm test`: **52/52 başarılı**. Önceki savaş/skill/bonus testleri, uzun simülasyon stres testleri, 15/30/60/144 FPS eşdeğerliği korundu. Yeni/uyarlanan testler: 3 saniyelik ilk soru; uzun skill çakışmasında aynı aktif kimlik ve kalan tick bütçesi; rakibin bekleyen haklarının diğer takımın cevabını/atışlarını/saati kilitlememesi.
`npm run build`: başarılı (26 modül). Uygulama 103 kB / gzip32.33, CSS14.05 kB; mevcut Three 549.77 kB chunk uyarısı engelleyici değil.
Üretim JS'te qa-next-level / qa-next-question / qa-question / qa-ui işlem dalları bulunmuyor.

## Değiştirilen dosyalar
- `src/local-player.js` (yeni): ortak yerel oyuncu takım kimliği.
- `src/config.js`: questionFirstSeconds=3.
- `src/questions.js`: soru bütçesinin skill sırasında korunması ve açık sorunun yeni tur tarafından değiştirilmemesi.
- `src/skill-ui.js`: ortak takım, ilgili takımın kartları, belirgin LEVEL UP, HUD/stat güncellemesi.
- `src/question-ui.js`: ortak takım, panel önceliği, bonus/süre doğrulama verileri.
- `src/main.js`: ortak oyuncu adaptörü ve dev-only gerçek tick replay kontrolleri.
- `index.html`: açık takım seçimi, istatistikler ve dev kontrolleri.
- `src/style.css`: sabit alt panel, üç yatay kart ve responsive görünürlük.
- `tests/questions.test.js`: zamanlama/çakışma/rakip hak regresyonları.
- `README.md`: güncel kullanım ve çakışma politikası.

## Kanıt görüntüleri
`fix-mobile-correct.jpg`, `fix-mobile-wrong.jpg`, `fix-mobile-three-cards.jpg`, `fix-mobile-second-level.jpg`, `fix-mobile-skill-applied.jpg`, `fix-desktop-correct.jpg`, `fix-desktop-three-cards.jpg`, `fix-desktop-skill-applied.jpg`.

Multiplayer, yeni mekanik, veritabanı veya asset paketi eklenmedi. Canlıya yayınlanmadı; Aşama5 başlamadı. Mobil kontrol tarayıcı viewport simülasyonu, fiziksel cihaz testi değil.
