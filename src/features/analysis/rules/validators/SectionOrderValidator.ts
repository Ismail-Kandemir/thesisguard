import { sectionMatchesAnyExpectedName } from "../../parsers/sectionNameMatcher";
import type {
  DocumentSection,
  NormalizedDocument,
  RuleEvidence,
  RuleDefinition,
  RuleResult,
  SectionOrderItem,
  SectionOrderRuleExpected,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";
import { createSectionEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";

interface LocatedSection {
  item: SectionOrderItem;
  occurrence: DocumentSection;
}

export class SectionOrderValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertSectionOrderRule(rule);
    const expected = getSectionOrderExpected(rule.expected);
    const locatedSections = expected.sections
      .map((item) => locateSection(item, document.sections))
      .filter((section): section is LocatedSection => section !== null);
    const duplicate = findDuplicateExpectedSection(
      expected.sections,
      document.sections,
    );

    if (duplicate) {
      const duplicateOccurrences = findDuplicateOccurrences(duplicate, document.sections);
      return createResult(
        rule,
        expected,
        false,
        formatActual(locatedSections),
        `${duplicate.section} bölümü belgede birden fazla kez bulundu; bölüm sırası güvenle doğrulanamadı.`,
        duplicateOccurrences.slice(0, MAX_RULE_EVIDENCE_ITEMS).map((section) =>
          createSectionEvidence(section, {
            actual: section.displayName,
            expected: duplicate.section,
            sectionName: duplicate.section,
          }),
        ),
        duplicateOccurrences.length,
      );
    }

    const misplacedPair = findMisplacedPair(locatedSections);

    if (misplacedPair) {
      const [before, after] = misplacedPair;
      return createResult(
        rule,
        expected,
        false,
        formatActual(locatedSections),
        `${before.item.section} bölümü, ${after.item.section} bölümünden sonra bulundu.`,
        [before, after].map((section) =>
          createSectionEvidence(section.occurrence, {
            actual: section.occurrence.displayName,
            expected: section.item.section,
            sectionName: section.item.section,
          }),
        ),
        misplacedPair.length,
      );
    }

    return createResult(
      rule,
      expected,
      true,
      formatActual(locatedSections),
      "Bölümler beklenen sırada.",
    );
  }
}

function assertSectionOrderRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "SECTION_ORDER" } {
  if (rule.type !== "SECTION_ORDER") {
    throw new Error(
      "SectionOrderValidator yalnızca SECTION_ORDER tipindeki kuralları çalıştırır.",
    );
  }
}

function getSectionOrderExpected(
  expected: RuleDefinition["expected"],
): SectionOrderRuleExpected {
  if (
    typeof expected !== "object" ||
    !("sections" in expected) ||
    !Array.isArray(expected.sections) ||
    expected.sections.length === 0 ||
    !expected.sections.every(isSectionOrderItem)
  ) {
    throw new Error(
      "SECTION_ORDER kuralı en az bir geçerli section içeren sections dizisi tanımlamalıdır.",
    );
  }

  return expected;
}

function isSectionOrderItem(value: unknown): value is SectionOrderItem {
  if (typeof value !== "object" || value === null || !("section" in value)) {
    return false;
  }

  const item = value as { section?: unknown; aliases?: unknown };
  return (
    typeof item.section === "string" &&
    item.section.trim().length > 0 &&
    (item.aliases === undefined ||
      (Array.isArray(item.aliases) &&
        item.aliases.every(
          (alias) => typeof alias === "string" && alias.trim().length > 0,
        )))
  );
}

function getNames(item: SectionOrderItem): string[] {
  return [item.section, ...(item.aliases ?? [])];
}

function locateSection(
  item: SectionOrderItem,
  sections: readonly DocumentSection[],
): LocatedSection | null {
  const names = getNames(item);
  const occurrence = sections.find((section) =>
    sectionMatchesAnyExpectedName(section, names),
  );
  return occurrence ? { item, occurrence } : null;
}

function findDuplicateExpectedSection(
  items: readonly SectionOrderItem[],
  sections: readonly DocumentSection[],
): SectionOrderItem | null {
  return (
    items.find((item) => {
      const names = getNames(item);
      return sections.filter((section) => sectionMatchesAnyExpectedName(section, names)).length > 1;
    }) ?? null
  );
}

function findDuplicateOccurrences(
  item: SectionOrderItem,
  sections: readonly DocumentSection[],
): DocumentSection[] {
  const names = getNames(item);
  return sections.filter((section) => sectionMatchesAnyExpectedName(section, names));
}

function findMisplacedPair(
  sections: readonly LocatedSection[],
): readonly [LocatedSection, LocatedSection] | null {
  for (let index = 1; index < sections.length; index += 1) {
    const before = sections[index - 1];
    const after = sections[index];

    if (before.occurrence.paragraphIndex > after.occurrence.paragraphIndex) {
      return [before, after];
    }
  }

  return null;
}

function createResult(
  rule: RuleDefinition,
  expected: SectionOrderRuleExpected,
  passed: boolean,
  actual: string,
  message: string,
  evidence?: RuleEvidence[],
  evidenceTotal?: number,
): RuleResult {
  return {
    ruleId: rule.id,
    ruleName: rule.title,
    status: passed ? "PASSED" : "FAILED",
    passed,
    severity: rule.severity,
    expected: expected.sections.map((item) => item.section).join(" → "),
    actual,
    message,
    ...(evidence && evidence.length > 0 ? { evidence } : {}),
    ...(evidenceTotal !== undefined ? { evidenceTotal } : {}),
  };
}

function formatActual(sections: readonly LocatedSection[]): string {
  return sections.length > 0
    ? [...sections]
        .sort(
          (first, second) =>
            first.occurrence.paragraphIndex - second.occurrence.paragraphIndex,
        )
        .map((section) => section.occurrence.displayName)
        .join(" → ")
    : "Beklenen bölümlerden hiçbiri tespit edilmedi";
}
