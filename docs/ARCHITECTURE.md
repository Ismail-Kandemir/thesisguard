# Mimari

## Kullanılacak Teknolojiler

ThesisGuard, modern web uygulaması geliştirme yaklaşımıyla React, TypeScript ve Vite kullanılarak geliştirilecektir. Bu teknoloji seçimi hızlı geliştirme, güçlü tip güvenliği ve sürdürülebilir frontend mimarisi sağlamayı hedefler.

## React

React, kullanıcı arayüzünün component tabanlı geliştirilmesi için kullanılacaktır. Uygulama arayüzü küçük, bağımsız ve yeniden kullanılabilir parçalar halinde tasarlanacaktır.

## TypeScript

TypeScript, uygulamada tip güvenliği sağlamak için kullanılacaktır. Veri modelleri, component props yapıları, analiz sonuçları ve kural tanımları açık tiplerle ifade edilecektir. Projede `any` kullanımından kaçınılacaktır.

## Vite

Vite, geliştirme sunucusu ve üretim build süreci için kullanılacaktır. Hızlı geliştirme deneyimi, modern modül yapısı ve sade yapılandırma proje ihtiyaçlarıyla uyumludur.

## Klasör Yapısı

Proje, orta ölçekli bir React uygulaması için sade ve genişletilebilir klasör yapısıyla ilerleyecektir. Başlangıçta yalnızca gerçekten ihtiyaç duyulan üst seviye klasörler tutulacaktır.

- `app`: Uygulama genelindeki kurulum, sağlayıcılar ve ileride routing gibi merkezi yapıların konumlanacağı alandır.
- `pages`: Kullanıcıların doğrudan erişeceği sayfa seviyesindeki ekranlar için ayrılır.
- `features`: İş yeteneklerinin bağımsız modüller halinde geliştirileceği alandır.
- `shared`: Birden fazla feature veya page tarafından kullanılabilecek ortak yapıların konumlanacağı alandır.
- `layouts`: Sayfalar arasında tekrar eden yerleşim yapıları için kullanılır.
- `assets`: Görsel, ikon, font ve benzeri statik varlıklar için ayrılır.

## Feature Based Architecture Yaklaşımı

Proje büyüdükçe iş alanları feature bazlı ayrıştırılacaktır. Authentication, dashboard, dosya yükleme, belge analizi ve raporlama gibi alanlar kendi sorumluluk sınırları içinde ele alınacaktır. Bu yaklaşım, kodun okunabilirliğini ve bakım kolaylığını artırır.

## Shared Klasörünün Amacı

`shared` klasörü, belirli bir iş özelliğine ait olmayan ortak kodlar için kullanılacaktır. Ortak componentler, yardımcı fonksiyonlar, sabitler, tipler ve genel servisler bu alanda konumlandırılabilir. Bu klasör gereksiz büyütülmeyecek, yalnızca gerçekten paylaşılan parçalar burada tutulacaktır.

## App Klasörünün Amacı

`app` klasörü uygulamanın genel çalışma kabuğunu temsil eder. İlerleyen aşamalarda routing, global provider yapıları ve uygulama seviyesindeki konfigürasyonlar burada yer alabilir. Bu klasör iş mantığı veya sayfa içeriği taşımayacaktır.

## Layout Mantığı

Layout yapıları, sayfalar arasında tekrar eden genel yerleşimleri yönetmek için kullanılacaktır. Örneğin kimlik doğrulama ekranları, panel ekranları veya rapor görüntüleme ekranları farklı layout ihtiyaçlarına sahip olabilir. Layout katmanı, sayfa içeriğini yönetmek yerine görsel yerleşim sorumluluğunu üstlenir.
