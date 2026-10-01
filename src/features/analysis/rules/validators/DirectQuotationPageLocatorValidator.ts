import type {
  DirectQuotationOccurrence,
  NormalizedDocument,
  RuleDefinition,
  RuleResult,
} from "../../types";
import { createParagraphEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";
import type { RuleValidator } from "./RuleValidator";

export class DirectQuotationPageLocatorValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertRule(rule);

    const evaluableQuotations = document.directQuotations.occurrences.filter(isEvaluableQuotation);

    if (evaluableQuotations.length === 0) {
      return {
        ruleId: rule.id,
        ruleName: rule.title,
        status: "NOT_APPLICABLE",
        passed: false,
        severity: rule.severity,
        expected: "Doğrudan alıntı atfında açık sayfa lokatörü",
        actual: "Değerlendirilebilir doğrudan alıntı atfı yok",
        message: "Güvenilir biçimde ilişkilendirilmiş doğrudan alıntı atfı bulunmadığı için sayfa lokatörü kontrolü uygulanmadı.",
      };
    }

    const failures = evaluableQuotations.filter((quotation) =>
      !quotation.citationEvidence.some((evidence) =>
        evidence.associationStatus === "associated" &&
        evidence.pageEvidence.hasPageMarker &&
        evidence.pageEvidence.confidence === "high" &&
        evidence.pageEvidence.marker !== null &&
        evidence.pageEvidence.pageStart !== null
      ),
    );
    const passed = failures.length === 0;

    return {
      ruleId: rule.id,
      ruleName: rule.title,
      status: passed ? "PASSED" : "FAILED",
      passed,
      severity: rule.severity,
      expected: "s. veya ss. ile açık sayfa lokatörü",
      actual: passed
        ? `${evaluableQuotations.length} doğrudan alıntı atfında sayfa lokatörü var`
        : `${failures.length} doğrudan alıntı atfında desteklenen sayfa lokatörü yok`,
      message: passed
        ? "Doğrudan alıntı atıflarında desteklenen sayfa lokatörü bulundu."
        : "Bazı doğrudan alıntı atıflarında desteklenen açık sayfa lokatörü bulunamadı.",
      ...(passed ? {} : {
        evidence: failures.slice(0, MAX_RULE_EVIDENCE_ITEMS).flatMap((quotation) =>
          createFailureEvidence(document, quotation),
        ),
        evidenceTotal: failures.length,
      }),
    };
  }
}

function assertRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "DIRECT_QUOTATION_PAGE_LOCATOR" } {
  if (rule.type !== "DIRECT_QUOTATION_PAGE_LOCATOR") {
    throw new Error(
      "DirectQuotationPageLocatorValidator yalnızca DIRECT_QUOTATION_PAGE_LOCATOR kurallarını çalıştırır.",
    );
  }
}

function isEvaluableQuotation(quotation: Readonly<DirectQuotationOccurrence>): boolean {
  return quotation.kind === "inline" &&
    quotation.confidence === "high" &&
    quotation.citationEvidence.some((evidence) =>
      evidence.associationStatus === "associated" &&
      evidence.citationOccurrenceId !== null &&
      evidence.ambiguityReason === null
    );
}

function createFailureEvidence(
  document: Readonly<NormalizedDocument>,
  quotation: Readonly<DirectQuotationOccurrence>,
) {
  const paragraph = document.paragraphs.find((candidate) => candidate.id === quotation.paragraphIds[0]);
  const paragraphIndex = paragraph ? document.paragraphs.indexOf(paragraph) : -1;

  if (!paragraph || paragraphIndex < 0) {
    return [];
  }

  return [
    createParagraphEvidence(paragraph, paragraphIndex, {
      expected: "s. veya ss. sayfa lokatörü",
      actual: "Desteklenen sayfa lokatörü yok",
    }),
  ];
}

