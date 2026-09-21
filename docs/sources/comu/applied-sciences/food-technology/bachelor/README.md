# ÇOMÜ Gıda Teknolojisi Lisans Tezi Kaynak Snapshot'ı

Bu klasör, Çanakkale Onsekiz Mart Üniversitesi Çanakkale Uygulamalı Bilimler Fakültesi Gıda Teknolojisi Bölümünün resmî `Bitirme Tezi Yazım Kuralları` sayfasında yayımlanan dört artifact'ın 2026-09-21 tarihinde alınmış, değiştirilmemiş arşiv kopyalarını içerir.

## Resmî origin

- Duyuru: `https://gida.cubf.comu.edu.tr/arsiv/duyurular/bitirme-tezi-yazim-kurallari-r56.html`
- Duyuru sayfasında görünen tarih: 25.03.2022.
- İndirme URL'leri `manifest.json` içinde her artifact için ayrı kaydedilmiştir.

Dosya adları veya URL tek başına güven kanıtı sayılmadı. Guide'ın görünür içeriğinde ÇOMÜ, Çanakkale Uygulamalı Bilimler Fakültesi, Gıda Teknolojisi Bölümü ve Lisans Bitirme Tezi kimliği doğrulandı. DOCX dosyalarının OOXML paket yapıları ve görünür kurum metinleri ayrıca kontrol edildi.

## İmmutability ve integrity

`original/` altındaki PDF ve DOCX dosyaları resmî sunucudan indirilen exact byte dizileridir. Local evidence snapshot olarak korunabilirler, ancak açık bir redistribution license bulunmadığından Git'e commit edilmezler. `.gitignore` bu binary alanını dışlar; `original/.gitkeep` yalnız klasör yerini clone sonrasında korur. Binary'ler düzenlenmemeli, Office uygulamasında açılıp yeniden kaydedilmemeli, normalize edilmemeli veya aynı path üzerinde yeni sürümle değiştirilmemelidir.

Integrity kontrolü:

```text
node tests/audit/primarySourceManifestAudit.cjs
```

Script her zaman manifest schema'sını, identity alanlarını, URL'leri, expected filename/size/hash metadata'sını, trust level'ları ve source ID benzersizliğini doğrular. Local binary mevcutsa byte size, SHA-256 ve magic bytes/package türünü de doğrular. Local binary yoksa default mod metadata auditini geçirir ve integrity kontrolünü `SKIPPED` olarak raporlar. Mevcut fakat bozulmuş binary her zaman failure'dır.

Local evidence ortamında dört binary'nin de bulunmasını zorunlu kılmak için strict mode kullanılır:

```text
THESISGUARD_REQUIRE_SOURCE_BINARIES=1 node tests/audit/primarySourceManifestAudit.cjs
```

PowerShell:

```powershell
$env:THESISGUARD_REQUIRE_SOURCE_BINARIES = "1"
node tests/audit/primarySourceManifestAudit.cjs
Remove-Item Env:THESISGUARD_REQUIRE_SOURCE_BINARIES
```

### Recovery / download

Fresh clone'da `original/` yalnız `.gitkeep` içerir. `manifest.json` içindeki canonical `downloadUrl` değerlerinden dosyaları aşağıdaki exact path'lere indirin:

```powershell
$sourceDir = "docs/sources/comu/applied-sciences/food-technology/bachelor/original"
Invoke-WebRequest -Uri "https://cdn.comu.edu.tr/cms/cubf.gida/files/101-bitirme-tezi-kaynakca-gosterim-kilavuzu.docx" -OutFile "$sourceDir/101-bitirme-tezi-kaynakca-gosterim-kilavuzu.docx"
Invoke-WebRequest -Uri "https://cdn.comu.edu.tr/cms/cubf.gida/files/102-bitirme-tezi-hazirlama-kilavuzu.pdf" -OutFile "$sourceDir/102-bitirme-tezi-hazirlama-kilavuzu.pdf"
Invoke-WebRequest -Uri "https://cdn.comu.edu.tr/cms/cubf.gida/files/103-bitirme-tezi-sablo-literatur-calismasi.docx" -OutFile "$sourceDir/103-bitirme-tezi-sablo-literatur-calismasi.docx"
Invoke-WebRequest -Uri "https://cdn.comu.edu.tr/cms/cubf.gida/files/104-bitirme-tezi-sablonu-laboratuvar-calismasi.docx" -OutFile "$sourceDir/104-bitirme-tezi-sablonu-laboratuvar-calismasi.docx"
$env:THESISGUARD_REQUIRE_SOURCE_BINARIES = "1"
node tests/audit/primarySourceManifestAudit.cjs
Remove-Item Env:THESISGUARD_REQUIRE_SOURCE_BINARIES
```

URL, filename, byte size ve expected SHA-256 için canonical registry `manifest.json`dır. Public erişim, redistribution license olarak yorumlanmaz.

## Version ve date sınırı

Guide içinde güvenilir bir document version, revision date veya effective academic year bulunamadı. Şablonlardaki `15/01/2020`, `09/08/2021` ve benzeri tarihler örnek tez içeriğidir; guide version değildir. DOCX core properties de artifact publication tarihi olarak kullanılmadı. Bu nedenle `documentVersion`, `publishedAt` ve `effectiveDate` null bırakılmıştır.

## Yeni sürüm ekleme

Yeni resmî guide bulunduğunda mevcut dosyaların üzerine yazmayın. Yeni collection/source ID, yeni immutable filename, retrieval timestamp, URL, byte size ve SHA-256 ekleyin. Eski snapshot ve ona bağlı rule-grounding kaydı tarihsel kanıt olarak korunmalıdır.

## Ownership ve saklama amacı

Artifact'lar Çanakkale Onsekiz Mart Üniversitesine aittir ve resmî olarak herkese açık bölüm sayfasından edinilmiştir. Repository içindeki kopyalar yalnız değişmez kaynak kanıtı ve rule traceability amacıyla tutulur. Kaynaklarda açık bir yeniden dağıtım lisansı tespit edilmedi; bu README herhangi bir lisans hakkı iddia etmez. Binary saklama politikası ayrıca proje sahibi tarafından gözden geçirilmelidir.
