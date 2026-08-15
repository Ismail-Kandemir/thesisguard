# Gıda Teknolojisi

Bu klasörde Uygulamalı Bilimler Fakültesi Gıda Teknolojisi bölümünün doğrulanmış
kural setleri tutulur.

Kaynak: Çanakkale Onsekiz Mart Üniversitesi, Gıda Teknolojisi Bitirme Tezi
Hazırlama Kılavuzu.

bachelor.json, kılavuzda doğrulanan sayfa numarasının zorunlu, alt bilgide ve
ortalanmış olması kuralıyla İçindekiler bölümünün bulunması kuralını içerir.
Kılavuz Word TOC field kullanımını zorunlu tutmadığından bu teknik yapı
üniversite kuralının başarı koşulu değildir.

Aynı rule set, kılavuzda tez yapısının parçası olan Kaynaklar bölümünün
bulunmasını da doğrular. Bu kural APA uygunluğunu, kaynakların biçimini veya
metin içi atıfları kontrol etmez.

Kılavuzdaki `ÖZET` ve `ABSTRACT` başlıklarına dayanarak Türkçe ve İngilizce
özet bölümlerinin varlığı da ayrı required-section kurallarıyla doğrulanır.
Bu kurallar özet uzunluğunu, kelime sayısını, anahtar kelimeleri, içerik
doğruluğunu, başlık fontunu veya özet biçimlendirmesini kontrol etmez.

Deneysel ve teorik/kaynak araştırması çalışmalarının ikisinde de ortak ve
zorunlu olan `İNTİHAL (AŞIRMA) BEYAN SAYFASI`, `TEŞEKKÜR`, `GİRİŞ`, `SONUÇ` ve
`ÖZGEÇMİŞ` başlıkları da ayrı required-section kurallarıyla doğrulanır. Bu
kurallar yalnızca bağımsız bölüm başlığının varlığını kontrol eder; bölüm
içeriğini, sırasını veya biçimini değerlendirmez.

İntihal beyanı kontrolü gerçek intihal oranını, Turnitin sonucunu, imzayı veya
beyan içeriğinin doğruluğunu değerlendirmez. Özgeçmiş kontrolü de yalnızca
bölüm varlığını doğrular; özgeçmiş içeriğini ya da şablon uygunluğunu incelemez.

## Tez düzeyi ve çalışma türü

`bachelor`, akademik tez düzeyidir. `experimental` (Deneysel Çalışma) ve
`source-research` (Teorik / Kaynak Araştırması) çalışma metodolojisidir; tez
düzeyi ile çalışma metodolojisi aynı kavram değildir.

İki metodolojinin ortak kuralları `bachelor.json` dosyasında kalır.
`bachelor/experimental.json` ve `bachelor/source-research.json` bu ortak seti
`extends` eden child rule setlerdir. Experimental child seti yalnız Deneysel
Çalışma için zorunlu olan Genel Bilgiler ve Literatür Çalışması, Materyal ve
Metot, Bulgular ve Tartışma bölümlerini doğrular. Bu üç kural Teorik / Kaynak
Araştırması tezlerine uygulanmaz ve source-research child setinde yer almaz.

Kontrol yalnız bağımsız section başlığının varlığını değerlendirir; içerik
kalitesi, bölümlerin sırası veya bilimsel uygunluk doğrulanmaz.

Source-research child setindeki `Genel Bilgiler` bölümü yalnız Teorik / Kaynak
Araştırması için zorunludur ve Deneysel Çalışma analizine uygulanmaz. Bu kontrol
de yalnız section varlığını değerlendirir. Kılavuzdaki “Ana ve Alt Bölümler”
ifadesi konuya göre oluşturulacak yapıyı tarif ettiğinden sabit bir
`REQUIRED_SECTION` olarak modellenmemiştir.

## Bölüm sırası

Experimental ve Source Research child setleri farklı `SECTION_ORDER` kuralları
kullanır. Her kural yalnız seçilen çalışma türüne ait, kılavuzdan doğrulanan
zorunlu bölümlerin relative sırasını denetler. Missing section kontrolü
`REQUIRED_SECTION` kurallarına aittir; order validator yalnız bulunan expected
bölümleri karşılaştırır.

Simgeler ve Kısaltmalar, Tablolar, Şekiller ve Ekler gibi koşullu bölümlerin
yokluğu order hatası değildir. Dış Kapak, İç Kapak ve Kabul ve Onay mevcut
section-presence modeliyle güvenilir temsil edilmediğinden listelere alınmaz.
“Ana ve Alt Bölümler” sabit görünür bir başlık değildir. Bu doğrulama içerik
kalitesini, bilimsel uygunluğu veya bölüm numaralandırmasını değerlendirmez.
