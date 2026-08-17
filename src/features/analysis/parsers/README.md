Okunan belge iceriginin analiz edilebilir yapilara donusturulecegi klasordur.
# Kısaltma normalizasyonu

`documentAbbreviationsNormalizer`, daha önce parse edilmiş görünür body paragraph
metnini tarar; `document.xml` veya header/footer parçalarını yeniden parse etmez.
Heading1–Heading3 paragrafları ile resolved REQUIRED_SECTION ve
CONDITIONAL_REQUIRED_SECTION heading paragrafları tarama dışında bırakılır.

Heuristic yalnız en az iki Unicode uppercase harf taşıyan, uppercase harf/rakam
bileşenlerinden oluşan ve parçalar arasında hyphen kullanabilen tokenları kabul
eder. Dış punctuation tokenizasyon sırasında atılır. Bu yaklaşım `TÜBİTAK`,
`UV-VIS`, `CO2` ve `H2O` örneklerini desteklerken lowercase, Title Case, saf sayı
ve tek harfli tokenları reddeder.

`hasAbbreviations=true`, bir tezin kesinlikle Simgeler ve Kısaltmalar Listesi
gerektirdiği anlamına gelmez. Bu yalnız gelecekteki conditional akademik
kuralların kullanabileceği heuristic bir document fact'tir. Tamamen uppercase
body ifadeleri gibi bağlama bağlı false-positive olasılıkları devam eder.

Generic `ABBREVIATION_LIST_CONSISTENCY` altyapısı aynı exported token heuristic'ini
kullanır. Liste satırı parser'ı yalnız geçerli abbreviation key'inden sonra tab,
çoklu whitespace, boşluklu ` - ` veya `:` separator bulunan satırları kabul eder.
Validator ham XML taramaz; mevcut section content sınırını ve normalize paragraph
metinlerini kullanır. Registry kaydı ve university rule tanımı bu generic
altyapının kapsamında değildir.
