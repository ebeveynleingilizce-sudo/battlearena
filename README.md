# English Battle Arena — Aşama 3

Three.js + Vite ile izometrik 3D otomatik savaş, takım XP'si ve roguelike skill seçimleri.
Yalnızca yerel geliştirme; yayın, İngilizce soru, multiplayer veya veritabanı yoktur.

## Çalıştırma

Node.js 20.19+ veya 22.12+ gerekir.

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

Yerel oyun: http://127.0.0.1:5173/

Yerel görsel stres testi: http://127.0.0.1:5173/qa.html

Yerel seçim arayüzü testi: http://127.0.0.1:5173/?qa-ui
Bu geliştirme düzeneği oyunun ilk 18 saniyesini gerçek sabit adımlı savaş tick'leriyle
hızlandırılmış tekrar oynatır. XP eklemez, gerçek öldürmelerden kazanılan seçimleri açar.
Bu dal üretim derlemesinden çıkarılır; normal oyun her zaman 05:00 / Level 1 / 0 XP başlar.

## Savaş ve ilerleme

Aşama 2 davranışı korunur: üçer askerle başlangıç, otomatik doğma/ilerleme/hedef/ateş,
6 saniyede bir üretim ve en fazla 10 canlı asker. Temel değerler: üs 1000 HP,
asker 100 HP, hasar 10, ateş 1/sn, menzil 6, en fazla 300 saniye.
Maç üs yıkımı veya süre sonunda biter; eşit HP beraberliktir. Ölü asker 2.5 saniyede
havuzuna döner. Yeniden başlatma savaş ve ilerlemeyi sıfırlar.

Her takım Level 1 ve 0 toplam XP ile başlar. Bir düşman askeri öldürmek +20 XP verir.
Üs hasarı, yaralama ve aynı ölümün tekrarı XP vermez. Doğrudan, ikinci mermi,
yanma ve zincir öldürmeleri tek hasar/ölüm yolundan doğru takıma yazılır.
Saldıran asker sonradan ölse bile uçan mermi veya yanma öldürmesinin takım kimliği korunur.

Toplam eşikler: Level 2 = 40, 3 = 100, 4 = 180, 5 = 280, 6 = 400.
Sonrasında bir önceki artışa her seviyede 20 eklenir: 7 = 540, 8 = 700, 9 = 880.
Eşik tablosu, büyüme ve öldürme XP'si `src/config.js` içindedir.
XP barı içinde bulunulan seviyenin ilerlemesini; geliştirme paneli toplam XP'yi gösterir.

Her seviye bir seçim hakkıdır. Üç farklı, seed ile belirlenen geçerli skill sunulur.
Haklar sırayla kullanılır; sonraki teklif sıra kendisine geldiğinde üretilir.
Maksimum rank'a ulaşan skill yeni tekliflerde görünmez. Skill başına maksimum rank 3,
takım başına toplam 24 yükseltme vardır. Matematiksel olarak son havuzda yalnızca 1–2
skill kaldığında kart sayısı kalan geçerli skill sayısına iner; tekrar eden veya
max seviyedeki sahte seçenek gösterilmez. Havuz tamamlanınca yeni boş hak oluşturulmaz.
XP/level artmaya devam edebilir; bekleyen haklar 24 ile sınırlıdır.

Skill seçimi savaşı veya maç süresini durdurmaz. İki takımın XP, skill, bekleyen hak ve
teklif RNG durumları bağımsızdır. Yerel geliştirme panelinden her iki takımın hakları
ayrı ayrı test edilir; panel XP veya bedava skill eklemez.

## Sekiz skill

| Skill | Rank başına / varsayılan etki |
| --- | --- |
| Rapid Fire | +%15 ateş hızı; üç rank +%45 |
| Heavy Bullets | +%15 mermi hasarı; üç rank +%45 |
| Iron Army | +%15 maksimum asker HP'si; mevcut can yüzdesi korunur, yeni askerler aynı maksimumla doğar |
| Double Shot | +%20 gerçek ikinci mermi ihtimali; üç rank %60 |
| Fire Bullets | Rank başına 2 hasar/sn, 3 saniye yanma; birikmez, güçlü yanma korunur ve süre yenilenir |
| Life Steal | Rank başına gerçek hasarın %5'i; overkill sayılmaz, maksimum HP aşılmaz, ölü saldıran iyileşmez |
| Chain Lightning | %25 ihtimalle 3 birimdeki bir ek düşmana rank başına mermi hasarının %25'i |
| Quick Reinforcement | +%10 üretim hızı; süre 6/(1 + 0.1×rank), mevcut üretim ilerlemesi korunur |

Bonuslar toplamsal rank çarpanıdır. Skill dengesi `src/skills.js` içindeki
`SKILL_BALANCE` üzerinden ayrı tutulur; `BATTLE_CONFIG.skillBalance` ile etkiler değiştirilebilir.
Can, ateş ve üretim buff'ları mevcut/yeni askerler için ortak takım istatistiği kullanır.
Havada olan merminin hasarı ve skill parametreleri atıldığı anda sabitlenir;
yükseltme sonraki saldırıları etkiler. Yanma ve zincir ikincil hasarı yeni elemental
proc başlatmaz; sonsuz tetikleme zinciri yoktur. İyileşme gerçek hasardan hesaplanır.

## Mimari ve komutlar

- `src/simulation.js`: DOM/Three.js olmadan 30 Hz savaş, hasar, proc, ölüm ve XP.
- `src/progression.js`: toplam XP, eşikler, seçim sırası ve takım bazlı seeded teklifler.
- `src/skills.js`: sekiz skill, yapılandırılabilir denge ve türetilmiş takım istatistikleri.
- `src/fixed-loop.js`: FPS'ten bağımsız tick zaman biriktiricisi; yavaş karelerde tick atılmaz.
- `src/battle-view.js`, `src/effects.js`: modeller, animasyonlar, yanma sprite'ları ve havuzlu efektler.
- `src/skill-ui.js`, `src/battle-ui.js`: HUD, kartlar, iki takım geliştirme paneli ve maç sonucu.
- `src/audio.js`: yerel Kenney sesleri, sınırlı voice havuzu, ses aç/kapat.
- `src/main.js`: görsel sahne, kamera ve simülasyon bağlantısı.

UI aşağıdaki komutu simülasyon kuyruğuna gönderir:

```js
simulation.enqueueCommand({
  type: 'selectSkill',
  matchID: simulation.matchID,
  team: 0,
  choiceID: right.id,
  skillID: 'rapid-fire'
}, trustedTeamID);
```

Komut sabit tick başında uygulanır. Takım, maç nesli, sıradaki hak, teklif içeriği
ve rank doğrulanır. Kuyruğa aynı hak ikinci kez kabul edilmez; işlem sırasında da
tekrar doğrulanır. Reset maç neslini artırarak önceki maç komutlarını reddeder.
Komut sonuçları 16 kayıtla sınırlıdır. Gelecekte `trustedTeamID` sunucunun doğruladığı
oyuncu oturumundan gelmelidir; bu yerel geliştirme aşamasında iki takım da test edilebilir.
Bu aşamada ağ veya kullanıcı kimlik doğrulama sistemi eklenmemiştir.

`snapshot()` ilerleme, RNG, komutlar ve savaş durumunu JSON olarak aktarır.
Aynı JavaScript çalışma ortamı ve aynı tick-komut akışında deterministik tekrar test edildi.
Farklı JavaScript motorlarında bit düzeyinde lockstep garantisi verilmez.

## Görsel ve ses

Quaternius karakter ve çevre kaynakları korunur. Idle, Run, Idle_Shoot, HitReact ve
Death klipleri kullanılır. AbilityIcon PNG'leri ve Kenney UI SVG'leri orijinal içerikle
ayrı asset klasörlerine çıkarıldı. Torch'un dört karesi yanma sprite animasyonu,
Heal efekti can çalma bildirimi için kullanılır. Yıldırım, mermi ve kısa parlamalar
hafif Three.js çözümleridir. Asset eşlemeleri `public/assets/skills/SOURCES.md` içindedir.

Mermi, küçük efekt, yıldırım ve iyileşme objeleri havuzlardan tekrar kullanılır.
Aktör başına tek yanma sprite'ı vardır; model başına materyal/tekstür çoğaltılmaz.
Sesler ilk kullanıcı etkileşiminden sonra çalışır; ses düğmesiyle kapatılabilir.
Tarayıcı otomatik oynatma kısıtları ilk etkileşim öncesi bildirim sesini engelleyebilir.

Aşama 1 Idle/Run laboratuvarı korunur. Yalnızca bu açıkça seçilen animasyon testi
savaşı duraklatır; normal skill seçimi duraklatmaz.

## Doğrulama

`npm test`: 36 test; önceki 13 savaş testi ve 23 ilerleme/skill testi.
XP sahipliği/tek ölüm, eşikler, üç seçenek, max rank, komut güvenilirliği, sekiz etki,
sekonder XP, bağımsız takımlar, restart, pending haklarla savaş ve 30 dakikalık stres doğrulandı.
Skill komutları dahil 15/30/60/144 FPS aynı durumu üretir.

Görsel stres: tüm skill'ler rank 3, yüksek HP test senaryosu, 8 × 300 saniye / 72.000 tick.
Her maç 2436 çift atış, 439 yanma isabeti, 310 zincir isabeti ve yaklaşık 5882 iyileşme işledi.
Kaynak sayıları her maçta sabit: 16 aktör, 95 geometri, 101 doku, 10 shader programı.

Mobil 390 × 844 viewport: yatay taşma yok; iki takımın ayrı seçimleri, ikonları ve
savaş devamı doğrulandı. Üretim derlemesi başarılıdır. Three.js vendor parçası için
500 kB boyut uyarısı derleme hatası değildir.

Ayrıntılar ve değişen dosyalar: `artifacts/stage3-validation.md`.
Uzun testler hızlandırılmıştır; fiziksel telefon, kapsamlı heap profili ve rekabetçi
oyun dengeleme testi yapılmadı. Test edilen kaynak havuzlarında büyüme görülmedi.

Sonraki aşama için kullanıcı onayı beklenir.


## Aşama 4 — İngilizce sorular ve geçici bonuslar

`src/data/questions.json`: beginner sınıfı, Animals / Food / School Objects ünitelerinden 10'ar soru (30 toplam). Her kayıt id, grade, unit, category, direction, prompt, options, answer ve explanation içerir. `validateBank` dört farklı seçenek, tek doğru cevap ve zorunlu alanları denetler. Çeviriler ve kategoriye uygun çeldiriciler elle kontrol edildi; testte ayrı sözlükle cevap eşleşmeleri doğrulanır. Yeni havuzlar aynı şemayla eklenebilir; `main.js` yüklenen havuzu simülasyona verir.

`src/questions.js` DOM/Three bağımsızdır. Takım başına ayrı RNG, karıştırılmış deste, aktif soru, zamanlayıcı, geri bildirim ve istatistikler tutar. İlk tur 3. saniyede, sonraki turlar 15/27/... saniyelerde başlar. Süre 10 saniyedir; erken yanıt yeni turu öne çekmez. Deste tükenmeden tekrar yoktur; yeni destenin ilk sorusu önceki destenin son sorusundan farklıdır. Tüm süreler sabit simülasyon tickleriyle ilerler.

Cevap komutu: `{type:'answerQuestion', team, matchID, questionID, option}`; `option` karıştırılmış seçenek dizisinin 0–3 indeksidir. `enqueueCommand(command, trustedActorTeam)` takım sahipliğini ayrı doğrular; aktif kimlik, süre, maç kimliği, seçenek ve tekrar kontrol edilir. Komut sonraki tickte yeniden doğrulanıp uygulanır. Son geçerli tickte kuyruğa alınıp süre sınırında işlenen cevap reddedilir.

Yerel prototipte iki takım da aynı tarayıcıdan seçilebilir. JSON doğru cevap anahtarları istemci paketindedir; gerçek multiplayer için havuz/anahtarlar yalnızca sunucuda tutulmalı, istemciye seçenekler ve yalnızca cevaplandıktan sonra açıklama gönderilmelidir. Yerel takım parametresi gerçek kimlik doğrulama sağlamaz.

Doğru cevap ödül sırası takım başına Shield → Attack → Reinforcement → Repair olarak döner. Shield 8 saniye üs hasarını %25 azaltır; Attack 8 saniye yeni atışın hasarını ve yanmasını %15 artırır (zincir mermi hasarından türetilir). Uçuşta bulunan mermiler ve daha önce uygulanan yanma mevcut değerlerini korur. Süreli bonuslar katlanmaz, bitiş ticki yenilenir. Repair +30 HP ve maksimum can sınırı; Reinforcement yer ve asker sınırı uygunsa 1 asker, üretim ilerlemesini tüketmez. Dolu/yer olmayan takıma bonus hakkı kaydedilir, asker kuyruğa alınmaz. Tüm değerler `src/config.js` dosyasındadır. Sorular doğrudan XP vermez; bonuslarla yapılan gerçek düşman öldürmeleri normal XP kazandırır.

Çakışma politikası (kritik düzeltme): seçilen takımın bekleyen skill hakkı varken skill paneli önceliklidir. Aynı soru id ve seçenekleri korunur; her sabit tickte soru deadline bir tick uzatılarak kalan cevap süresi tüketilmez. Skill seçilince aynı soruya kalan süreyle dönülür. Savaş, üretim, hasar ve maç sayacı devam eder. Açık soru planlı yeni turla değiştirilmez; o tur atlanır. Diğer takımın bekleyen hakları oyuncunun soru/skill panelini veya simülasyonu kilitlemez. Skill sırasında geri bildirimin kalan süresi de korunur. Maç sonunda skill arkasında kalmış açık soru cevapsız sayılmaz. Doğruluk = doğru / (doğru + yanlış + normal cevapsız).
`src/local-player.js` tek yerel oyuncu takımını yönetir; soru ve skill UI aynı kimliği kullanır, otomatik takım değiştirme yoktur. `src/question-ui.js` ekranın altına sabitlenmiş kompakt panelde dört dokunmatik seçenek, sayaç/çubuk, yeşil/kırmızı açıklama, aktif bonus süreleri ve özet gösterir. Aynı alanda öncelikli skill paneli üç yatay AbilityIcon/Kenney kartını gösterir. Paneller mobilde sayfa sonuna itilmez; yalnızca seçilen takımın bekleyen hakları gösterilir. Sonuç ekranı savaş sonucundan ayrı İngilizce performansını, kategori doğru/yanlış sayılarını gösterir.

Geliştirmede `?qa-question` gerçek savaşın ilk 3 saniyesini oynatarak ilk soruyu UI testine hazırlar; XP vermez ve üretim paketinden kaldırılır. Normal URL 05:00, sıfır XP/soru/bonus ile başlar. Önceki `?qa-ui` skill test akışı korunur.

Doğrulama: önceki 36 test + 16 soru/bonus testi = 52 başarılı test. 15/30/60/144 FPS eşdeğerliği, komut tekrarları, süre sonu, çakışma, bonus sınırları ve reset kontrol edildi. Tarayıcıda 390×844 ve 1280×900 görünüm, doğru/yanlış cevap geri bildirimi ve konsol denetlendi. Ayrıntılar `artifacts/stage4-validation.md`. Fiziksel telefon ve kapsamlı öğrenci/balans araştırması yapılmadı. Yerel prototip; yayın, hesap, veritabanı veya multiplayer eklenmedi.


## Kritik görünürlük düzeltmesi
Soru ve skill akışının gerçek tarayıcı kanıtları/kök nedenleri: `artifacts/critical-ui-fix-validation.md`. İlk soru 3 saniyede; tek takım seçimi; alt sabit panel; skill açıkken korunmuş soru süresi. Geliştirme modundaki soru/level-up ileri alma düğmeleri yalnızca gerçek savaş ticklerini çalıştırır; XP/skill hakkı veya ücretsiz ödül eklemez. Üretim JS içinde bu kontrollerin işlem kodu yoktur, HTML kontrolleri hidden kalır. Savaş değerleri ve XP öldürme kuralı değiştirilmedi.

## Aşama 4.5 — Güncel denge ve eğitim temposu

Önceki aşama bölümleri tarihsel uygulamayı anlatır; güncel değerlerde bu bölüm ve `src/config.js` geçerlidir. Üs 1000 HP, ilk 30 saniye koruma, ayrı üs hasarı 4, üretim 3 saniye, skill seçimi 6 saniye ve seeded otomatik seçim. İlk soru 3 saniye, planlı turlar 12 saniye aralıkla; skill sırasında soru süresi korunur. Tek bekleyen soru turu tutulur. Uygulanamayan bonus atlanarak yararlı seçenek verilir. Normal yeni maç yeni seed; DEV `?seed=NUMBER` tekrar testi sağlar.

500 aynı-seed senaryo karşılaştırmasında ortalama maç 1:05→4:40; %85 maç 4–5 dakika. Pasif takım yaklaşık16, aktif takım23–25 cevaplanabilir soru görür. XP yalnızca gerçek asker öldürmelerinden gelir. Sekiz skill/rank3 ve otomatik 3D savaş korunur. 69 test ve üretim derlemesi başarılı; masaüstü/mobil gerçek tarayıcı soru, kart, otomatik seçim ve sonuç akışları doğrulandı.

Detaylı sayılar, değişen dosyalar, ekran kanıtları ve sınırlamalar: [Aşama4.5 raporu](artifacts/stage45-balance-report.md). Doğrudan ateş build'i hâlâ elemental build'den güçlü; aktif senaryolarda süre dolumu yüksek. İnsan oyuncu/fiziksel telefon araştırması yapılmadı. Yayın, multiplayer veya Aşama5 eklenmedi.
