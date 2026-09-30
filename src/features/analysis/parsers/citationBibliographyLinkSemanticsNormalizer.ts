import type {
  BibliographyEntryOccurrence,
  CitationBibliographyAssociation,
  CitationBibliographyAssociationEvidence,
  CitationBibliographyIdentityKey,
  CitationItem,
  DocumentCitationBibliographyLinkSemantics,
  NormalizedDocument,
} from "../types";

export function createEmptyCitationBibliographyLinkSemantics():
  DocumentCitationBibliographyLinkSemantics {
  return {
    associations: [],
  };
}

export function normalizeCitationBibliographyLinkSemantics(
  document: Readonly<NormalizedDocument>,
): NormalizedDocument {
  return {
    ...document,
    citationBibliographyLinks: buildCitationBibliographyLinkSemantics(document),
  };
}

export function buildCitationBibliographyLinkSemantics(
  document: Readonly<NormalizedDocument>,
): DocumentCitationBibliographyLinkSemantics {
  const reliableEntries = (document.bibliography?.entries ?? [])
    .map((entry) => ({
      entry,
      key: createBibliographyEntryKey(entry),
    }))
    .filter((candidate): candidate is {
      entry: BibliographyEntryOccurrence;
      key: CitationBibliographyIdentityKey;
    } => candidate.key !== null);
  const associations = document.citationSemantics.occurrences.flatMap((occurrence) =>
    occurrence.items.map((item, itemIndex) =>
      associateCitationItem(
        occurrence.id,
        item,
        itemIndex,
        document.bibliography?.entries.length ?? 0,
        reliableEntries,
      ),
    ),
  );

  return {
    associations,
  };
}

function associateCitationItem(
  occurrenceId: string,
  item: Readonly<CitationItem>,
  itemIndex: number,
  bibliographyEntryCount: number,
  reliableEntries: readonly {
    entry: BibliographyEntryOccurrence;
    key: CitationBibliographyIdentityKey;
  }[],
): CitationBibliographyAssociation {
  const citationKey = createCitationItemKey(item);
  const baseEvidence: CitationBibliographyAssociationEvidence[] = [];

  if (citationKey === null) {
    return createAssociation({
      occurrenceId,
      item,
      itemIndex,
      citationKey,
      status: "unresolved",
      matchedEntryId: null,
      candidateEntryIds: [],
      confidence: "low",
      evidence: ["citation-item-unreliable"],
    });
  }

  baseEvidence.push("citation-item-reliable");

  if (reliableEntries.length === 0) {
    if (bibliographyEntryCount > 0) {
      return createAssociation({
        occurrenceId,
        item,
        itemIndex,
        citationKey,
        status: "unresolved",
        matchedEntryId: null,
        candidateEntryIds: [],
        confidence: "low",
        evidence: [
          ...baseEvidence,
          "bibliography-entry-identity-unreliable",
          "no-reliable-match",
        ],
      });
    }

    return createAssociation({
      occurrenceId,
      item,
      itemIndex,
      citationKey,
      status: "missing-entry",
      matchedEntryId: null,
      candidateEntryIds: [],
      confidence: "medium",
      evidence: [...baseEvidence, "no-reliable-match"],
    });
  }

  const candidates = reliableEntries.filter(({ key }) =>
    keysMatch(citationKey, key, item),
  );

  if (candidates.length === 0) {
    return createAssociation({
      occurrenceId,
      item,
      itemIndex,
      citationKey,
      status: "missing-entry",
      matchedEntryId: null,
      candidateEntryIds: [],
      confidence: "medium",
      evidence: [...baseEvidence, "no-reliable-match"],
    });
  }

  const matchEvidence = createMatchEvidence(citationKey, item);
  const candidateEntryIds = candidates.map(({ entry }) => entry.id);

  if (candidates.length === 1) {
    return createAssociation({
      occurrenceId,
      item,
      itemIndex,
      citationKey,
      status: "matched",
      matchedEntryId: candidates[0].entry.id,
      candidateEntryIds,
      confidence: item.confidence === "high" ? "high" : "medium",
      evidence: [
        ...baseEvidence,
        "bibliography-entry-identity-reliable",
        ...matchEvidence,
        "single-reliable-match",
      ],
    });
  }

  return createAssociation({
    occurrenceId,
    item,
    itemIndex,
    citationKey,
    status: "ambiguous",
    matchedEntryId: null,
    candidateEntryIds,
    confidence: "medium",
    evidence: [
      ...baseEvidence,
      "bibliography-entry-identity-reliable",
      ...matchEvidence,
      "multiple-reliable-matches",
    ],
  });
}

function createAssociation(params: {
  occurrenceId: string;
  item: Readonly<CitationItem>;
  itemIndex: number;
  citationKey: CitationBibliographyIdentityKey | null;
  status: CitationBibliographyAssociation["status"];
  matchedEntryId: string | null;
  candidateEntryIds: string[];
  confidence: CitationBibliographyAssociation["confidence"];
  evidence: readonly CitationBibliographyAssociationEvidence[];
}): CitationBibliographyAssociation {
  return {
    id: `${params.item.id}-bibliography-link-${params.itemIndex + 1}`,
    citationOccurrenceId: params.occurrenceId,
    citationItemId: params.item.id,
    citationKey: params.citationKey,
    status: params.status,
    matchedEntryId: params.matchedEntryId,
    candidateEntryIds: params.candidateEntryIds,
    confidence: params.confidence,
    evidence: dedupeEvidence(params.evidence),
  };
}

function createCitationItemKey(
  item: Readonly<CitationItem>,
): CitationBibliographyIdentityKey | null {
  if (
    item.confidence === "low" ||
    item.authorKind === "unknown" ||
    item.authors.length === 0 ||
    item.year.trim().length === 0
  ) {
    return null;
  }

  const normalizedAuthors = normalizeAuthorsForKind(item.authorKind, item.authors);

  if (normalizedAuthors.length === 0) {
    return null;
  }

  return {
    authorKind: item.authorKind,
    normalizedAuthors,
    year: item.year,
    yearSuffix: item.yearSuffix,
  };
}

function createBibliographyEntryKey(
  entry: Readonly<BibliographyEntryOccurrence>,
): CitationBibliographyIdentityKey | null {
  const { identity } = entry;

  if (
    entry.boundaryStatus !== "DEFINITE_ENTRY" ||
    identity.confidence === "low" ||
    identity.authorKind === "unknown" ||
    identity.authors.length === 0 ||
    identity.year === null
  ) {
    return null;
  }

  const normalizedAuthors = normalizeAuthorsForKind(
    identity.authorKind,
    identity.authors,
  );

  if (normalizedAuthors.length === 0) {
    return null;
  }

  return {
    authorKind: identity.authorKind,
    normalizedAuthors,
    year: identity.year,
    yearSuffix: identity.yearSuffix,
  };
}

function keysMatch(
  citationKey: Readonly<CitationBibliographyIdentityKey>,
  bibliographyKey: Readonly<CitationBibliographyIdentityKey>,
  item: Readonly<CitationItem>,
): boolean {
  return citationKey.authorKind === bibliographyKey.authorKind &&
    citationKey.year === bibliographyKey.year &&
    citationKey.yearSuffix === bibliographyKey.yearSuffix &&
    authorsMatch(citationKey, bibliographyKey, item);
}

function authorsMatch(
  citationKey: Readonly<CitationBibliographyIdentityKey>,
  bibliographyKey: Readonly<CitationBibliographyIdentityKey>,
  item: Readonly<CitationItem>,
): boolean {
  if (item.parseEvidence.includes("et-al-pattern")) {
    return citationKey.normalizedAuthors.length === 1 &&
      bibliographyKey.normalizedAuthors.length >= 1 &&
      citationKey.normalizedAuthors[0] === bibliographyKey.normalizedAuthors[0];
  }

  if (citationKey.normalizedAuthors.length !== bibliographyKey.normalizedAuthors.length) {
    return false;
  }

  return citationKey.normalizedAuthors.every(
    (author, index) => author === bibliographyKey.normalizedAuthors[index],
  );
}

function createMatchEvidence(
  citationKey: Readonly<CitationBibliographyIdentityKey>,
  item: Readonly<CitationItem>,
): CitationBibliographyAssociationEvidence[] {
  return [
    "author-kind-match",
    item.parseEvidence.includes("et-al-pattern")
      ? "lead-author-et-al-match"
      : "author-identity-match",
    "year-match",
    ...(citationKey.yearSuffix !== null ? ["year-suffix-match" as const] : []),
  ];
}

function normalizeAuthorsForKind(
  authorKind: CitationBibliographyIdentityKey["authorKind"],
  authors: readonly string[],
): string[] {
  if (authorKind === "anonymous") {
    return authors.map(normalizeAnonymousAuthor).filter(Boolean);
  }

  if (authorKind === "organization") {
    return authors.map(normalizeAuthorText).filter(Boolean);
  }

  if (authorKind === "named") {
    return authors.map(normalizeNamedAuthor).filter(Boolean);
  }

  return [];
}

function normalizeNamedAuthor(author: string): string {
  const surname = author.split(",")[0] ?? author;

  return normalizeAuthorText(surname);
}

function normalizeAnonymousAuthor(author: string): string {
  const normalized = normalizeAuthorText(author);

  return normalized === "anonymous" ? "anonim" : normalized;
}

function normalizeAuthorText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function dedupeEvidence(
  values: readonly CitationBibliographyAssociationEvidence[],
): CitationBibliographyAssociationEvidence[] {
  return [...new Set(values)];
}
