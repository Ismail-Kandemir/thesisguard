const path = require("path");

require("../golden/experimentalGoldenRegression.cjs");

const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  normalizeDocumentHeadings,
} = require("../../src/features/analysis/parsers/documentHeadingsNormalizer.ts");
const {
  normalizeAcademicDocumentScopes,
} = require("../../src/features/analysis/parsers/academicDocumentScopeNormalizer.ts");
const {
  normalizeAcademicSections,
} = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const {
  normalizeBibliographySemantics,
} = require("../../src/features/analysis/parsers/bibliographySemanticsNormalizer.ts");
const {
  normalizeCitationSemantics,
} = require("../../src/features/analysis/parsers/citationSemanticsNormalizer.ts");
const {
  normalizeCitationBibliographyLinkSemantics,
} = require("../../src/features/analysis/parsers/citationBibliographyLinkSemanticsNormalizer.ts");
const {
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");

function main() {
  assertClearJournalArticle();
  assertClearBook();
  assertClearBookChapter();
  assertClearThesis();
  assertClearConferenceProceedings();
  assertClearWebOnline();
  assertClearInPress();
  assertAmbiguousJournalBookLikeEntry();
  assertUrlContainingEntryDoesNotBecomeWebWithoutContext();
  assertMalformedIncompleteEntry();
  assertPossibleContinuationUnresolved();
  assertAnonymousAndOrganizationAuthors();
  assertTurkishCharactersPreserved();
  assertExistingBibliographyIdentityUnchanged();
  assertExistingCitationBibliographyLinksUnchanged();

  console.log(JSON.stringify({
    phase: "bibliography-source-type-sprint-2",
    result: "PASS",
    audit: path.basename(__filename),
  }, null, 2));
}

function assertClearJournalArticle() {
  const entry = firstEntry(
    "Ozkaptan, C. ve Tekinalp, O. 2003. Uzay Uygulamalarinda Kucuk Uydularin Yeri. Pivolka, 1 (7): 3-13.",
  );

  assertClassification(entry, "journal-article", "high");
  assertIncludes(entry.sourceTypeClassification.evidence, "journal-volume-issue-pages", "journal evidence");
  assertEqual(entry.sourceTypeClassification.publicationFacts.volumeIssueCandidate, "1 (7)", "journal volume issue");
}

function assertClearBook() {
  const entry = firstEntry(
    "Blalock, H. M. 1987. Social Statistics. McGraw-Hill, NY. 225 p.",
  );

  assertClassification(entry, "book", "high");
  assertIncludes(entry.sourceTypeClassification.evidence, "book-page-count", "book page evidence");
  assertIncludes(entry.sourceTypeClassification.evidence, "book-publisher-marker", "book publisher evidence");
}

function assertClearBookChapter() {
  const entry = firstEntry(
    "Sargent, J. R. 1995. Origins and Functions of Egg Lipid. In: Bromage, N. R. ve Roberts, R. J., Eds. Broodstock Management and Egg Quality. Blackwell, Oxford. 353-372.",
  );

  assertClassification(entry, "book-chapter", "high");
  assertIncludes(entry.sourceTypeClassification.evidence, "book-chapter-in-marker", "chapter in evidence");
  assertIncludes(entry.sourceTypeClassification.evidence, "book-chapter-editor-marker", "chapter editor evidence");
}

function assertClearThesis() {
  const entry = firstEntry(
    "Yetim, H. 1993. Biochemical Alteration of Fish Muscle. PhD Dissertation (Doktora Tezi). The Ohio State University, Colombus, Ohio, USA.",
  );

  assertClassification(entry, "thesis", "high");
  assertIncludes(entry.sourceTypeClassification.evidence, "thesis-marker", "thesis evidence");
}

function assertClearConferenceProceedings() {
  const entry = firstEntry(
    "Kirby, R. 1992. Shock: Aggressive Resuscitation Procedures. W.S.A.V.A. XVII World Cong., Rome. 609-610.",
  );

  assertClassification(entry, "conference-proceedings", "high");
  assertIncludes(entry.sourceTypeClassification.evidence, "conference-marker", "conference evidence");
}

function assertClearWebOnline() {
  const entry = firstEntry(
    "Walker, J. R. (1995). ULA Style Citations of Electronic Sources. Retrieved October 26, 1995, from http://www.cas.usf.edu/english/walker/mla.html.",
  );

  assertClassification(entry, "web-online", "high");
  assertIncludes(entry.sourceTypeClassification.evidence, "url-marker", "web url evidence");
  assertIncludes(entry.sourceTypeClassification.evidence, "retrieved-marker", "web retrieved evidence");
}

function assertClearInPress() {
  const entry = firstEntry(
    "Say, T. ve Kilic, C. 1998. Geriye Yayilma Algoritmalari ile Karakter Tanima. Baskıda (In press).",
  );

  assertClassification(entry, "in-press", "high");
  assertIncludes(entry.sourceTypeClassification.evidence, "in-press-marker", "in press evidence");
}

function assertAmbiguousJournalBookLikeEntry() {
  const entry = firstEntry(
    "Smith, J. 2024. Hybrid Academic Source. In: Doe, J., Ed. Research Annual. Journal of Mixed Sources, 12 (2): 10-20.",
  );

  assertClassification(entry, "ambiguous", "low");
  assertEqual(entry.sourceTypeClassification.ambiguityReason, "conflicting-source-type-evidence", "ambiguous reason");
}

function assertUrlContainingEntryDoesNotBecomeWebWithoutContext() {
  const entry = firstEntry(
    "Yilmaz, A. 2024. Supplementary Source Note. https://example.com/source-note.",
  );

  assertClassification(entry, "unknown", "low");
  assertEqual(entry.sourceTypeClassification.ambiguityReason, "url-without-web-context", "url ambiguity reason");
  assertEqual(entry.sourceTypeClassification.publicationFacts.urlCandidate, "https://example.com/source-note.", "url fact");
}

function assertMalformedIncompleteEntry() {
  const entry = firstEntry("Kimliksiz ve eksik kaynak metni.");

  assertClassification(entry, "unknown", "low");
  assertEqual(entry.identity.parseStatus, "unresolved", "malformed identity unresolved");
  assertEqual(entry.sourceTypeClassification.ambiguityReason, "incomplete-entry-identity", "malformed reason");
}

function assertPossibleContinuationUnresolved() {
  const document = bibliographyDocument(
    paragraph("Yilmaz, A. 2024. Gida teknolojisi") +
      paragraph("devam eden baslik ve yayin bilgisi."),
  );
  const continuation = document.bibliography.entries[1];

  assertEqual(continuation.boundaryStatus, "POSSIBLE_CONTINUATION", "continuation boundary");
  assertClassification(continuation, "unknown", "low");
  assertEqual(continuation.sourceTypeClassification.ambiguityReason, "entry-boundary-unresolved", "continuation reason");
}

function assertAnonymousAndOrganizationAuthors() {
  const document = bibliographyDocument(
    paragraph("Anonim 2024. Adsiz Kitap. McGraw-Hill, NY. 100 p.") +
      paragraph("World Health Organization 2022. Online Report. Retrieved October 26, 2022, from https://www.who.int/report."),
  );
  const [anonymousEntry, organizationEntry] = document.bibliography.entries;

  assertEqual(anonymousEntry.identity.authorKind, "anonymous", "anonymous author kind");
  assertClassification(anonymousEntry, "book", "high");
  assertEqual(organizationEntry.identity.authorKind, "organization", "organization author kind");
  assertClassification(organizationEntry, "web-online", "high");
}

function assertTurkishCharactersPreserved() {
  const entry = firstEntry(
    "Şen, A. 2024. Çalışma Başlığı. Türk Dergisi, 5 (2): 10-12.",
  );

  assertEqual(entry.identity.authors[0], "Şen, A.", "turkish author preserved");
  assertEqual(entry.identity.title, "Çalışma Başlığı. Türk Dergisi, 5 (2): 10-12.", "turkish title preserved");
  assertClassification(entry, "journal-article", "high");
}

function assertExistingBibliographyIdentityUnchanged() {
  const entry = firstEntry("Yilmaz, A. (2024). Gida teknolojisi arastirmalari.");
  const identity = entry.identity;

  assertEqual(identity.authorKind, "named", "identity author kind unchanged");
  assertEqual(identity.authors[0], "Yilmaz, A.", "identity author unchanged");
  assertEqual(identity.year, "2024", "identity year unchanged");
  assertEqual(identity.yearSuffix, null, "identity year suffix unchanged");
  assertEqual(identity.title, "Gida teknolojisi arastirmalari.", "identity title unchanged");
  assertEqual(identity.parseStatus, "parsed", "identity parse status unchanged");
  assertEqual(identity.confidence, "high", "identity confidence unchanged");
}

function assertExistingCitationBibliographyLinksUnchanged() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Metin ici atif vardir (Yilmaz, 2024).") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Kaynak basligi."),
  );
  const link = document.citationBibliographyLinks.associations[0];

  assertEqual(document.citationBibliographyLinks.associations.length, 1, "link count unchanged");
  assertEqual(link.status, "matched", "link status unchanged");
  assertEqual(link.matchedEntryId, "bibliography-entry-1", "matched entry unchanged");
}

function firstEntry(entryText) {
  return bibliographyDocument(paragraph(entryText)).bibliography.entries[0];
}

function bibliographyDocument(bodyXml) {
  const rules = [requiredRule("Kaynaklar")];
  const parsed = parseDocumentXml(wrapDocumentXml(heading("Kaynaklar") + bodyXml));
  const marked = markRequiredSectionHeadings(parsed, rules);
  const headed = normalizeDocumentHeadings(marked, rules);
  const scoped = normalizeAcademicDocumentScopes(headed, rules);
  const sectioned = normalizeAcademicSections(scoped, rules);

  return normalizeBibliographySemantics(sectioned, rules);
}

function semanticDocument(bodyXml, rules = [requiredRule("Giris"), requiredRule("Kaynaklar")]) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const marked = markRequiredSectionHeadings(parsed, rules);
  const headed = normalizeDocumentHeadings(marked, rules);
  const scoped = normalizeAcademicDocumentScopes(headed, rules);
  const sectioned = normalizeAcademicSections(scoped, rules);
  const withBibliography = normalizeBibliographySemantics(sectioned, rules);
  const withCitations = normalizeCitationSemantics(withBibliography);

  return normalizeCitationBibliographyLinkSemantics(withCitations);
}

function requiredRule(section) {
  return {
    id: `required.${section}`,
    type: "REQUIRED_SECTION",
    title: `${section} required`,
    description: "",
    category: "structure",
    expected: { section, required: true },
    severity: "error",
    score: 10,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
  };
}

function wrapDocumentXml(content) {
  return `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${content}</w:body></w:document>`;
}

function heading(text) {
  return paragraph(text);
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function assertClassification(entry, expectedType, expectedConfidence) {
  assertEqual(entry.sourceTypeClassification.sourceType, expectedType, `${expectedType} source type`);
  assertEqual(entry.sourceTypeClassification.confidence, expectedConfidence, `${expectedType} confidence`);
}

function assertIncludes(values, expected, label) {
  if (!values.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(values)} to include ${JSON.stringify(expected)}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

main();
