# Gereksinimler

## Functional Requirements

- Kullanıcı DOCX formatında tez dosyası yükleyebilir.
- Sistem yüklenen belgeyi teknik olarak okuyabilir ve analiz için hazırlayabilir.
- Sistem belgeyi tanımlı üniversite kurallarına göre kontrol eder.
- Sistem biçimsel hataları ve eksikleri tespit eder.
- Sistem her kontrol maddesi için başarılı, hatalı veya uyarı durumunu belirler.
- Sistem belge için uygunluk yüzdesi hesaplar.
- Sistem kullanıcıya anlaşılır bir hata raporu sunar.
- Kullanıcı analiz sonucunda hangi alanların düzeltilmesi gerektiğini görebilir.
- Sistem ilk aşamada Çanakkale Onsekiz Mart Üniversitesi kurallarını destekler.
- Sistem gelecekte farklı üniversite kural setlerinin eklenmesine uygun olmalıdır.

## Non Functional Requirements

### Performans

Belge yükleme ve analiz süreci kullanıcıyı gereksiz bekletmeyecek şekilde tasarlanmalıdır. Orta büyüklükteki DOCX dosyaları makul süre içinde işlenmelidir.

### Güvenlik

Yüklenen belgeler kullanıcı verisi olarak ele alınmalıdır. Dosya doğrulama, güvenli işleme ve yetkisiz erişimi önleme uygulamanın temel güvenlik gereksinimleridir.

### Kullanılabilirlik

Arayüz sade, anlaşılır ve yönlendirici olmalıdır. Kullanıcı analiz sonucunu teknik bilgiye ihtiyaç duymadan yorumlayabilmelidir.

### Ölçeklenebilirlik

Mimari, yeni analiz kuralları, yeni üniversiteler ve yeni raporlama yetenekleri eklendiğinde mevcut yapıyı bozmayacak şekilde planlanmalıdır.

### Bakım Kolaylığı

Kod yapısı küçük, sorumluluğu net ve yeniden kullanılabilir parçalardan oluşmalıdır. Kural yönetimi, analiz mantığı ve arayüz katmanı birbirinden ayrıştırılmalıdır.
