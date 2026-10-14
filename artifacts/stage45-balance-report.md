# Aşama 4.5 — Maç dengesi, tempo ve eğitim akışı

14 Ekim 2026. Yerel prototip tamamlandı; yayın veya Aşama 5 yapılmadı.

## Sonuç ve yöntem

Önceki ve yeni simülasyon için A–E senaryolarının her birinde aynı 100 seed kullanıldı (toplam 500+500 maç). Komutlar gerçek savaş ticklerinden, öldürmelerden ve soru cevaplarından üretildi; ücretsiz XP verilmedi. Eski kaynaklar `balance-baseline/` altında saklandı. Eski E için son karşılaştırılabilir elemental politikası `balance-old-E.json` içindedir; ilk `balance-old.json` E stratejisi farklı olduğundan o E sonuçları bu tabloda kullanılmadı.

A pasif (iki takım seeded otomatik skill seçer); B doğru cevap oranı 100/100; C 90/20; D 20/90; E 80/80, mavi doğrudan ateş, kırmızı elemental skill önceliği. Aktif botlar soruyu 2 saniyede, skill'i 1 saniyede seçer. Yüzdeler 10 soruluk deterministik politika hedefidir; kısa maçta gerçekleşen doğruluk farklı olabilir. Ölçümler insan oyuncu araştırması değildir.

| Senaryo | Eski ort. sn | Yeni ort./medyan sn | Yeni min–max sn | 240–300 sn % | 300 sn % | Mavi/kırmızı galibiyet % |
|---|---:|---:|---:|---:|---:|---:|
| A | 70.71 | 258.79 / 273.17 | 132.40–300 | 67 | 31 | 57/43 |
| B | 66.64 | 290.93 / 300 | 132.77–300 | 93 | 78 | 53/47 |
| C | 62.39 | 283.29 / 300 | 160.43–300 | 91 | 61 | 81/19 |
| D | 64.19 | 274.83 / 300 | 149.50–300 | 79 | 59 | 18/82 |
| E | 62.60 | 294.69 / 300 | 171.13–300 | 95 | 91 | 79/21 |

Toplam ortalama 65.31 saniyeden 280.51 saniyeye (4:40.5) çıktı. Yeni maçların %85'i 4–5 dakika aralığında, %36'sı üs yıkımıyla, %64'ü süreyle bitti. 60 saniyeden önce biten yeni maç yok; eski A/B/C/D/E oranları %33/%39/%52/%40/%46. Her maçın 4 dakika sürmesi garanti edilmez.

| Senaryo | Cevaplanabilir soru M/K | Doğru M/K | Yanlış M/K | Level-up M/K | İlk öldürenin kazanması % | Son dakika dönüşü / uygun maç |
|---|---:|---:|---:|---:|---:|---:|
| A | 16.07/16.14 | 0/0 | 0/0 | 11.53/11.42 | 48 | 11/67 |
| B | 24.28/24.28 | 24.26/24.26 | 0/0 | 12.47/12.54 | 50 | 29/93 |
| C | 23.69/23.69 | 21.71/5.78 | 1.92/17.85 | 11.68/12.19 | 50 | 23/91 |
| D | 23.01/23.01 | 5.54/21.18 | 17.43/1.79 | 11.89/11.45 | 43 | 22/79 |
| E | 24.58/24.58 | 20.61/20.61 | 3.95/3.95 | 12.93/12.49 | 46 | 7/95 |

Eski cevaplanabilir soru ortalamaları A 1.15/1.15, B 5.58/5.67, C 5.25/5.35, D 5.41/5.49, E 5.36/5.42; eski level-up yaklaşık 2–3'tü. İlk öldürenin eski kazanma oranı yaklaşık %69–77'ydi. Yeni toplam son dakika dönüşü 92/500 (%18.4); uygun 425 maç içinde %21.65. Dönüş: 240. saniyede üs HP'si gerçekten daha düşük olan takımın finalde kazanması; eşitlik ve 240'tan önce biten maçlar uygun sayılmaz. Bu olasılık örneklemdir, her seed için garanti değildir.

Ham JSON her maçın seed, sonuç, sayaçlar ve 15 saniyelik HP/asker/XP/level/atış zaman çizelgesini içerir. `shown/available` simülasyonun açtığı/cevaplanabilir yaptığı soru sayısıdır. Gerçek DOM'da görülen sorular UI tarafından ayrıca sayılır; hızlandırılmış testte mantıksal açılan tüm soruların insan tarafından görülmüş olduğu iddia edilmez.

## Uygulanan denge

Üs HP 1000 korundu. İlk 30 saniye üs hasarı kapalı, asker savaşı ve öldürme XP'si açık. Asker hasarı 10; ayrı üs hasarı 4; üs saldırı menzili 8, asker menzili 6. Doğrudan ateş skill'lerinin üs DPS çarpanı 1.5 ile sınırlı; asker etkileri korunur. Üretim 3 saniyede bir, en fazla 10 asker/takım. İlk 3 asker için seeded başlangıç ateş gecikmesi bulunur.

Askerler menzildeki yaralı düşmanı önceliklendirir, hedef başına en fazla 3 asker odaklanır; diğerleri ilerleyebilir. İki taraf kendi üssünün 3 birim çevresinde aynı savunmadan yararlanır: başlangıçta %60 hasar azaltma, 30–300 saniye arasında doğrusal olarak sıfıra iner. Bu HP farkına veya kaybeden takıma göre verilen yapay ödül değildir.

Sekiz skill ve rank 3 sınırı korundu. Iron Army rank başına %20 can; Fire Bullets rank başına 4/sn, 3 saniye; Chain Lightning %35 tetikleme ve rank başına %40 mermi hasarı. Diğer skill oranları korunur. Sayılar tek yapılandırma dosyasındadır.

## Soru ve skill akışı

İlk soru 3 saniye, sonraki planlı turlar 15/27/...; dört cevap, 10 saniye süre, 2 saniye geri bildirim. XP yalnızca düşman asker öldürmelerinden gelir. Skill sırasında savaş sürer; aynı soru kimliği/seçenekleri ve kalan süre korunur. Çakışan turlar için en fazla bir bekleyen güncel tur tutulur; birikmiş sınırsız soru kuyruğu yoktur. Takım değiştirme DOM'u hemen yeniler.

Skill süresi 6 saniye; dolunca ayrı seeded RNG ile sunulan üç karttan biri seçilir. Manuel seçim sınır tickinde otomatik seçime önceliklidir. Kuyruktaki sonraki hak kendi tam süresini alır.

| Pasif A, 100 aynı seed | Ort. maç sn | Soru M/K | Süre dolumu % |
|---|---:|---:|---:|
| 6 sn | 258.79 | 16.07/16.14 | 31 |
| 8 sn | 259.36 | 14.24/14.30 | 38 |
| 10 sn | 263.66 | 12.56/12.62 | 40 |

6 saniye, pasif maçta da 15–25 soru hedefini karşılamak için seçildi. B–E botları 1 saniyede seçim yaptığından bu karşılaştırma özellikle A üzerinde yapıldı.

Doğru cevap uygulanabilir bonusu deterministik döngüden bulur. Tam HP'de repair, dolu/yer olmayan orduda reinforcement ve koruma içinde tüm süresi tükenecek shield atlanır; attack fallback vardır. Süreli etkiler katlanmaz, süre yenilenir. İlk doğru cevap böylece koruma altında boşa shield vermek yerine 8 saniyelik Attack sağlar. Yanlış cevap doğru seçenek ve kısa açıklamayı gösterir.

Normal başlangıç/restart yeni crypto seed kullanır. DEV `?seed=NUMBER` tekrar üretilebilir test sağlar; üretimde bu kontrol yok. Simülasyon sabit 30 Hz, görsel katmandan ayrıdır. Aynı seed+komutlar için FPS bağımsızlığı doğrulandı; farklı sunucu JS/runtime'ları arasında henüz ağ determinismi sertifikası değildir.

## Tarayıcı doğrulaması

1280×900 ve 390×844 normal URL'de: ilk soru 3 saniyede; doğru cevap Attack ve sıfır XP; yanlış cevap açıklaması; gerçek öldürmelerden level-up; üç kart ve ikonlar; geri sayım; otomatik seçim; HUD ve gerçek asker/üs DPS değişimi; sonraki level-up; korunmuş soruya dönüş doğrulandı. Desktop aynı soru kimliği korunarak skill sonrasında devam etti. Mobil Rapid Fire otomatik seçimi ateşi 1.00→1.15/sn ve üs DPS'yi 4.0→4.6 yaptı. Her iki boyutta savaş paneller sırasında sürdü, konsol hata/uyarı kaydı boştu. Mobil yatay taşma yok.

Desktop 29. saniyede iki üs 1000 HP, koruma 1 sn; 30'da hasar açıldı. Mobil gerçek tick replay ile 300 saniye ve HP karşılaştırmalı sonuç ekranı görüldü. Desktop ayrıca gerçek üs yıkımıyla sonuçlandı. Restart soru/XP/skill/bonus/sonuç ve seed'i sıfırladı/değiştirdi. Geliştirme düğmeleri yalnızca gerçek savaş ticklerini ilerletir; üretim paketinde işlem kodları bulunmaz. Hızlandırılmış testte ileri alma sırasında duvar saati iki kez sayılmıyor.

Kanıtlar: `stage45-desktop-question.jpg`, `stage45-desktop-timer.jpg`, `stage45-desktop-auto.jpg`, `stage45-desktop-result.jpg`, `stage45-mobile-question.jpg`, `stage45-mobile-timer.jpg`, `stage45-mobile-auto.jpg`, `stage45-mobile-result.jpg`.

69/69 test: eski 52 davranış testi ve 17 yeni denge/tempo testi. Eski testler açık eski config fixture'ıyla korunur; yeni config ayrı test edilir. 15/30/60/144 FPS, hasar/XP, 30 saniye sınırı, son tick manuel seçim, bağımsız RNG, reset, bonus uygulanabilirliği, sonuç eşitliği ve 500 maç audit kapsanır. Üretim derlemesi başarılı; Three.js vendor boyut uyarısı hata değildir. Havuzlar korundu. Bu aşamada yeni kapsamlı heap profili veya fiziksel telefon testi yapılmadı; hızlandırılmış simülasyon gerçek 5 dakikalık cihaz termal/FPS ölçümü yerine geçmez.

## Bilinen sınırlamalar

E'de doğrudan ateş build'i %79 kazanıyor. Renkler değiştirilerek ek 100 maçta aynı build kırmızıda %84 kazandı; üstünlük esas olarak build'i izliyor. Eşit aktif B'de 53/47; 100 seed renk yanlılığını kesin dışlamaz. Build çeşitliliği tamamen eşitlenmiş değildir. B %78 ve E %91 süre dolumuyla bitiyor; bütün maçlar zorla uzatılmıyor ama yüksek etkinlikte 5 dakika sınırına ulaşma oranı yüksek. Daha geniş insan testi sonraki denge çalışmasının konusu; bu aşamada saklı otomatik kazanma veya yapay comeback sistemi yok.

## Dosyalar ve tekrar üretme

Değişen uygulama dosyaları: `src/config.js`, `src/simulation.js`, `src/progression.js`, `src/questions.js`, `src/main.js`, `src/skill-ui.js`, `src/question-ui.js`, `src/local-player.js`, `src/battle-ui.js`, `src/style.css`, `index.html`. Testler: `tests/balance.test.js`, `tests/legacy-fixture.js`, önceki simulation/progression/questions test fixture bağlantıları, `tests/balance-runner.js`, `tests/balance-fairness.js`. README güncellendi. Sonuç HP metni bir ondalığa yuvarlanır.

```powershell
npm test
npm run build
node tests/balance-runner.js new 100 artifacts/balance-new.json
node tests/balance-runner.js old 100 artifacts/balance-old.json
node tests/balance-fairness.js
```

Veri dosyaları: `balance-new.json`, `balance-old.json`, karşılaştırılabilir eski E için `balance-old-E.json`, `balance-timer8.json`, `balance-timer10.json`, `balance-fairness.json`. Eski E'yi tekrar üretirken runner içindeki son E stratejisini eski baseline ile çalıştırın. Tuning ara çıktıları nihai oyun config'i değildir. Önizleme: http://127.0.0.1:5173/ .
