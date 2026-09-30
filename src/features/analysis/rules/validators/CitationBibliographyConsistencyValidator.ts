import type {
  CitationBibliographyAssociation,
  CitationBibliographyIdentityKey,
  NormalizedDocument,
  RuleDefinition,
  RuleEvidence,
  RuleResult,
  RuleResultStatus,
} from "../../types";
import { createParagraphEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";
import type { RuleValidator } from "./RuleValidator";

export class CitationBibliographyConsistencyValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertRule(rule);

    const associations = document.citationBibliographyLinks.associations;

    if (associations.length === 0) {
      return createResult(
        document,
        rule,
        "NOT_APPLICABLE",
        "Güvenilir metin içi atıf tespit edilmedi",
        "Güvenilir biçimde parse edilmiş metin içi atıf bulunmadığı için atıf-kaynakça tutarlılığı kontrolü uygulanmadı.",
      );
    }

    const missing = associations.filter((association) => association.status === "missing-entry");
    if (missing.length > 0) {
      return createResult(
        document,
        rule,
        "FAILED",
        `${missing.length} atıf için kaynakça girdisi bulunamadı: ${formatAssociations(missing)}`,
        `Bazı güvenilir metin içi atıflar için eşleşen kaynakça girdisi bulunamadı: ${formatAssociations(missing)}.`,
        missing,
      );
    }

    const ambiguous = associations.filter((association) => association.status === "ambiguous");
    if (ambiguous.length > 0) {
      return createResult(
        document,
        rule,
        "FAILED",
        `${ambiguous.length} atıf belirsiz eşleşti: ${formatAssociations(ambiguous)}`,
        `Bazı atıflar birden fazla kaynakça girdisiyle eşleştiği için tutarlılık güvenle doğrulanamadı: ${formatAssociations(ambiguous)}.`,
        ambiguous,
      );
    }

    const unresolved = associations.filter((association) => association.status === "unresolved");
    if (unresolved.length > 0) {
      return createResult(
        document,
        rule,
        "FAILED",
        `${unresolved.length} atıf çözümlenemedi: ${formatAssociations(unresolved)}`,
        `Bazı atıf-kaynakça bağlantıları yetersiz semantic evidence nedeniyle güvenle doğrulanamadı: ${formatAssociations(unresolved)}.`,
        unresolved,
      );
    }

    return createResult(
      document,
      rule,
      "PASSED",
      `${associations.length} güvenilir atıf kaynakçada eşleşti`,
      "Güvenilir biçimde parse edilen tüm metin içi atıflar kaynakça girdileriyle eşleşti.",
    );
  }
}

function assertRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "CITATION_BIBLIOGRAPHY_CONSISTENCY" } {
  if (rule.type !== "CITATION_BIBLIOGRAPHY_CONSISTENCY") {
    throw new Error(
      "CitationBibliographyConsistencyValidator yalnızca CITATION_BIBLIOGRAPHY_CONSISTENCY kurallarını çalıştırır.",
    );
  }
}

function createResult(
  document: Readonly<NormalizedDocument>,
  rule: Readonly<RuleDefinition>,
  status: RuleResultStatus,
  actual: string,
  message: string,
  associations: readonly CitationBibliographyAssociation[] = [],
): RuleResult {
  const evidence = associations
    .slice(0, MAX_RULE_EVIDENCE_ITEMS)
    .flatMap((association) => createAssociationEvidence(document, association));

  return {
    ruleId: rule.id,
    ruleName: rule.title,
    status,
    passed: status === "PASSED",
    severity: rule.severity,
    expected: "Güvenilir metin içi atıfların kaynakçada eşleşmesi",
    actual,
    message,
    ...(evidence.length > 0 ? { evidence } : {}),
    ...(associations.length > 0 ? { evidenceTotal: associations.length } : {}),
  };
}

function createAssociationEvidence(
  document: Readonly<NormalizedDocument>,
  association: Readonly<CitationBibliographyAssociation>,
): RuleEvidence[] {
  const occurrence = document.citationSemantics.occurrences.find(
    (candidate) => candidate.id === association.citationOccurrenceId,
  );
  const paragraph = occurrence
    ? document.paragraphs[occurrence.paragraphIndex]
    : undefined;

  if (!occurrence || !paragraph) {
    return [];
  }

  return [
    createParagraphEvidence(paragraph, occurrence.paragraphIndex, {
      expected: "Kaynakçada tek güvenilir eşleşme",
      actual: formatAssociationStatus(association),
    }),
  ];
}

function formatAssociationStatus(
  association: Readonly<CitationBibliographyAssociation>,
): string {
  switch (association.status) {
    case "missing-entry":
      return `Kaynakça eşleşmesi bulunamadı: ${formatKey(association.citationKey)}`;
    case "ambiguous":
      return `Belirsiz eşleşme: ${association.candidateEntryIds.length} aday, ${formatKey(association.citationKey)}`;
    case "unresolved":
      return `Güvenle çözümlenemedi: ${formatKey(association.citationKey)}`;
    case "matched":
      return `Eşleşti: ${association.matchedEntryId ?? "bilinmiyor"}`;
    default:
      return association.status;
  }
}

function formatAssociations(
  associations: readonly CitationBibliographyAssociation[],
): string {
  return associations.map((association) => formatKey(association.citationKey)).join(", ");
}

function formatKey(key: Readonly<CitationBibliographyIdentityKey> | null): string {
  if (key === null) {
    return "çözümlenemeyen atıf";
  }

  const author = key.normalizedAuthors.join(" ve ");
  const suffix = key.yearSuffix ?? "";

  return `${author}, ${key.year}${suffix}`;
}
