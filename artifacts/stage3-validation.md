# Aşama 3 doğrulama ve değişiklik raporu

14 Ekim 2026. Yalnızca yerel geliştirme; canlıya yayınlama yok.

## Sonuç

36 otomatik test geçti: önceki 13 savaş testi ve 23 XP/skill testi.

| İstenen kontrol | Doğrulama |
| --- | --- |
| Düşman ölümü XP verir | Her gerçek lethal düşman hasarı +20 XP, öldüren takım |
| Aynı düşman iki kez XP vermez | Tekrarlanan hasar ve aynı tick'teki iki lethal mermi: bir ölüm, bir XP ödülü |
| Üs hasarı XP vermez | Doğrudan üs hasarı, yanma/zincir filtreleri ve yaralama testi |
| Seviye eşikleri | 40/100/180/280/400; sonraki 540/700/880 ve değiştirilebilir büyüme |
| Üç geçerli teklif | Seeded, farklı ve mevcut havuzdan; max skill hariç; haklar sıra ile |
| Skill rank sınırı | Sekiz skill üçer rank; 24 yükseltme; max rank tekrar önerilmez |
| Gerçek savaş etkileri | Ateş aralığı, gerçek mermi hasarı, HP oranı/yeni asker, ikinci mermi, yanma, gerçek hasardan iyileşme, zincir ve üretim hızı |
| Sekonder hasar XP sahipliği | Yanma, saldıran kaldırıldıktan sonra bile kendi takımı; zincir iki ayrı öldürmeyi doğru takımda toplar |
| Bağımsız takımlar | Ayrı XP, skill, teklif RNG'si ve seçim hakları; tarayıcıda mavi Double Shot / kırmızı Fire Bullets |
| Reset | XP=0, Level=1, skill=0, queue boş; eski maç komutları reddedilir |
| Bekleyen haklar savaşı durdurmaz | Süre, atış, hasar ve üretim sürer; tarayıcıda kart seçimi sırasında da doğrulandı |
| Komut doğrulaması | Takım ve trusted caller kimliği, maç nesli, sıradaki hak, teklif ID'si, rank; çift kuyruk ve tekrar paket reddi |
| FPS bağımsızlığı | Skill komutları dahil 15/30/60/144 FPS aynı snapshot üretir |
| Uzun simülasyon | 30 dakika / 54.000 tick, asker≤10/takım, sabit mermi havuzu, pending≤24, command history≤16 |
| Görsel kaynak kararlılığı | Tüm sekiz skill rank 3, 8 × 300 saniye / 72.000 tick; bütün elemental efektler ve reset |
| Mobil arayüz | 390 × 844 gerçek viewport ölçümü, yatay taşma yok, iki takım seçimi ve aktif ikonlar |
| Üretim derlemesi | Başarılı; QA sayfası ve qa-ui başlangıç düzeneği üretimde yok |

## Görsel stres ölçümleri

Her sekiz maçta kaynak sayıları aynı kaldı:

- 16 aktör, 95 GPU geometri, 101 doku, 10 shader programı.
- Maç başına 82 ölüm, 2866 üs isabeti.
- 2436 ikinci mermi, 439 yanma isabeti, 310 zincir isabeti ve yaklaşık 5882 gerçek iyileşme.

GPU testinde yüksek HP ve hazır ilerleme test verisi kullanılır; bu hazırlık yalnızca
ayrı QA düzeneğindedir. Normal oyunda ve `?qa-ui` seçim testinde XP gerçek öldürmelerden gelir.
`?qa-ui` yalnızca geliştirmede 18 saniyelik gerçek savaş tick'lerini hızlandırır.

Temel denge: maksimum üç rank'ta tek skill için ateş/hasar/can en fazla +%45,
üretim +%30, ikinci mermi %60, can çalma %15. Yanma rank 3'te 6/sn ve
3 saniyedir; birikmez. Zincir bir ek hedef, %25 şans ve %75 mermi hasarıyla sınırlıdır.
Tek rank-3 skill'in bir saldırısı ve devam eden yanması tam canlı bir askeri
tek döngüde öldürmez; testte en az 70 HP kalır. Bu temel güç sınırı testidir,
kapsamlı rekabetçi dengeleme testi değildir.

## Önemli uygulama kararları

- Toplam XP saklanır; HUD seviyenin ilerlemesini gösterir.
- Mevcut asker HP yüzdesi Iron Army ile korunur. Canlı askerler ve yeni doğanlar aynı takım buff'ını kullanır.
- Merminin değerleri atıldığı anda sabitlenir; seçim sonraki saldırıları güçlendirir.
- Yanma birikmez ve tekrar uygulanması hasar pulse'larını ertelemez.
- Yanma/zincir yeni elemental proc başlatmaz; sonsuz zincir oluşmaz.
- Havuzda en sonunda 1–2 yükseltilebilir skill kaldığında yalnızca onlar gösterilir.
  Üç farklı geçerli skill kalmadığında sahte veya max seviyeli kart üretilmez.
  Tüm skill'ler max olduğunda yeni boş hak oluşturulmaz.
- İlk kullanıcı etkileşimi ses oynatmayı açar; ses düğmesiyle kapatılabilir.
- Yerel iki takım paneli test içindir. Gelecekte trusted takım kimliğini sunucu oturumu belirlemelidir.

## Değişen dosyalar

Yeni kaynak modülleri:

- `src/progression.js`: XP, eşikler, hak sırası, seeded teklifler ve seçim doğrulaması.
- `src/skills.js`: skill tanımları, denge ve takım stat hesapları.
- `src/skill-ui.js`: XP HUD, üç kart, aktif ikonlar, seçim bildirimi ve iki takım test paneli.
- `src/audio.js`: Kenney seviye/seçim sesleri ve voice havuzu.
- `tests/progression.test.js`: 23 yeni otomatik test.

Güncellenen kaynaklar:

- `src/config.js`: XP ayarları, teklif seed'i, lightning/command havuz sınırları.
- `src/simulation.js`: komut kuyruğu, ortak hasar/ölüm/XP yolu ve sekiz skill.
- `src/battle-view.js`: maxHP barı, yanma sprite'ı ve skill olayları.
- `src/effects.js`: sprite kaynakları, iyileşme/yıldırım havuzları, ikinci mermi vurgusu.
- `src/battle-ui.js`: ondalık HP görünümü.
- `src/main.js`: skill/audio bağlantısı ve üretimden çıkarılan yerel UI test düzeneği.
- `src/style.css`, `index.html`: XP/skill arayüzü ve mobil yerleşim.
- `tests/simulation.test.js`: reset testi yeni maç neslini doğrular.
- `tests/browser-harness.js`, `qa.html`: bütün skill efektleriyle stres testi.
- `package.json`, `package-lock.json`: proje sürümü 0.3.0; yeni bağımlılık yok.
- `README.md`: Aşama 3 kapsamı, çalışma şekli ve test talimatları.

Eklenen assetler:

- `public/assets/skills/`: sekiz orijinal AbilityIcon PNG'si ve `SOURCES.md` eşleme kaydı.
- `public/assets/ui/`: iki Kenney SVG'si ve kaynak lisansı.
- `public/assets/vfx/`: dört Torch karesi ve Heal görüntüsü.
- `public/assets/audio/`: iki Kenney OGG ve kaynak lisansı.
- `artifacts/stage3-*`: görsel kanıtlar ve stres/test raporları.

Orijinal ZIP ve Quaternius glTF dosyaları korunmuştur; internet asseti indirilmedi.

## Sınırlar

Uzun testler hızlandırılmıştır. Fiziksel telefon, kapsamlı heap profili veya saatler
süren gerçek zamanlı FPS profili yapılmadı. Test edilen kaynak havuzlarında büyüme yok.
Three.js vendor parçasının 500 kB uyarısı mevcut, üretim derlemesini engellemiyor.
İngilizce soru, multiplayer, veritabanı eklenmedi. Sonraki aşama onay bekler.
