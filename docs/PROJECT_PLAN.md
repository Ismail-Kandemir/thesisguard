# Proje Planı

## Projenin Amacı

ThesisGuard, tez ve akademik belge hazırlama sürecinde biçimsel uygunluk kontrollerini kolaylaştırmayı amaçlayan bir web uygulamasıdır. Proje, öğrencilerin ve akademik danışmanların belgeyi teslim öncesinde üniversite kurallarına göre hızlıca değerlendirebilmesini hedefler.

## Problemin Tanımı

Tez yazım kuralları genellikle detaylı, üniversiteye özel ve manuel kontrol gerektiren yapılardır. Sayfa düzeni, başlık biçimi, yazı tipi, kenar boşlukları, kaynakça düzeni ve benzeri kuralların elle kontrol edilmesi zaman alır ve hata riskini artırır.

## Çözüm Yaklaşımı

Sistem, kullanıcı tarafından yüklenen DOCX belgelerini analiz ederek tanımlı üniversite kurallarıyla karşılaştırır. Analiz sonucunda tespit edilen uyumsuzluklar, uygunluk yüzdesi ve iyileştirme önerileri kullanıcıya rapor olarak sunulur.

## Hedef Kullanıcılar

- Lisansüstü öğrenciler
- Akademik danışmanlar
- Enstitü ve fakülte idari personeli
- Üniversite tez yazım kontrol süreçlerinde görev alan kullanıcılar

## Beklenen Çıktılar

- DOCX belge yükleme akışı
- Üniversite bazlı kural kontrol sistemi
- Belge uygunluk analizi
- Hata ve uyarı raporu
- Uygunluk yüzdesi
- Gelecekte farklı üniversitelere genişletilebilir yapı

## Başarı Kriterleri

- Kullanıcı, belge analiz sonucunu anlaşılır şekilde görebilmelidir.
- Sistem, tanımlı kurallara göre tutarlı sonuç üretmelidir.
- Mimari, yeni üniversite kurallarının eklenmesine uygun olmalıdır.
- Kod yapısı bakım yapılabilir, ölçeklenebilir ve test edilebilir olmalıdır.
- Uygulama temel kullanıcı akışlarında hızlı ve kararlı çalışmalıdır.
