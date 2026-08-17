import { detectAbbreviations } from "../../parsers/documentAbbreviationsNormalizer";
import { normalizeSectionName } from "../../parsers/documentSectionsParser";
import { parseAbbreviationListEntries } from "../abbreviationListParser";
import { getSectionContentParagraphs } from "../sectionContent";
import type {
  AbbreviationListConsistencyRuleExpected,
  DocumentSection,
  NormalizedDocument,
  RuleDefinition,
  RuleResult,
  RuleResultStatus,
} from "../../types";
import { getBodyParagraphs } from "./bodyParagraphs";
import type { RuleValidator } from "./RuleValidator";

export class AbbreviationListConsistencyValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertAbbreviationListConsistencyRule(rule);
    const expected = getExpected(rule.expected);

    if (!document.abbreviations.hasAbbreviations) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadı",
        "Belgede kısaltma bulunmadığı için liste tutarlılığı kontrolü uygulanmadı.",
      );
    }

    const occurrences = findSectionOccurrences(document.sections, expected);

    if (occurrences.length === 0) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadı",
        `${expected.section} bölümü bulunmadığı için liste tutarlılığı kontrolü uygulanamadı.`,
      );
    }

    if (occurrences.length > 1) {
      return createResult(
        rule,
        expected,
        "FAILED",
        "Güvenle doğrulanamadı",
        `${expected.section} bölümü birden fazla kez bulunduğu için liste tutarlılığı güvenle doğrulanamadı.`,
      );
    }

    const listParagraphs = getSectionContentParagraphs(document, occurrences[0]);
    const listParagraphIds = new Set([
      occurrences[0].paragraphId,
      ...listParagraphs.map((paragraph) => paragraph.id),
    ]);
    const bodyAbbreviations = detectAbbreviations(
      getBodyParagraphs(document)
        .filter((paragraph) => !listParagraphIds.has(paragraph.id))
        .map((paragraph) => paragraph.text),
    );
    const listedAbbreviations = new Set(
      parseAbbreviationListEntries(listParagraphs),
    );
    const missing = bodyAbbreviations
      .map((abbreviation) => abbreviation.value)
      .filter((value) => !listedAbbreviations.has(value));

    if (missing.length > 0) {
      return createResult(
        rule,
        expected,
        "FAILED",
        `Eksik: ${missing.join(", ")}`,
        `${expected.section} eksik. Listede bulunmayan: ${missing.join(", ")}.`,
      );
    }

    return createResult(
      rule,
      expected,
      "PASSED",
      `${bodyAbbreviations.length}/${bodyAbbreviations.length} kısaltma listede bulundu.`,
      "Metinde kullanılan tüm kısaltmalar listede bulunuyor.",
    );
  }
}

function assertAbbreviationListConsistencyRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "ABBREVIATION_LIST_CONSISTENCY" } {
  if (rule.type !== "ABBREVIATION_LIST_CONSISTENCY") {
    throw new Error(
      "AbbreviationListConsistencyValidator yalnızca ABBREVIATION_LIST_CONSISTENCY tipindeki kuralları çalıştırır.",
    );
  }
}

function getExpected(
  expected: RuleDefinition["expected"],
): AbbreviationListConsistencyRuleExpected {
  if (
    typeof expected !== "object" ||
    expected === null ||
    !("section" in expected) ||
    typeof expected.section !== "string" ||
    expected.section.trim().length === 0 ||
    ("aliases" in expected &&
      (expected.aliases === undefined ||
        !Array.isArray(expected.aliases) ||
        !expected.aliases.every(
          (alias) => typeof alias === "string" && alias.trim().length > 0,
        )))
  ) {
    throw new Error(
      "ABBREVIATION_LIST_CONSISTENCY kuralı geçerli section ve optional aliases tanımlamalıdır.",
    );
  }

  return expected;
}

function findSectionOccurrences(
  sections: readonly DocumentSection[],
  expected: AbbreviationListConsistencyRuleExpected,
): DocumentSection[] {
  const names = [expected.section, ...(expected.aliases ?? [])].map(
    normalizeSectionName,
  );

  return sections.filter((section) => names.includes(section.normalizedName));
}

function createResult(
  rule: RuleDefinition,
  expected: AbbreviationListConsistencyRuleExpected,
  status: RuleResultStatus,
  actual: string,
  message: string,
): RuleResult {
  return {
    ruleId: rule.id,
    ruleName: rule.title,
    status,
    passed: status === "PASSED",
    severity: rule.severity,
    expected: `Metinde kullanılan tüm kısaltmalar ${expected.section} bölümünde bulunmalı`,
    actual,
    message,
  };
}
