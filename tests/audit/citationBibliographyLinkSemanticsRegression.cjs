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
  assertExactSingleMatch();
  assertNoMatchMissingEntry();
  assertDuplicateCandidatesAmbiguous();
  assertInsufficientIdentityUnresolved();
  assertYearSuffixMismatch();
  assertTwoAuthorMatch();
  assertEtAlMatch();
  assertAnonymousMatch();
  assertOrganizationAuthorKindPreserved();
  assertDuplicateVisibleCitationLinksDeterministic();
  assertCitationAndBibliographyExclusionsPreserved();
  assertSyntheticSecondUniversityUsesGenericLinker();
  assertGirisFallbackDoesNotDuplicateCanonicalBoundary();
  assertGirisFallbackDoesNotCreateFalseBodyBoundary();

  console.log(JSON.stringify({
    phase: "citation-bibliography-sprint-5",
    result: "PASS",
    audit: path.basename(__filename),
  }, null, 2));
}

function assertExactSingleMatch() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Metin ici atif vardir (Yilmaz, 2024).") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Kaynak basligi."),
  );
  const link = onlyLink(document);

  assertEqual(link.status, "matched", "exact match status");
  assertEqual(link.matchedEntryId, "bibliography-entry-1", "exact matched entry");
  assertEqual(link.candidateEntryIds.length, 1, "exact candidate count");
  assertEqual(link.evidence.includes("author-identity-match"), true, "author evidence");
}

function assertNoMatchMissingEntry() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Metin ici atif vardir (Yilmaz, 2024).") +
      heading("Kaynaklar") +
      paragraph("Demir, A. (2024). Baska kaynak."),
  );
  const link = onlyLink(document);

  assertEqual(link.status, "missing-entry", "missing entry status");
  assertEqual(link.matchedEntryId, null, "missing matched entry null");
  assertEqual(link.candidateEntryIds.length, 0, "missing candidate count");
}

function assertDuplicateCandidatesAmbiguous() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Ayni anahtar birden cok kaynakla eslesir (Yilmaz, 2024).") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Ilk kaynak.") +
      paragraph("Yilmaz, B. (2024). Ikinci kaynak."),
  );
  const link = onlyLink(document);

  assertEqual(link.status, "ambiguous", "ambiguous status");
  assertEqual(link.matchedEntryId, null, "ambiguous does not choose");
  assertEqual(link.candidateEntryIds.length, 2, "ambiguous candidate count");
}

function assertInsufficientIdentityUnresolved() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Belirsiz bibliography kimligi zorlanmaz (Yilmaz, 2024).") +
      heading("Kaynaklar") +
      paragraph("Research Team (2024). Belirsiz kaynak."),
  );
  const link = onlyLink(document);

  assertEqual(link.status, "unresolved", "unreliable bibliography identity unresolved");
  assertEqual(link.evidence.includes("bibliography-entry-identity-unreliable"), true,
    "unreliable bibliography evidence");
}

function assertYearSuffixMismatch() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Suffix ayrimi korunur (Yilmaz, 2020a).") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2020b). Ayni yil b kaynagi."),
  );
  const link = onlyLink(document);

  assertEqual(link.status, "missing-entry", "suffix mismatch missing");
  assertEqual(link.matchedEntryId, null, "suffix mismatch no match");
}

function assertTwoAuthorMatch() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Iki yazarli kaynak eslesir (Yilmaz ve Demir, 2024).") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. ve Demir, B. (2024). Ortak calisma."),
  );
  const link = onlyLink(document);

  assertEqual(link.status, "matched", "two-author match status");
  assertEqual(link.citationKey.normalizedAuthors.length, 2, "two-author key count");
}

function assertEtAlMatch() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Cok yazarli kaynak eslesir (Yilmaz vd., 2020).") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A., Demir, B. ve Kaya, C. (2020). Cok yazarli calisma."),
  );
  const link = onlyLink(document);

  assertEqual(link.status, "matched", "et-al match status");
  assertEqual(link.evidence.includes("lead-author-et-al-match"), true, "et-al evidence");
}

function assertAnonymousMatch() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Anonim kaynak eslesir (Anonim, 2024).") +
      heading("Kaynaklar") +
      paragraph("Anonim (2024). Adsiz kaynak."),
  );
  const link = onlyLink(document);

  assertEqual(link.status, "matched", "anonymous match status");
  assertEqual(link.citationKey.authorKind, "anonymous", "anonymous key kind");
}

function assertOrganizationAuthorKindPreserved() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Kurumsal kaynak kisiye indirgenmez (World Health Organization, 2024).") +
      heading("Kaynaklar") +
      paragraph("World Health Organization (2024). Kurumsal rapor.") +
      paragraph("World, H. (2024). Kisi yazari."),
  );
  const link = onlyLink(document);

  assertEqual(link.status, "matched", "organization match status");
  assertEqual(link.citationKey.authorKind, "organization", "organization key kind");
  assertEqual(link.matchedEntryId, "bibliography-entry-1", "organization matched entry");
}

function assertDuplicateVisibleCitationLinksDeterministic() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Ilk atif (Yilmaz, 2024).") +
      paragraph("Ikinci atif (Yilmaz, 2024).") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Kaynak basligi."),
  );
  const links = document.citationBibliographyLinks.associations;

  assertEqual(links.length, 2, "duplicate link count");
  assertNotEqual(links[0].id, links[1].id, "duplicate link ids differ");
  assertEqual(links[0].matchedEntryId, links[1].matchedEntryId, "duplicate matched entry deterministic");
}

function assertCitationAndBibliographyExclusionsPreserved() {
  const document = semanticDocument(
    heading("Giris") +
      tocParagraph("TOC (Yilmaz, 2024)") +
      textboxParagraph("Textbox (Yilmaz, 2024)") +
      deletedParagraph("Deleted (Yilmaz, 2024)") +
      paragraph("Metin atfi (Yilmaz, 2024).") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Kaynak basligi.") +
      paragraph("Metin gibi gorunse de bibliography icidir (Demir, 2023)."),
  );

  assertEqual(document.citationSemantics.occurrences.length, 1, "only body citation occurrence");
  assertEqual(document.citationBibliographyLinks.associations.length, 1, "only body citation link");
  assertEqual(document.bibliography.entries.length, 2, "bibliography entries preserved");
}

function assertSyntheticSecondUniversityUsesGenericLinker() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Generic linker calisir (Smith, 2021).") +
      heading("References") +
      paragraph("Smith, J. (2021). Generic source."),
    [
      {
        ...requiredRule("Giris"),
        id: "synthetic.university.program.introduction",
      },
      {
        ...requiredRule("References"),
        id: "synthetic.university.program.references",
      },
    ],
  );
  const link = onlyLink(document);

  assertEqual(link.status, "matched", "synthetic university generic link");
  assertEqual(link.matchedEntryId, "bibliography-entry-1", "synthetic matched entry");
}

function assertGirisFallbackDoesNotDuplicateCanonicalBoundary() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Ana metin (Yilmaz, 2024)."),
    [requiredRule("Giris"), requiredRule("Kaynaklar")],
  );

  assertEqual(document.academicScopes.mainContentBoundary.boundaryParagraphId, "paragraph-1",
    "Giris fallback boundary selected");
  assertEqual(document.academicScopes.mainContentBoundary.reason, "main-content-section",
    "Giris fallback not ambiguous");
}

function assertGirisFallbackDoesNotCreateFalseBodyBoundary() {
  const document = semanticDocument(
    paragraph("Giris verileri yalniz prose metindir.") +
      paragraph("Bu atif body sayilmamalidir (Yilmaz, 2024)."),
    [requiredRule("Giris"), requiredRule("Kaynaklar")],
  );

  assertEqual(document.academicScopes.mainContentBoundary, null, "prose Giris no boundary");
  assertEqual(document.citationSemantics.occurrences.length, 0, "no false body citation");
}

function onlyLink(document) {
  assertEqual(document.citationBibliographyLinks.associations.length, 1, "single link count");

  return document.citationBibliographyLinks.associations[0];
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
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function tocParagraph(text) {
  return `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> TOC \\o "1-3" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${text}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
}

function textboxParagraph(text) {
  return `<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData><wps:wsp xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:txbx><w:txbxContent>${paragraph(text)}</w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function deletedParagraph(text) {
  return `<w:p><w:del w:id="1"><w:r><w:t>${text}</w:t></w:r></w:del></w:p>`;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertNotEqual(actual, expected, label) {
  if (actual === expected) {
    throw new Error(`${label}: expected values to differ, both were ${JSON.stringify(actual)}`);
  }
}

main();

