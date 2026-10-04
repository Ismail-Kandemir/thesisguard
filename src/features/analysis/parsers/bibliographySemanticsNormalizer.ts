import type {
  AcademicSectionOccurrence,
  BibliographyAuthorKind,
  BibliographyContributor,
  BibliographyContributorAmbiguityReason,
  BibliographyContributorCompleteness,
  BibliographyContributorKind,
  BibliographyContributorSemantics,
  BibliographyEntryBoundaryStatus,
  BibliographyEntryIdentity,
  BibliographyEntryIdentityEvidence,
  BibliographyEntryIdentityParseStatus,
  BibliographyEntryOccurrence,
  BibliographyPublicationFacts,
  BibliographySortKey,
  BibliographySourceType,
  BibliographySourceTypeClassification,
  BibliographySourceTypeEvidence,
  DocumentBibliography,
  NormalizedDocument,
  Paragraph,
  RuleDefinition,
} from "../types";
import { findDeclaredAcademicSectionOccurrencesByNames } from "../rules/academicSectionLookup";
import { normalizeSectionName } from "./documentSectionsParser";
import { EffectiveFormattingResolver } from "./effectiveFormattingResolver";

const BIBLIOGRAPHY_SECTION_NAMES = ["Kaynaklar", "References"];
const CONTRIBUTOR_PERSON_PATTERN =
  /[\p{Lu}][\p{L}'\u2019-]+(?:\s+(?:de|der|den|van|von|bin|al|el|da|dos|del|la|le|[\p{Lu}][\p{L}'\u2019-]+))*\s*,\s*(?:[\p{Lu}]\.?\s*)+/gu;
const ET_AL_PATTERN = /(?:^|[\s,;])((?:et\s+al\.?|ve\s+di(?:\u011f|g)\.?|vd\.))(?:$|[\s,;])/iu;
const TRAILING_AUTHOR_SEPARATOR_PATTERN = /(?:,|\bve|\band)\s*$/iu;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/iu;
const WEB_CONTEXT_PATTERN =
  /\b(?:retrieved|accessed|available\s+at|from|erisim|internet|online)\b|(?:\d{1,2}\s+[\p{L}]+\s+(?:18|19|20)\d{2})/iu;
const RETRIEVED_PATTERN = /\b(?:retrieved|accessed|from|available\s+at)\b/iu;
const ACCESS_DATE_PATTERN =
  /\b(?:\d{1,2}\s+[\p{L}]+\s+(?:18|19|20)\d{2}|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+(?:18|19|20)\d{2})\b/iu;
const IN_PRESS_PATTERN = /\b(?:baskida|baskıda|in\s+press)\b/iu;
const THESIS_PATTERN =
  /\b(?:phd\s+dissertation|doctoral\s+dissertation|master'?s?\s+thesis|dissertation|tezi|doktora\s+tezi|yuksek\s+lisans\s+tezi|yüksek\s+lisans\s+tezi)\b/iu;
const BOOK_CHAPTER_IN_PATTERN = /\bIn\s*:/u;
const BOOK_CHAPTER_EDITOR_PATTERN =
  /\b(?:ed\.|eds\.|editors?|ed\.?s\.?)(?:\b|(?=[,.;\s]))/iu;
const CONFERENCE_PATTERN =
  /\b(?:cong\.|congress|conference|symposium|sempozyumu|proceedings|world\s+cong\.|kongre)(?:\b|(?=[,.;]))/iu;
const JOURNAL_VOLUME_ISSUE_PAGES_PATTERN =
  /,\s*(?:[IVXLCDM]+|\d+)\s*\(\s*\d+\s*\)\s*:\s*\d+\s*[-–]\s*\d+\.?$/iu;
const JOURNAL_VOLUME_PAGES_PATTERN =
  /,\s*(?:[IVXLCDM]+|\d+)\s*:\s*\d+\s*[-–]\s*\d+\.?$/iu;
const PAGE_RANGE_PATTERN = /\b\d+\s*[-–]\s*\d+\.?$/u;
const BOOK_PAGE_COUNT_PATTERN = /\b\d+\s*(?:p|s)\.?$/iu;
const BOOK_PUBLISHER_PATTERN =
  /\b(?:press|publisher|publ\.|mcgraw-hill|blackwell|crc|saunders|wiley|springer|elsevier)\b/iu;
const PUBLISHER_CANDIDATE_PATTERN =
  /(?:\.\s*)([^.]*\b(?:Press|Publisher|Publ\.|McGraw-Hill|Blackwell|CRC|Saunders|Wiley|Springer|Elsevier)[^.]*\.)/iu;
const VOLUME_ISSUE_CANDIDATE_PATTERN =
  /\b((?:[IVXLCDM]+|\d+)\s*(?:\(\s*\d+\s*\))?)\s*:\s*\d+\s*[-–]\s*\d+/iu;
const YEAR_WITH_SUFFIX_PATTERN = /\b((?:18|19|20)\d{2})([a-z])?\b/iu;
const NAMED_AUTHOR_PATTERN = /[\p{Lu}][\p{L}'’-]+,\s*(?:[\p{Lu}]\.?\s*)+/gu;
const ANONYMOUS_AUTHOR_PATTERN = /^(?:anonim|anonymous)$/iu;
const ORGANIZATION_MARKER_PATTERN =
  /(?:üniversitesi|bakanlığı|kurumu|enstitüsü|komitesi|kurulu|\b(?:university|ministry|institute|association|organization|organisation|council|committee|who|unesco|fao)\b)/iu;

export function normalizeBibliographySemantics(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): NormalizedDocument {
  return {
    ...document,
    bibliography: buildDocumentBibliography(document, rules),
  };
}

export function getDocumentBibliography(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): DocumentBibliography {
  return document.bibliography ?? buildDocumentBibliography(document, rules);
}

export function buildDocumentBibliography(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): DocumentBibliography {
  const section = findBibliographySection(document, rules);

  if (!section) {
    return {
      sectionOccurrenceId: null,
      sectionIdentity: null,
      sectionHeadingParagraphId: null,
      sectionHeadingParagraphIndex: null,
      sectionBoundary: null,
      status: "SECTION_MISSING",
      entries: [],
      unresolvedParagraphIds: [],
    };
  }

  const entries = collectBibliographyEntries(document, section);
  const unresolvedParagraphIds = entries
    .filter((entry) => entry.boundaryStatus !== "DEFINITE_ENTRY")
    .flatMap((entry) => entry.paragraphIds);
  const status = entries.length > 0
    ? unresolvedParagraphIds.length > 0
      ? "SECTION_PRESENT_UNRESOLVED_CONTENT"
      : "SECTION_PRESENT_WITH_ENTRIES"
    : "SECTION_PRESENT_EMPTY";

  return {
    sectionOccurrenceId: section.id,
    sectionIdentity: section.identity,
    sectionHeadingParagraphId: section.headingParagraphId,
    sectionHeadingParagraphIndex: section.headingParagraphIndex,
    sectionBoundary: section.boundary,
    status,
    entries,
    unresolvedParagraphIds,
  };
}

function findBibliographySection(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): AcademicSectionOccurrence | null {
  return (
    findDeclaredAcademicSectionOccurrencesByNames(
      document,
      rules,
      BIBLIOGRAPHY_SECTION_NAMES,
    )[0] ?? null
  );
}

function collectBibliographyEntries(
  document: Readonly<NormalizedDocument>,
  section: Readonly<AcademicSectionOccurrence>,
): BibliographyEntryOccurrence[] {
  const resolver = new EffectiveFormattingResolver(
    document.styles,
    document.documentDefaults,
    document.themeFonts ?? null,
  );
  const candidateParagraphs = document.paragraphs
    .map((paragraph, paragraphIndex) => ({ paragraph, paragraphIndex }))
    .filter(({ paragraph, paragraphIndex }) =>
      isBibliographyEntryCandidate(document, section, paragraph, paragraphIndex),
    );

  return candidateParagraphs.map(({ paragraph, paragraphIndex }, index) => {
    const blockIndex = findBlockIndexByParagraphId(document, paragraph.id);
    const boundaryStatus = classifyEntryBoundary(paragraph, index);
    const identity = parseBibliographyEntryIdentity(paragraph.text, boundaryStatus);
    const contributorSemantics = parseBibliographyContributorSemantics(
      paragraph.text,
      boundaryStatus,
      identity,
    );

    return {
      id: `bibliography-entry-${index + 1}`,
      sectionOccurrenceId: section.id,
      paragraphIds: [paragraph.id],
      paragraphIndexes: [paragraphIndex],
      blockStart: blockIndex,
      blockEnd: blockIndex,
      visibleText: paragraph.text,
      normalizedText: normalizeEntryText(paragraph.text),
      entryIndex: index + 1,
      boundaryStatus,
      confidence: boundaryStatus === "DEFINITE_ENTRY" ? "high" : "low",
      identity,
      contributorSemantics,
      sortKey: createBibliographySortKey(
        contributorSemantics,
        identity,
        boundaryStatus,
        index + 1,
      ),
      sourceTypeClassification: classifyBibliographySourceType(
        paragraph.text,
        boundaryStatus,
        identity,
      ),
      formatting: {
        paragraphStyleId: paragraph.styleId,
        alignment: resolver.resolveParagraphAlignment(
          paragraph.styleId,
          paragraph.alignment,
        ),
        lineSpacing: resolver.resolveParagraphLineSpacing(
          paragraph.styleId,
          paragraph.lineSpacing,
        ),
        paragraphFormatting: resolver.resolveParagraphFormatting(
          paragraph.styleId,
          paragraph.paragraphFormatting,
        ),
      },
      evidence: createEntryEvidence(paragraph, boundaryStatus),
    };
  });
}

function parseBibliographyEntryIdentity(
  text: string,
  boundaryStatus: BibliographyEntryBoundaryStatus,
): BibliographyEntryIdentity {
  const normalizedText = normalizeVisibleText(text);
  const yearMatch = YEAR_WITH_SUFFIX_PATTERN.exec(normalizedText);
  const evidence: BibliographyEntryIdentityEvidence[] = [];

  if (!yearMatch) {
    return createIdentity({
      authors: [],
      authorKind: "unknown",
      year: null,
      yearSuffix: null,
      title: null,
      parseStatus: "unresolved",
      evidence: ["missing-year"],
      boundaryStatus,
    });
  }

  const year = yearMatch[1];
  const yearSuffix = yearMatch[2]?.toLocaleLowerCase("tr-TR") ?? null;
  evidence.push("year-pattern");
  if (yearSuffix !== null) {
    evidence.push("year-suffix");
  }

  const authorSegment = normalizeAuthorSegment(
    normalizedText.slice(0, yearMatch.index),
  );
  const authorIdentity = parseAuthorIdentity(authorSegment);
  evidence.push(...authorIdentity.evidence);

  const title = parseTitleAfterYear(
    normalizedText.slice(yearMatch.index + yearMatch[0].length),
  );
  evidence.push(title === null ? "missing-title" : "title-after-year");

  const parseStatus = determineIdentityParseStatus(
    authorIdentity.authorKind,
    year,
    title,
  );

  return createIdentity({
    authors: authorIdentity.authors,
    authorKind: authorIdentity.authorKind,
    year,
    yearSuffix,
    title,
    parseStatus,
    evidence,
    boundaryStatus,
  });
}

function parseBibliographyContributorSemantics(
  text: string,
  boundaryStatus: BibliographyEntryBoundaryStatus,
  identity: Readonly<BibliographyEntryIdentity>,
): BibliographyContributorSemantics {
  const normalizedText = normalizeVisibleText(text);
  const yearMatch = YEAR_WITH_SUFFIX_PATTERN.exec(normalizedText);
  const authorSegment = yearMatch
    ? normalizeAuthorSegment(normalizedText.slice(0, yearMatch.index))
    : "";
  const etAlEvidence = collectEtAlEvidence(authorSegment);

  if (boundaryStatus !== "DEFINITE_ENTRY") {
    return createContributorSemantics({
      contributors: [],
      completeness: "unknown",
      confidence: "low",
      hasEtAlEvidence: etAlEvidence.length > 0,
      etAlEvidence,
      ambiguityReasons: ["entry-boundary-unresolved"],
    });
  }

  if (!yearMatch) {
    return createContributorSemantics({
      contributors: [],
      completeness: "unknown",
      confidence: "low",
      hasEtAlEvidence: etAlEvidence.length > 0,
      etAlEvidence,
      ambiguityReasons: ["missing-year"],
    });
  }

  if (authorSegment.length === 0) {
    return createContributorSemantics({
      contributors: [],
      completeness: "unknown",
      confidence: "low",
      hasEtAlEvidence: etAlEvidence.length > 0,
      etAlEvidence,
      ambiguityReasons: ["missing-contributor"],
    });
  }

  const listLooksMalformed = TRAILING_AUTHOR_SEPARATOR_PATTERN.test(authorSegment);
  const contributors = createContributorsFromIdentity(identity, authorSegment);
  const ambiguityReasons: BibliographyContributorAmbiguityReason[] = [
    ...(identity.authorKind === "unknown" ? ["ambiguous-contributor" as const] : []),
    ...(listLooksMalformed ? ["malformed-contributor-list" as const] : []),
    ...(etAlEvidence.length > 0 ? ["et-al-marker" as const] : []),
    ...(contributors.length === 0 ? ["insufficient-identity-evidence" as const] : []),
  ];

  return createContributorSemantics({
    contributors: contributors.map((contributor) =>
      markContributorCompleteness(contributor, ambiguityReasons),
    ),
    completeness: determineContributorCompleteness(contributors, ambiguityReasons),
    confidence: determineContributorConfidence(
      contributors,
      ambiguityReasons,
      identity.confidence,
    ),
    hasEtAlEvidence: etAlEvidence.length > 0,
    etAlEvidence,
    ambiguityReasons: ambiguityReasons.length > 0 ? ambiguityReasons : ["none"],
  });
}

function createContributorsFromIdentity(
  identity: Readonly<BibliographyEntryIdentity>,
  authorSegment: string,
): BibliographyContributor[] {
  if (identity.authorKind === "named") {
    const segmentContributors = createPersonContributorsFromSegment(authorSegment);

    return segmentContributors.length > 0
      ? segmentContributors
      : identity.authors.map((author, index) => createPersonContributor(author, index + 1));
  }

  if (identity.authorKind === "organization") {
    return identity.authors.map((author, index) =>
      createSimpleContributor("organization", author, index + 1, "high"),
    );
  }

  if (identity.authorKind === "anonymous") {
    return identity.authors.map((author, index) =>
      createSimpleContributor("anonymous", author, index + 1, "high"),
    );
  }

  return [];
}

function createPersonContributorsFromSegment(authorSegment: string): BibliographyContributor[] {
  return [...authorSegment.matchAll(CONTRIBUTOR_PERSON_PATTERN)]
    .map((match, index) => createPersonContributor(normalizeAuthorName(match[0]), index + 1));
}

function createPersonContributor(author: string, order: number): BibliographyContributor {
  const [rawFamily = "", rawGiven = ""] = author.split(",", 2);
  const familyName = rawFamily.trim();
  const givenNameEvidence = rawGiven.trim().length > 0 ? rawGiven.trim() : null;
  const initials = givenNameEvidence?.match(/\p{Lu}\.?/gu)?.map((value) =>
    value.replace(/\./gu, ""),
  ) ?? [];
  const isComplete = familyName.length > 0 && initials.length > 0;

  return {
    kind: "person",
    familyName: familyName.length > 0 ? familyName : null,
    givenNameEvidence,
    initials,
    normalizedComparisonForm: normalizeContributorComparisonForm(author),
    originalText: author,
    displayText: author,
    order,
    parseConfidence: isComplete ? "high" : "medium",
    completeness: isComplete ? "complete" : "incomplete",
    ambiguityReason: isComplete ? "none" : "malformed-contributor-list",
  };
}

function createSimpleContributor(
  kind: Exclude<BibliographyContributorKind, "person" | "unknown">,
  author: string,
  order: number,
  confidence: BibliographyEntryIdentity["confidence"],
): BibliographyContributor {
  return {
    kind,
    familyName: null,
    givenNameEvidence: null,
    initials: [],
    normalizedComparisonForm: normalizeContributorComparisonForm(author),
    originalText: author,
    displayText: author,
    order,
    parseConfidence: confidence,
    completeness: "complete",
    ambiguityReason: "none",
  };
}

function markContributorCompleteness(
  contributor: BibliographyContributor,
  ambiguityReasons: readonly BibliographyContributorAmbiguityReason[],
): BibliographyContributor {
  if (contributor.completeness !== "complete") {
    return contributor;
  }

  if (ambiguityReasons.includes("et-al-marker") ||
    ambiguityReasons.includes("ambiguous-contributor")) {
    return {
      ...contributor,
      completeness: "ambiguous",
      parseConfidence: "low",
      ambiguityReason: ambiguityReasons.includes("et-al-marker")
        ? "et-al-marker"
        : "ambiguous-contributor",
    };
  }

  if (ambiguityReasons.includes("malformed-contributor-list")) {
    return {
      ...contributor,
      completeness: "incomplete",
      parseConfidence: "low",
      ambiguityReason: "malformed-contributor-list",
    };
  }

  return contributor;
}

function determineContributorCompleteness(
  contributors: readonly BibliographyContributor[],
  ambiguityReasons: readonly BibliographyContributorAmbiguityReason[],
): BibliographyContributorCompleteness {
  if (contributors.length === 0) {
    return "unknown";
  }

  if (ambiguityReasons.includes("et-al-marker") ||
    ambiguityReasons.includes("ambiguous-contributor")) {
    return "ambiguous";
  }

  if (ambiguityReasons.includes("malformed-contributor-list") ||
    contributors.some((contributor) => contributor.completeness === "incomplete")) {
    return "incomplete";
  }

  return "complete";
}

function determineContributorConfidence(
  contributors: readonly BibliographyContributor[],
  ambiguityReasons: readonly BibliographyContributorAmbiguityReason[],
  identityConfidence: BibliographyEntryIdentity["confidence"],
): BibliographyEntryIdentity["confidence"] {
  if (contributors.length === 0 ||
    ambiguityReasons.some((reason) => reason !== "none")) {
    return "low";
  }

  return identityConfidence;
}

function createContributorSemantics(
  params: Readonly<{
    contributors: readonly BibliographyContributor[];
    completeness: BibliographyContributorCompleteness;
    confidence: BibliographyEntryIdentity["confidence"];
    hasEtAlEvidence: boolean;
    etAlEvidence: readonly string[];
    ambiguityReasons: readonly BibliographyContributorAmbiguityReason[];
  }>,
): BibliographyContributorSemantics {
  return {
    contributors: [...params.contributors],
    completeness: params.completeness,
    confidence: params.confidence,
    hasEtAlEvidence: params.hasEtAlEvidence,
    etAlEvidence: [...params.etAlEvidence],
    ambiguityReasons: dedupeContributorReasons(params.ambiguityReasons),
  };
}

function createBibliographySortKey(
  contributorSemantics: Readonly<BibliographyContributorSemantics>,
  identity: Readonly<BibliographyEntryIdentity>,
  boundaryStatus: BibliographyEntryBoundaryStatus,
  entryOrder: number,
): BibliographySortKey | null {
  if (
    boundaryStatus !== "DEFINITE_ENTRY" ||
    contributorSemantics.completeness !== "complete" ||
    contributorSemantics.confidence === "low" ||
    contributorSemantics.hasEtAlEvidence ||
    identity.year === null
  ) {
    return null;
  }

  const contributorIdentities = contributorSemantics.contributors
    .map((contributor) => contributor.normalizedComparisonForm)
    .filter((value): value is string => value !== null && value.length > 0);

  if (contributorIdentities.length !== contributorSemantics.contributors.length ||
    contributorIdentities.length === 0) {
    return null;
  }

  return {
    contributorKind: contributorSemantics.contributors[0].kind,
    primaryContributorIdentity: contributorIdentities[0],
    subsequentContributorIdentities: contributorIdentities.slice(1),
    year: identity.year,
    yearSuffix: identity.yearSuffix,
    originalEntryOrder: entryOrder,
    confidence: contributorSemantics.confidence,
  };
}

function collectEtAlEvidence(authorSegment: string): string[] {
  const match = ET_AL_PATTERN.exec(authorSegment);

  return match?.[1] ? [match[1]] : [];
}

function normalizeContributorComparisonForm(value: string): string {
  const normalized = value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

  return normalized.length > 0 ? normalized : "";
}

function dedupeContributorReasons(
  values: readonly BibliographyContributorAmbiguityReason[],
): BibliographyContributorAmbiguityReason[] {
  return [...new Set(values)];
}

function parseAuthorIdentity(authorSegment: string): {
  authors: string[];
  authorKind: BibliographyAuthorKind;
  evidence: BibliographyEntryIdentityEvidence[];
} {
  if (authorSegment.length === 0) {
    return {
      authors: [],
      authorKind: "unknown",
      evidence: ["missing-author"],
    };
  }

  if (ANONYMOUS_AUTHOR_PATTERN.test(authorSegment)) {
    return {
      authors: [authorSegment],
      authorKind: "anonymous",
      evidence: ["author-segment-before-year", "anonymous-author-marker"],
    };
  }

  if (ORGANIZATION_MARKER_PATTERN.test(authorSegment)) {
    return {
      authors: [authorSegment],
      authorKind: "organization",
      evidence: ["author-segment-before-year", "organization-author-marker"],
    };
  }

  const namedAuthors = [...authorSegment.matchAll(NAMED_AUTHOR_PATTERN)]
    .map((match) => normalizeAuthorName(match[0]))
    .filter((author) => author.length > 0);

  if (namedAuthors.length > 0) {
    return {
      authors: namedAuthors,
      authorKind: "named",
      evidence: ["author-segment-before-year", "named-author-pattern"],
    };
  }

  return {
    authors: [],
    authorKind: "unknown",
    evidence: ["author-segment-before-year", "ambiguous-author"],
  };
}

function createIdentity(params: {
  authors: string[];
  authorKind: BibliographyAuthorKind;
  year: string | null;
  yearSuffix: string | null;
  title: string | null;
  parseStatus: BibliographyEntryIdentityParseStatus;
  evidence: readonly BibliographyEntryIdentityEvidence[];
  boundaryStatus: BibliographyEntryBoundaryStatus;
}): BibliographyEntryIdentity {
  return {
    authors: params.authors,
    authorKind: params.authorKind,
    year: params.year,
    yearSuffix: params.yearSuffix,
    title: params.title,
    parseStatus: params.parseStatus,
    confidence: determineIdentityConfidence(
      params.parseStatus,
      params.boundaryStatus,
    ),
    parseEvidence: dedupeIdentityEvidence(params.evidence),
  };
}

function determineIdentityParseStatus(
  authorKind: BibliographyAuthorKind,
  year: string | null,
  title: string | null,
): BibliographyEntryIdentityParseStatus {
  if (authorKind !== "unknown" && year !== null && title !== null) {
    return "parsed";
  }

  if (year !== null && (authorKind !== "unknown" || title !== null)) {
    return "partial";
  }

  return "unresolved";
}

function determineIdentityConfidence(
  parseStatus: BibliographyEntryIdentityParseStatus,
  boundaryStatus: BibliographyEntryBoundaryStatus,
): BibliographyEntryIdentity["confidence"] {
  if (boundaryStatus !== "DEFINITE_ENTRY") {
    return "low";
  }

  if (parseStatus === "parsed") {
    return "high";
  }

  if (parseStatus === "partial") {
    return "medium";
  }

  return "low";
}

function normalizeAuthorSegment(text: string): string {
  return text
    .replace(/[\s(]+$/u, "")
    .replace(/^[\s[(]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAuthorName(text: string): string {
  return text.replace(/\s+/g, " ").replace(/[,\s]+$/u, "").trim();
}

function parseTitleAfterYear(text: string): string | null {
  const title = text.replace(/^[\s).,;:]+/u, "").replace(/\s+/g, " ").trim();

  return title.length > 0 ? title : null;
}

function normalizeVisibleText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function dedupeIdentityEvidence(
  values: readonly BibliographyEntryIdentityEvidence[],
): BibliographyEntryIdentityEvidence[] {
  return [...new Set(values)];
}

function classifyBibliographySourceType(
  text: string,
  boundaryStatus: BibliographyEntryBoundaryStatus,
  identity: Readonly<BibliographyEntryIdentity>,
): BibliographySourceTypeClassification {
  const normalizedText = normalizeVisibleText(text);
  const publicationFacts = extractPublicationFacts(normalizedText);
  const identityEvidence = createIdentitySourceTypeEvidence(identity);

  if (boundaryStatus !== "DEFINITE_ENTRY") {
    return createSourceTypeClassification({
      sourceType: "unknown",
      confidence: "low",
      evidence: identityEvidence,
      ambiguityReason: "entry-boundary-unresolved",
      publicationFacts,
    });
  }

  if (identity.parseStatus === "unresolved") {
    return createSourceTypeClassification({
      sourceType: "unknown",
      confidence: "low",
      evidence: identityEvidence,
      ambiguityReason: "incomplete-entry-identity",
      publicationFacts,
    });
  }

  const candidates = collectSourceTypeCandidates(normalizedText, publicationFacts);
  if (candidates.length === 0) {
    return createSourceTypeClassification({
      sourceType: "unknown",
      confidence: "low",
      evidence: identityEvidence,
      ambiguityReason: publicationFacts.urlCandidate
        ? "url-without-web-context"
        : "insufficient-evidence",
      publicationFacts,
    });
  }

  const uniqueTypes = [...new Set(candidates.map((candidate) => candidate.sourceType))];
  if (uniqueTypes.length > 1) {
    return createSourceTypeClassification({
      sourceType: "ambiguous",
      confidence: "low",
      evidence: [
        ...identityEvidence,
        ...candidates.flatMap((candidate) => candidate.evidence),
      ],
      ambiguityReason: "conflicting-source-type-evidence",
      publicationFacts,
    });
  }

  const candidate = candidates[0];

  return createSourceTypeClassification({
    sourceType: candidate.sourceType,
    confidence: identity.confidence === "high" ? "high" : "medium",
    evidence: [...identityEvidence, ...candidate.evidence],
    ambiguityReason: "none",
    publicationFacts,
  });
}

function collectSourceTypeCandidates(
  text: string,
  facts: Readonly<BibliographyPublicationFacts>,
): {
  sourceType: Exclude<BibliographySourceType, "unknown" | "ambiguous">;
  evidence: BibliographySourceTypeEvidence[];
}[] {
  const candidates: {
    sourceType: Exclude<BibliographySourceType, "unknown" | "ambiguous">;
    evidence: BibliographySourceTypeEvidence[];
  }[] = [];

  if (facts.inPressMarker !== null) {
    candidates.push({
      sourceType: "in-press",
      evidence: ["in-press-marker"],
    });
  }

  if (facts.thesisMarker !== null) {
    candidates.push({
      sourceType: "thesis",
      evidence: ["thesis-marker"],
    });
  }

  if (
    facts.urlCandidate !== null &&
    (facts.accessDateCandidate !== null || RETRIEVED_PATTERN.test(text)) &&
    WEB_CONTEXT_PATTERN.test(text)
  ) {
    candidates.push({
      sourceType: "web-online",
      evidence: [
        "url-marker",
        ...(facts.accessDateCandidate !== null
          ? ["access-date-marker" as const]
          : []),
        ...(RETRIEVED_PATTERN.test(text) ? ["retrieved-marker" as const] : []),
      ],
    });
  }

  if (facts.conferenceProceedingsMarker !== null) {
    candidates.push({
      sourceType: "conference-proceedings",
      evidence: ["conference-marker"],
    });
  }

  if (BOOK_CHAPTER_IN_PATTERN.test(text) && BOOK_CHAPTER_EDITOR_PATTERN.test(text)) {
    candidates.push({
      sourceType: "book-chapter",
      evidence: ["book-chapter-in-marker", "book-chapter-editor-marker"],
    });
  }

  if (
    (JOURNAL_VOLUME_ISSUE_PAGES_PATTERN.test(text) ||
      JOURNAL_VOLUME_PAGES_PATTERN.test(text)) &&
    facts.journalOrVenueCandidate !== null &&
    facts.publisherCandidate === null
  ) {
    candidates.push({
      sourceType: "journal-article",
      evidence: [
        JOURNAL_VOLUME_ISSUE_PAGES_PATTERN.test(text)
          ? "journal-volume-issue-pages"
          : "journal-volume-pages",
      ],
    });
  }

  if (
    BOOK_PAGE_COUNT_PATTERN.test(text) &&
    facts.publisherCandidate !== null &&
    !BOOK_CHAPTER_IN_PATTERN.test(text)
  ) {
    candidates.push({
      sourceType: "book",
      evidence: ["book-page-count", "book-publisher-marker"],
    });
  }

  return candidates;
}

function extractPublicationFacts(text: string): BibliographyPublicationFacts {
  const urlCandidate = firstMatch(text, URL_PATTERN);
  const accessDateCandidate = firstMatch(text, ACCESS_DATE_PATTERN);
  const inPressMarker = firstMatch(text, IN_PRESS_PATTERN);
  const thesisMarker = firstMatch(text, THESIS_PATTERN);
  const conferenceProceedingsMarker = firstMatch(text, CONFERENCE_PATTERN);
  const volumeIssueCandidate = firstCapture(text, VOLUME_ISSUE_CANDIDATE_PATTERN);
  const pageRangeCandidate = firstMatch(text, PAGE_RANGE_PATTERN);
  const publisherCandidate = firstCapture(text, PUBLISHER_CANDIDATE_PATTERN);

  return {
    journalOrVenueCandidate: extractJournalOrVenueCandidate(text),
    volumeIssueCandidate,
    pageRangeCandidate,
    publisherCandidate,
    thesisMarker,
    conferenceProceedingsMarker,
    urlCandidate,
    accessDateCandidate,
    inPressMarker,
  };
}

function extractJournalOrVenueCandidate(text: string): string | null {
  const match = /([^.]*)?,\s*(?:[IVXLCDM]+|\d+)\s*(?:\(\s*\d+\s*\))?\s*:/iu.exec(text);
  const candidate = match?.[1]?.trim() ?? null;

  if (!candidate || candidate.length === 0 || BOOK_PUBLISHER_PATTERN.test(candidate)) {
    return null;
  }

  const lastSentence = candidate.split(".").map((part) => part.trim()).filter(Boolean).pop();

  return lastSentence ?? candidate;
}

function createIdentitySourceTypeEvidence(
  identity: Readonly<BibliographyEntryIdentity>,
): BibliographySourceTypeEvidence[] {
  switch (identity.parseStatus) {
    case "parsed":
      return ["identity-parsed"];
    case "partial":
      return ["identity-partial"];
    case "unresolved":
      return ["identity-unresolved"];
    default:
      return [];
  }
}

function createSourceTypeClassification(
  params: Readonly<{
    sourceType: BibliographySourceType;
    confidence: BibliographySourceTypeClassification["confidence"];
    evidence: readonly BibliographySourceTypeEvidence[];
    ambiguityReason: BibliographySourceTypeClassification["ambiguityReason"];
    publicationFacts: BibliographyPublicationFacts;
  }>,
): BibliographySourceTypeClassification {
  return {
    sourceType: params.sourceType,
    confidence: params.confidence,
    evidence: [...new Set(params.evidence)],
    ambiguityReason: params.ambiguityReason,
    publicationFacts: params.publicationFacts,
  };
}

function firstMatch(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text);

  return match?.[0] ?? null;
}

function firstCapture(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text);

  return match?.[1]?.trim() ?? null;
}

function isBibliographyEntryCandidate(
  document: Readonly<NormalizedDocument>,
  section: Readonly<AcademicSectionOccurrence>,
  paragraph: Readonly<Paragraph>,
  paragraphIndex: number,
): boolean {
  if (
    paragraphIndex < section.boundary.startParagraphIndex ||
    paragraphIndex > section.boundary.endParagraphIndex
  ) {
    return false;
  }

  if (
    paragraph.isEmpty ||
    paragraph.text.trim().length === 0 ||
    paragraph.contentScope !== "document" ||
    paragraph.isTableOfContentsEntry ||
    paragraph.isInTableCell
  ) {
    return false;
  }

  if (paragraph.id === section.headingParagraphId) {
    return false;
  }

  return !document.academicSections.occurrences.some(
    (occurrence) => occurrence.headingParagraphId === paragraph.id,
  );
}

function classifyEntryBoundary(
  paragraph: Readonly<Paragraph>,
  index: number,
): BibliographyEntryBoundaryStatus {
  const text = paragraph.text.trim();

  if (text.length === 0) {
    return "UNRESOLVED";
  }

  if (index > 0 && startsLikeContinuation(text)) {
    return "POSSIBLE_CONTINUATION";
  }

  return "DEFINITE_ENTRY";
}

function startsLikeContinuation(text: string): boolean {
  const firstCharacter = text.trimStart().charAt(0);

  return firstCharacter.length > 0 && firstCharacter === firstCharacter.toLocaleLowerCase("tr-TR") &&
    firstCharacter !== firstCharacter.toLocaleUpperCase("tr-TR");
}

function createEntryEvidence(
  paragraph: Readonly<Paragraph>,
  boundaryStatus: BibliographyEntryBoundaryStatus,
): string[] {
  return [
    "academic-section-boundary",
    "visible-document-paragraph",
    ...(paragraph.numbering.source !== "none" ? ["word-numbering"] : []),
    ...(boundaryStatus === "POSSIBLE_CONTINUATION"
      ? ["possible-continuation-paragraph"]
      : []),
  ];
}

function normalizeEntryText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

function findBlockIndexByParagraphId(
  document: Readonly<NormalizedDocument>,
  paragraphId: string,
): number | null {
  return (
    document.blocks.find(
      (block) => block.type === "paragraph" && block.paragraphId === paragraphId,
    )?.blockIndex ?? null
  );
}

export function isBibliographySectionIdentity(identity: string | null): boolean {
  return identity !== null &&
    BIBLIOGRAPHY_SECTION_NAMES.some((name) => identity === normalizeSectionName(name));
}
