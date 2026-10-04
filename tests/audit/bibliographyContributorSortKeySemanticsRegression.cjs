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
  assertSinglePersonContributor();
  assertTwoPersonContributors();
  assertThreePersonContributors();
  assertOrganizationContributor();
  assertAnonymousContributor();
  assertTurkishSurnameCharactersPreserved();
  assertCompoundSurnameContributor();
  assertInitialsEvidence();
  assertSamePrimaryAuthorDifferentYears();
  assertSameAuthorYearSuffix();
  assertMalformedContributorListIncomplete();
  assertEtAlEvidenceOnly();
  assertAmbiguousIdentity();
  assertContinuationEntryConservative();
  assertDeterministicSortKey();
  assertInsufficientConfidenceSortKeyUnavailable();
  assertExistingBibliographyEntryIdentityUnchanged();
  assertSourceTypeClassificationUnchanged();
  assertCitationBibliographyLinkingUnchanged();

  console.log(JSON.stringify({
    phase: "bibliography-formatting-sprint-3",
    result: "PASS",
    audit: path.basename(__filename),
  }, null, 2));
}

function assertSinglePersonContributor() {
  const entry = firstEntry("Yilmaz, A. (2024). Gida teknolojisi.");
  const contributor = entry.contributorSemantics.contributors[0];

  assertEqual(entry.contributorSemantics.completeness, "complete", "single completeness");
  assertEqual(contributor.kind, "person", "single contributor kind");
  assertEqual(contributor.familyName, "Yilmaz", "single family");
  assertEqual(contributor.initials[0], "A", "single initial");
  assertEqual(entry.sortKey.primaryContributorIdentity, "yilmaz a", "single sort key identity");
}

function assertTwoPersonContributors() {
  const entry = firstEntry("Yilmaz, A. ve Demir, B. (2024). Ortak calisma.");

  assertEqual(entry.contributorSemantics.contributors.length, 2, "two contributor count");
  assertEqual(entry.contributorSemantics.contributors[1].familyName, "Demir", "two second family");
  assertEqual(entry.sortKey.subsequentContributorIdentities[0], "demir b", "two sort subsequent");
}

function assertThreePersonContributors() {
  const entry = firstEntry("Yilmaz, A., Demir, B. ve Kaya, C. (2023). Cok yazarlı calisma.");

  assertEqual(entry.contributorSemantics.contributors.length, 3, "three contributor count");
  assertEqual(entry.contributorSemantics.contributors[2].familyName, "Kaya", "three third family");
  assertEqual(entry.sortKey.subsequentContributorIdentities.length, 2, "three sort subsequent count");
}

function assertOrganizationContributor() {
  const entry = firstEntry("World Health Organization (2024). Kurumsal rapor.");
  const contributor = entry.contributorSemantics.contributors[0];

  assertEqual(contributor.kind, "organization", "organization contributor kind");
  assertEqual(entry.contributorSemantics.completeness, "complete", "organization complete");
  assertEqual(entry.sortKey.contributorKind, "organization", "organization sort kind");
}

function assertAnonymousContributor() {
  const entry = firstEntry("Anonim (2024). Adsiz kaynak.");
  const contributor = entry.contributorSemantics.contributors[0];

  assertEqual(contributor.kind, "anonymous", "anonymous contributor kind");
  assertEqual(entry.sortKey.primaryContributorIdentity, "anonim", "anonymous sort key");
}

function assertTurkishSurnameCharactersPreserved() {
  const entry = firstEntry("\u015Een, A. (2024). \u00C7al\u0131\u015Fma.");
  const contributor = entry.contributorSemantics.contributors[0];

  assertEqual(contributor.familyName, "\u015Een", "turkish family preserved");
  assertEqual(contributor.normalizedComparisonForm, "\u015Fen a", "turkish normalized form preserved");
  assertEqual(entry.sortKey.primaryContributorIdentity, "\u015Fen a", "turkish sort identity preserved");
}

function assertCompoundSurnameContributor() {
  const entry = firstEntry("Van der Waals, J. D. (2020). Compound surname.");
  const contributor = entry.contributorSemantics.contributors[0];

  assertEqual(contributor.familyName, "Van der Waals", "compound family");
  assertEqual(contributor.initials.length, 2, "compound initials");
  assertEqual(entry.sortKey.primaryContributorIdentity, "van der waals j d", "compound sort identity");
}

function assertInitialsEvidence() {
  const entry = firstEntry("Smith, J. R. (2021). Initials.");
  const contributor = entry.contributorSemantics.contributors[0];

  assertEqual(contributor.givenNameEvidence, "J. R.", "given evidence");
  assertEqual(contributor.initials.join("|"), "J|R", "initial evidence");
}

function assertSamePrimaryAuthorDifferentYears() {
  const document = bibliographyDocument(
    paragraph("Yilmaz, A. (2023). Onceki calisma.") +
      paragraph("Yilmaz, A. (2024). Sonraki calisma."),
  );
  const [first, second] = document.bibliography.entries;

  assertEqual(first.sortKey.primaryContributorIdentity, second.sortKey.primaryContributorIdentity,
    "same author key");
  assertEqual(first.sortKey.year, "2023", "first year key");
  assertEqual(second.sortKey.year, "2024", "second year key");
}

function assertSameAuthorYearSuffix() {
  const entry = firstEntry("Yilmaz, A. (2024b). Ayni yil calismasi.");

  assertEqual(entry.sortKey.year, "2024", "suffix sort year");
  assertEqual(entry.sortKey.yearSuffix, "b", "suffix sort year suffix");
}

function assertMalformedContributorListIncomplete() {
  const entry = firstEntry("Yilmaz, A. ve (2024). Eksik yazar listesi.");

  assertEqual(entry.contributorSemantics.completeness, "incomplete", "malformed completeness");
  assertIncludes(entry.contributorSemantics.ambiguityReasons, "malformed-contributor-list", "malformed reason");
  assertEqual(entry.sortKey, null, "malformed sort unavailable");
}

function assertEtAlEvidenceOnly() {
  const entry = firstEntry("Yilmaz, A. ve di\u011F. (2024). Kisaltimli kaynak.");

  assertEqual(entry.contributorSemantics.hasEtAlEvidence, true, "et al marker seen");
  assertEqual(entry.contributorSemantics.etAlEvidence[0], "ve di\u011F.", "et al evidence value");
  assertEqual(entry.contributorSemantics.completeness, "ambiguous", "et al ambiguous");
  assertEqual(entry.sortKey, null, "et al sort unavailable");
}

function assertAmbiguousIdentity() {
  const entry = firstEntry("Research Team (2024). Belirsiz yazar.");

  assertEqual(entry.identity.authorKind, "unknown", "ambiguous identity unchanged");
  assertEqual(entry.contributorSemantics.completeness, "unknown", "ambiguous completeness");
  assertEqual(entry.sortKey, null, "ambiguous sort unavailable");
}

function assertContinuationEntryConservative() {
  const document = bibliographyDocument(
    paragraph("Yilmaz, A. (2024). Baslik") +
      paragraph("devam eden yayin bilgisi."),
  );
  const continuation = document.bibliography.entries[1];

  assertEqual(continuation.boundaryStatus, "POSSIBLE_CONTINUATION", "continuation boundary");
  assertEqual(continuation.contributorSemantics.completeness, "unknown", "continuation completeness");
  assertEqual(continuation.sortKey, null, "continuation sort unavailable");
}

function assertDeterministicSortKey() {
  const entry = firstEntry("Yilmaz, A. ve Demir, B. (2024). Ortak calisma.");

  assertEqual(entry.sortKey.contributorKind, "person", "sort contributor kind");
  assertEqual(entry.sortKey.primaryContributorIdentity, "yilmaz a", "sort primary");
  assertEqual(entry.sortKey.subsequentContributorIdentities.join("|"), "demir b", "sort subsequent");
  assertEqual(entry.sortKey.originalEntryOrder, 1, "sort original order evidence");
}

function assertInsufficientConfidenceSortKeyUnavailable() {
  const entry = firstEntry("Kimliksiz ve eksik kaynak metni.");

  assertEqual(entry.contributorSemantics.confidence, "low", "insufficient confidence");
  assertEqual(entry.sortKey, null, "insufficient sort unavailable");
}

function assertExistingBibliographyEntryIdentityUnchanged() {
  const entry = firstEntry("Yilmaz, A. (2024). Gida teknolojisi arastirmalari.");
  const identity = entry.identity;

  assertEqual(identity.authorKind, "named", "identity author kind unchanged");
  assertEqual(identity.authors[0], "Yilmaz, A.", "identity author unchanged");
  assertEqual(identity.year, "2024", "identity year unchanged");
  assertEqual(identity.yearSuffix, null, "identity suffix unchanged");
  assertEqual(identity.title, "Gida teknolojisi arastirmalari.", "identity title unchanged");
  assertEqual(identity.parseStatus, "parsed", "identity parse unchanged");
  assertEqual(identity.confidence, "high", "identity confidence unchanged");
}

function assertSourceTypeClassificationUnchanged() {
  const entry = firstEntry(
    "Ozkaptan, C. ve Tekinalp, O. 2003. Uzay Uygulamalarinda Kucuk Uydularin Yeri. Pivolka, 1 (7): 3-13.",
  );

  assertEqual(entry.sourceTypeClassification.sourceType, "journal-article", "source type unchanged");
  assertEqual(entry.sourceTypeClassification.confidence, "high", "source confidence unchanged");
}

function assertCitationBibliographyLinkingUnchanged() {
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
