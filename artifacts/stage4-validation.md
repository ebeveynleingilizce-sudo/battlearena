# Aşama 4 doğrulama raporu

## Başlangıç kontrolü
Mevcut Aşama 3'ün 36 testi başarılıydı. Savaş, XP/skill komutları, reset ve sabit zaman adımı incelendi; engelleyici eksik/bozuk özellik bulunmadı.

## Tamamlananlar
- Animals, Food, School Objects kategorilerinden 10'ar soru: 30 toplam; 15 İngilizce → Türkçe, 15 Türkçe → İngilizce. Dört farklı seçenek ve tek doğru cevap. Türkçe yönerge/açıklama; grade/unit alanlarıyla genişletilebilir JSON.
- Takım başına ayrı seedli deste/karıştırma, 12 saniyelik tur aralığı ve 10 saniye cevap süresi. Komutlar maç/takım/soru/indeks/süre ve tekrar açısından iki aşamada doğrulanır.
- Deterministik Shield → Attack → Reinforcement → Repair ödülleri. Süreler ve miktarlar config dosyasında; süreli etkiler katlanmaz. Asker/can sınırları korunur. XP yalnızca gerçek düşman ölümünden.
- Kompakt ayrı panel, 48/52 px seçenekler, görsel sayaç, doğru/yanlış renkleri ve açıklama, bonus süresi, takım istatistikleri; sonuç ekranında ayrı İngilizce raporu.
- Skill önceliği: ilgili takımda bekleyen seçim varsa cevaplar gizlenir/reddedilir. Sayaç devam eder. Çakışan süre dolumu cezalandırılmaz; soru sonraki uygun planlı turda yeni kimlikle yeniden sunulur. Normal cevapsız sayılmaz ve iki kez gösterilmiş sayılmaz. Tur başında skill bekliyorsa yeni soru açılmaz. Diğer takım etkilenmez.

## Otomatik testler
`npm test`: **50/50 başarılı** (önceki 36 + yeni 14). Kullanıcının senaryoları:

| Senaryo | Doğrulama |
|---|---|
| 1–2 JSON ve tek doğru cevap | Şema, dört benzersiz seçenek, benzersiz id, kategori sayısı, bağımsız çeviri sözlüğü |
| 3 Sıra ve seçenek karıştırma | Seed tekrarı, deste tüketilene kadar 30 farklı soru, aynı seçenek kümesi, takım bağımsızlığı |
| 4 FPS bağımsız zamanlama | 15/30/60/144 FPS'te aynı simülasyon checkpoint'i; 12/22/24 saniye sınırları |
| 5–6 Tek ödül ve geç cevap | Çift kuyruğa alma, tekrarlı cevap, yabancı takım, eski maç, geçersiz indeks ve süre sonu reddi |
| 7–9 Doğru/yanlış/cevapsız | Bonus sırası, doğru cevap ödülü; yanlış/cevapsız sıfır bonus ve sıfır doğrudan XP |
| 10–11 Bonus süreleri/yenileme | Shield %25 gerçek hasar azaltma, süre yenileme/bitme; Attack skill hasarına %15 ve süre sonu |
| 12–13 Repair/Reinforcement sınırı | Maximum HP, 10 asker sınırı ve normal üretim ilerlemesinin korunması |
| 14 Takım ayrımı | Ayrı akış/RNG/istatistik/bonus durumu, güvenilen takım argümanı |
| 15 Savaş devamı | Açık soru/cevap sırasında atış ve simülasyon ticklerinin artması |
| 16 Level-up çakışması | Cevap reddi, devam eden saat, cevapsız olmadan aynı içeriğin sonraki turda sunulması |
| 17 Sonuç istatistikleri | 3 gösterilen, 1 doğru/1 yanlış/1 cevapsız, %33.33; kategori sayıları; XP ayrı |
| 18 Reset/maç sonu | Bitişte checkpoint değişmez; reset soru/bonus/istatistikleri sıfırlar; eski kimlik reddedilir |
| 19 Mobil/build | Tarayıcı responsive kontrolü ve başarılı Vite üretim derlemesi |

## Tarayıcı ve build
- 390×844 mobil viewport: yatay taşma yok; arena/üsler görünür, doğru cevap sonrası yeşil patates, Shield 8 sn ve %100 doğruluk gözlendi.
- 1280×900 masaüstü: yatay taşma yok; yanlış muz kırmızı, patates yeşil ve Türkçe açıklama gözlendi. Savaş devam ederken diğer takım skill paneli ayrı alanda görünür.
- İlk test sırasında başka takım level-up alınca soru paneli aşağı kayıyordu. Panel üstte sabit konuma alındı; cevap düğmelerinin başka takım skill açılışında yer değiştirmesi düzeltildi, doğru/yanlış tıklamalar tekrar başarılı oldu.
- Browser error/warn logları boş.
- `npm run build`: başarılı. Uygulama ~102.87 kB (gzip 32.38), CSS ~11.22 kB; mevcut Three chunk ~549.77 kB uyarısı engelleyici değil.
- `qa-question` / `qa-ui` geliştirme dalları üretim JS içinde bulunmuyor. Normal kullanıcı akışı başlangıç durumuyla açılır.
- Ekran kanıtı: `stage4-mobile.jpg`, `stage4-desktop.jpg`.

## Dosyalar
Yeni: `src/data/questions.json`, `src/questions.js`, `src/question-ui.js`, `tests/questions.test.js`, bu rapor ve Stage 4 ekran görüntüleri.
Değişen: `src/config.js`, `src/simulation.js`, `src/main.js`, `src/style.css`, `index.html`, README, package metadata.
Mevcut karakter/model/efekt paketleri değiştirilmedi; yeni paket/asset indirilmedi.

## Prototip sınırları
Cevap anahtarları yerel JSON/istemci paketinde bulunur. Gerçek multiplayerda anahtarlar sunucuda kalmalı ve trustedActorTeam sunucu oturumundan gelmelidir. Bu sürümde takım seçimi yerel test içindir. Fiziksel telefon, kapsamlı heap/FPS profili ve eğitim/balans kullanıcı araştırması yapılmadı. Önceki uzun simülasyon stres testleri tekrar geçti; yeni kapsam ayrı öğrenci hesabı, veritabanı veya multiplayer içermiyor. Canlıya yayınlanmadı; Aşama 5 başlatılmadı.
