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

## Figure Semantics Architecture

Current figure analysis is semantic. Generic OOXML representation is not the same thing as academic identity: a raw `w:drawing` is an `ObjectRepresentationOccurrence`, but it is not automatically an academic figure.

The current production path is:

```text
OOXML
-> ObjectRepresentationOccurrence
-> CaptionOccurrence
-> ObjectCaptionAssociation
-> AcademicObjectResolution
-> applicability / validators / diagnostics / evidence
```

Caption semantics declare whether visible caption text is a table or figure caption. Associations connect object representations to nearby captions, and academic resolution decides whether an object is `declared`, `unresolved`, `ambiguous`, or `excluded`. Figure rules use declared semantic figure resolutions and their representation/association evidence.

Inline versus anchor drawing type is structural evidence, not academic identity. Inline figures can be evaluated for physical alignment when the required paragraph evidence is available; anchored figures remain limited because reliable physical placement needs rendered layout information. Revision visibility, front-matter scope, diagnostics, and coverage metadata are also derived from semantic model facts.

Table handling remains isolated on the table path. The legacy figure bridge was retired at LEVEL 3 in Phase 4E-18P: `DocumentFigureOccurrence`, `DocumentFigures`, `NormalizedDocument.figures`, `document.figures`, and `parseFigures()` are not current production architecture.
