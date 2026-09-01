import { sectionMatchesAnyExpectedName } from "../../parsers/sectionNameMatcher";
import type {
  DocumentSection,
  NormalizedDocument,
  PageNumberFormat,
  PageNumberSection,
  PageNumberSequenceRuleExpected,
  RuleDefinition,
  RuleEvidence,
  RuleResult,
  RuleResultStatus,
} from "../../types";
import {
  createDocumentFormatEvidence,
  createSectionEvidence,
  MAX_RULE_EVIDENCE_ITEMS,
} from "../ruleEvidence";
import type { RuleValidator } from "./RuleValidator";

export class PageNumberSequenceValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertPageNumberSequenceRule(rule);
    const expected = getExpected(rule.expected);
    const names = [expected.transitionSection, ...(expected.aliases ?? [])];
    const occurrences = document.sections.filter((section) =>
      sectionMatchesAnyExpectedName(section, names),
    );

    if (occurrences.length === 0) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadı",
        `${expected.transitionSection} bölümü bulunmadığı için sayfa numarası geçişi kontrol edilmedi.`,
      );
    }

    if (occurrences.length > 1) {
      return createResult(
        rule,
        expected,
        "FAILED",
        "Geçiş bölümü birden fazla kez bulundu",
        `${expected.transitionSection} bölümü birden fazla kez bulunduğu için sayfa numarası geçişi güvenle belirlenemedi.`,
        occurrences.slice(0, MAX_RULE_EVIDENCE_ITEMS).map((section) =>
          createSectionEvidence(section, {
            actual: "Birden fazla geçiş bölümü bulundu",
            expected: "Tek geçiş bölümü",
            sectionName: section.displayName,
          }),
        ),
        occurrences.length,
      );
    }

    const sections = resolveEffectiveFormats(document.pageNumbering.sections);

    if (sections.length === 0) {
      return createResult(
        rule,
        expected,
        "FAILED",
        "Bölüm sayfa numarası bilgisi tespit edilemedi",
        "DOCX bölüm özelliklerinde sayfa numarası biçimi tespit edilemedi.",
        [
          createDocumentFormatEvidence("Sayfa numarası bölüm yapılandırması", {
            actual: "Tespit edilmedi",
            expected: "DOCX bölüm sayfa numarası yapılandırması",
          }),
        ],
        1,
      );
    }

    const transitionIndex = findContainingSectionIndex(sections, occurrences[0]);

    if (transitionIndex === -1) {
      return createResult(
        rule,
        expected,
        "FAILED",
        formatActual(sections),
        `${expected.transitionSection} bölümünün sayfa numarası bölümü belirlenemedi.`,
        [
          createDocumentFormatEvidence("Geçiş bölümü sayfa numarası yapılandırması", {
            actual: "Tespit edilemedi",
            expected: `${expected.transitionSection} bölümünü içeren belge bölümü`,
          }),
        ],
        1,
      );
    }

    const before = sections.slice(0, transitionIndex);
    const from = sections.slice(transitionIndex);
    const transition = from[0];
    const beforeMatches =
      before.length > 0 && before.every((section) => section.effectiveFormat === expected.beforeFormat);
    const fromMatches =
      from.length > 0 && from.every((section) => section.effectiveFormat === expected.fromFormat);
    const restartMatches =
      expected.restartAt === undefined || transition.start === expected.restartAt;
    const passed = beforeMatches && fromMatches && restartMatches;
    const evidence = passed
      ? []
      : createSequenceEvidence(
          expected,
          sections,
          transitionIndex,
          beforeMatches,
          fromMatches,
          restartMatches,
        );

    return createResult(
      rule,
      expected,
      passed ? "PASSED" : "FAILED",
      formatActual(sections),
      passed
        ? `${rule.title} kuralı başarılı.`
        : createFailureMessage(expected, beforeMatches, fromMatches, restartMatches),
      passed ? undefined : evidence.slice(0, MAX_RULE_EVIDENCE_ITEMS),
      passed ? undefined : evidence.length,
    );
  }
}

interface EffectivePageNumberSection extends PageNumberSection {
  effectiveFormat: string | null;
}

function resolveEffectiveFormats(
  sections: readonly PageNumberSection[],
): EffectivePageNumberSection[] {
  let inheritedFormat: string | null = null;

  return sections.map((section) => {
    const effectiveFormat = section.format ?? (section.start !== null ? "decimal" : inheritedFormat);

    if (effectiveFormat !== null) {
      inheritedFormat = effectiveFormat;
    }

    return { ...section, effectiveFormat };
  });
}

function findContainingSectionIndex(
  sections: readonly EffectivePageNumberSection[],
  transitionSection: Readonly<DocumentSection>,
): number {
  return sections.findIndex(
    (section) => section.endParagraphIndex >= transitionSection.paragraphIndex,
  );
}

function assertPageNumberSequenceRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "PAGE_NUMBER_SEQUENCE" } {
  if (rule.type !== "PAGE_NUMBER_SEQUENCE") {
    throw new Error(
      "PageNumberSequenceValidator yalnızca PAGE_NUMBER_SEQUENCE tipindeki kuralları çalıştırır.",
    );
  }
}

function getExpected(expected: RuleDefinition["expected"]): PageNumberSequenceRuleExpected {
  if (
    typeof expected !== "object" ||
    expected === null ||
    !("transitionSection" in expected) ||
    typeof expected.transitionSection !== "string" ||
    expected.transitionSection.trim().length === 0 ||
    !("beforeFormat" in expected) ||
    !isSupportedFormat(expected.beforeFormat) ||
    !("fromFormat" in expected) ||
    !isSupportedFormat(expected.fromFormat) ||
    ("aliases" in expected &&
      (expected.aliases === undefined ||
        !Array.isArray(expected.aliases) ||
        !expected.aliases.every((alias) => typeof alias === "string" && alias.trim().length > 0))) ||
    ("restartAt" in expected &&
      expected.restartAt !== undefined &&
      (!Number.isInteger(expected.restartAt) || expected.restartAt < 1))
  ) {
    throw new Error(
      "PAGE_NUMBER_SEQUENCE kuralı geçerli transitionSection, biçimler ve optional restartAt içermelidir.",
    );
  }

  return expected as PageNumberSequenceRuleExpected;
}

function isSupportedFormat(value: unknown): value is PageNumberFormat {
  return value === "decimal" || value === "lowerRoman";
}

function createSequenceEvidence(
  expected: PageNumberSequenceRuleExpected,
  sections: readonly EffectivePageNumberSection[],
  transitionIndex: number,
  beforeMatches: boolean,
  fromMatches: boolean,
  restartMatches: boolean,
): RuleEvidence[] {
  const evidence: RuleEvidence[] = [];

  if (!beforeMatches) {
    const before = sections.slice(0, transitionIndex);

    if (before.length === 0) {
      evidence.push(
        createDocumentFormatEvidence(`${expected.transitionSection} öncesi sayfa numarası biçimi`, {
          actual: "Tespit edilmedi",
          expected: formatName(expected.beforeFormat),
        }),
      );
    } else {
      evidence.push(
        ...before.flatMap((section, index) =>
          section.effectiveFormat === expected.beforeFormat
            ? []
            : [
                createDocumentFormatEvidence("Sayfa numarası biçimi", {
                  actual: formatNullableFormat(section.effectiveFormat),
                  expected: formatName(expected.beforeFormat),
                  sectionIndex: index,
                }),
              ],
        ),
      );
    }
  }

  if (!fromMatches) {
    evidence.push(
      ...sections.slice(transitionIndex).flatMap((section, offset) =>
        section.effectiveFormat === expected.fromFormat
          ? []
          : [
              createDocumentFormatEvidence("Sayfa numarası biçimi", {
                actual: formatNullableFormat(section.effectiveFormat),
                expected: formatName(expected.fromFormat),
                sectionIndex: transitionIndex + offset,
              }),
            ],
      ),
    );
  }

  if (!restartMatches && expected.restartAt !== undefined) {
    evidence.push(
      createDocumentFormatEvidence("Sayfa numarası başlangıcı", {
        actual: sections[transitionIndex].start ?? "Tespit edilmedi",
        expected: expected.restartAt,
        sectionIndex: transitionIndex,
      }),
    );
  }

  return evidence;
}

function createResult(
  rule: RuleDefinition,
  expected: PageNumberSequenceRuleExpected,
  status: RuleResultStatus,
  actual: string,
  message: string,
  evidence?: RuleEvidence[],
  evidenceTotal?: number,
): RuleResult {
  return {
    ruleId: rule.id,
    ruleName: rule.title,
    status,
    passed: status === "PASSED",
    severity: rule.severity,
    expected: `${formatName(expected.beforeFormat)} → ${expected.transitionSection}: ${formatName(expected.fromFormat)}${expected.restartAt === undefined ? "" : `, başlangıç ${expected.restartAt}`}`,
    actual,
    message,
    ...(evidence && evidence.length > 0 ? { evidence } : {}),
    ...(evidenceTotal !== undefined ? { evidenceTotal } : {}),
  };
}

function formatActual(sections: readonly EffectivePageNumberSection[]): string {
  return sections
    .map(
      (section, index) =>
        `Bölüm ${index + 1}: ${section.effectiveFormat ? formatName(section.effectiveFormat) : "Tespit edilemedi"}${section.start === null ? "" : `, başlangıç ${section.start}`}`,
    )
    .join("; ");
}

function formatName(format: string): string {
  switch (format) {
    case "lowerRoman":
      return "Küçük Romen";
    case "decimal":
      return "Arap rakamı";
    default:
      return format;
  }
}

function formatNullableFormat(format: string | null): string {
  return format === null ? "Tespit edilemedi" : formatName(format);
}

function createFailureMessage(
  expected: PageNumberSequenceRuleExpected,
  beforeMatches: boolean,
  fromMatches: boolean,
  restartMatches: boolean,
): string {
  const problems: string[] = [];

  if (!beforeMatches) {
    problems.push(`${expected.transitionSection} öncesi ${formatName(expected.beforeFormat)} olmalı`);
  }

  if (!fromMatches) {
    problems.push(`${expected.transitionSection} ve sonrası ${formatName(expected.fromFormat)} olmalı`);
  }

  if (!restartMatches && expected.restartAt !== undefined) {
    problems.push(`${expected.transitionSection} ${expected.restartAt} ile başlamalı`);
  }

  return `Sayfa numarası sırası uygun değil: ${problems.join("; ")}.`;
}
