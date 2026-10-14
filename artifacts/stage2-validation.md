# Aşama 2 doğrulama raporu

14 Ekim 2026 — yalnızca yerel geliştirme, yayın yok.

| Kontrol | Sonuç |
| --- | --- |
| İki takım otomatik savaş | Tarayıcıda doğma, ilerleme, durma ve ateş görüldü; başlangıçta üçer asker |
| Hedef seçimi | En yakın canlı düşman, ölü hedef değişimi ve üs fallback testleri geçti |
| Atış / hasar | Saniyede bir atış; mermi ulaşmadan hasar yok; isabette 10 HP testleri geçti |
| Ölüm / temizlik | Death + 2.5 saniyede simülasyondan çıkarma; görsel aktör havuzuna dönüş doğrulandı |
| Üs hasarı | Gerçek maçta mavi üs 1000 → 0 HP; kırmızı takım kazandı; tepki ve sonuç ekranı görüldü |
| 5 dakika sonu | 9000 tick / 300 saniyede HP karşılaştırması ve beraberlik testleri geçti |
| Maç sonu durma | Bitişten sonra 1000 ek step denemesi durum değiştirmedi; mermiler temizlendi |
| Yeniden başlatma | HP, asker sayısı, sayaçlar, süre, ID, seed, mermiler, efektler ve görünür aktörler sıfırlandı |
| FPS bağımsızlığı | 15/30/60/144 FPS ve düzensiz kare süreleri aynı simülasyon snapshot'ını üretti |
| Uzun simülasyon | 30 dakika / 54.000 tick; maksimum asker sınırları ve 0.8 birim ayrım korundu |
| Görsel kaynak kararlılığı | 8 × 300 saniye hızlandırılmış görsel test; 14 aktör, 91 geometri, 83 doku ve 8 shader programı sabit |
| Mobil görünüm | 390 × 844 gerçek tarayıcı viewport override doğrulandı; yatay taşma yok, iki üs ve askerler kadrajda |
| Aşama 1 laboratuvarı | Idle/Run testi sırasında süre sabit kaldı; Savaşa dön işlemi doğrulandı |
| Konsol | Yerel önizleme ve QA sayfasında hata/uyarı kaydı yok |
| Üretim derlemesi | npm run build başarılı; Three.js vendor boyut uyarısı mevcut |

`npm test`: 13/13 geçti. Yeni bağımlılık veya asset paketi indirilmedi.
Tek normal savaş önizlemesinde 84 FPS ölçüldü. FPS cihaz/yük/asker sayısına göre değişir.
Uzun testler hızlandırılmıştır; fiziksel telefon testi ve saatler süren gerçek zamanlı
heap/FPS profili yapılmamıştır. Kaynak sayısı kararlılığı genel olarak bellek sızıntısı
olmadığının kesin kanıtı değildir, test edilen havuzlarda büyüme gözlenmedi.

Varsayılan seed ile üs yıkımı yaklaşık 57.5 saniyede gerçekleşti.
300 saniye üst süredir; bir üs daha erken yıkıldığında maç erken sona erer.
Seed değiştirildiğinde çatışma zamanlaması değişir; restart aynı seed'i tekrarlar.

Savaş ayarları: `src/config.js`.
Ekran görüntüleri: `artifacts/stage2-mobile.jpg`, `artifacts/stage2-result.jpg`.
