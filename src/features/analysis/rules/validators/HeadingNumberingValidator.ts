import { normalizeSectionName } from "../../parsers/documentSectionsParser";
import type {
  DocumentHeadingOccurrence,
  HeadingNumberingRuleExpected,
  HeadingNumberingSectionExpectation,
  NormalizedDocument,
  RuleDefinition,
  RuleResult,
  RuleResultStatus,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";
import { createHeadingEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";

const MAX_FAILURE_SAMPLES = 3;

interface LocatedHeading {
  expectation: HeadingNumberingSectionExpectation;
  occurrence: DocumentHeadingOccurrence;
}

interface HeadingNumberingFailure {
  actual: string;
  expected: string;
  message: string;
  occurrence: DocumentHeadingOccurrence;
}

export class HeadingNumberingValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertHeadingNumberingRule(rule);
    const expected = getExpected(rule.expected);
    const occurrencesBySection = indexNamedOccurrences(document.headings);
    const located = expected.sections.flatMap((expectation) => {
      const occurrences = occurrencesBySection.get(normalizeSectionName(expectation.section)) ?? [];
      return occurrences.length === 1 ? [{ expectation, occurrence: occurrences[0] }] : [];
    });

    if (located.length === 0) {
      return createResult(rule, expected, "NOT_APPLICABLE", "Uygulanmadı",
        "Numaralandırması güvenilir biçimde değerlendirilebilecek benzersiz ana bölüm başlığı bulunmadı.");
    }

    const failures = located.flatMap((item) => getFailure(item));
    if (failures.length === 0) {
      return createResult(rule, expected, "PASSED",
        `${located.length}/${expected.sections.length} bulunan bölüm uygun`,
        "Bulunan ana bölüm başlıklarının numaralandırma seviyeleri kurala uygundur.");
    }

    const samples = failures.slice(0, MAX_FAILURE_SAMPLES).map((failure) => failure.message);
    return {
      ...createResult(rule, expected, "FAILED", samples.join("; "),
        `${failures.length} başlığın numaralandırması uygun değil: ${samples.join("; ")}`),
      evidence: failures.slice(0, MAX_RULE_EVIDENCE_ITEMS).map((failure) =>
        createHeadingEvidence(failure.occurrence, {
          actual: failure.actual,
          expected: failure.expected,
        }),
      ),
      evidenceTotal: failures.length,
    };
  }
}

function indexNamedOccurrences(
  headings: readonly DocumentHeadingOccurrence[],
): ReadonlyMap<string, DocumentHeadingOccurrence[]> {
  const index = new Map<string, DocumentHeadingOccurrence[]>();
  for (const heading of headings) {
    if (!heading.isRuleDefinedSection || heading.sectionName === null) continue;
    const key = normalizeSectionName(heading.sectionName);
    const occurrences = index.get(key) ?? [];
    occurrences.push(heading);
    index.set(key, occurrences);
  }
  return index;
}

function getFailure(item: LocatedHeading): HeadingNumberingFailure[] {
  const { expectation, occurrence } = item;
  const expected = formatExpectedLevel(expectation.level);
  if (!isReliablyNumbered(occurrence)) {
    return [{
      actual: "Numaralandırılmamış",
      expected,
      message: `“${expectation.section}” başlığı bulundu ancak numaralandırılmamış.`,
      occurrence,
    }];
  }
  if (occurrence.numberingLevel !== expectation.level) {
    return [{
      actual: formatLevel(occurrence.numberingLevel),
      expected,
      message: `“${expectation.section}” başlığı ${formatLevel(occurrence.numberingLevel)} düzeyinde bulundu; ${formatExpectedLevel(expectation.level)} numaralandırılması bekleniyor.`,
      occurrence,
    }];
  }
  return [];
}

function isReliablyNumbered(heading: Readonly<DocumentHeadingOccurrence>): boolean {
  if (heading.numberingSource === "text") {
    return heading.visibleLabel !== null && heading.numberingLevel !== null;
  }
  if (heading.numberingSource === "word") {
    return heading.numId !== null && heading.numberingLevel !== null;
  }
  return false;
}

function assertHeadingNumberingRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "HEADING_NUMBERING" } {
  if (rule.type !== "HEADING_NUMBERING") {
    throw new Error("HeadingNumberingValidator yalnızca HEADING_NUMBERING tipindeki kuralları çalıştırır.");
  }
}

function getExpected(expected: RuleDefinition["expected"]): HeadingNumberingRuleExpected {
  if (typeof expected !== "object" || expected === null || !("sections" in expected) ||
      !Array.isArray(expected.sections) || expected.sections.length === 0 ||
      !expected.sections.every(isValidExpectation)) {
    throw new Error("HEADING_NUMBERING kuralı en az bir geçerli section ve non-negative integer level tanımlamalıdır.");
  }
  if (hasOverlappingExpectedNames(expected.sections)) {
    throw new Error("HEADING_NUMBERING kuralı aynı section veya alias adını birden fazla expectation içinde tanımlayamaz.");
  }
  return { sections: expected.sections.filter(isValidExpectation) };
}

function isValidExpectation(value: unknown): value is HeadingNumberingSectionExpectation {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { section?: unknown; aliases?: unknown; level?: unknown };
  return typeof candidate.section === "string" && candidate.section.trim().length > 0 &&
    (candidate.aliases === undefined || (Array.isArray(candidate.aliases) &&
      candidate.aliases.every((alias) => typeof alias === "string" && alias.trim().length > 0))) &&
    typeof candidate.level === "number" && Number.isInteger(candidate.level) && candidate.level >= 0;
}

function hasOverlappingExpectedNames(expectations: readonly HeadingNumberingSectionExpectation[]): boolean {
  const names = expectations.flatMap((expectation) => [expectation.section, ...(expectation.aliases ?? [])]);
  const normalized = names.map(normalizeSectionName);
  return new Set(normalized).size !== normalized.length;
}

function formatExpectedLevel(level: number): string {
  return level === 0 ? "ana bölüm düzeyinde" : `${level + 1}. düzeyde`;
}

function formatLevel(level: number | null): string {
  return level === null ? "belirlenemeyen" : String(level + 1);
}

function createResult(rule: RuleDefinition, expected: HeadingNumberingRuleExpected,
  status: RuleResultStatus, actual: string, message: string): RuleResult {
  return { ruleId: rule.id, ruleName: rule.title, status, passed: status === "PASSED",
    severity: rule.severity,
    expected: expected.sections.map((item) => `${item.section}: düzey ${item.level + 1}`).join(", "),
    actual, message };
}
