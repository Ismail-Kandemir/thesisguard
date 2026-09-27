import type {
  NormalizedDocument,
  PageSize,
  PageSizeRuleExpected,
  RuleDefinition,
  RuleEvidence,
  RuleResult,
} from "../../types";
import { createDocumentFormatEvidence } from "../ruleEvidence";
import type { RuleValidator } from "./RuleValidator";

interface SectionPageSize {
  pageSize: PageSize | null;
  sectionIndex?: number;
}

export class PageSizeValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertPageSizeRule(rule);
    const expected = getPageSizeExpected(rule.expected);
    const sectionPageSizes = getSectionPageSizes(document);
    const failures = sectionPageSizes.filter(
      (sectionPageSize) => !matchesExpectedPageSize(sectionPageSize.pageSize, expected),
    );
    const passed = sectionPageSizes.length > 0 && failures.length === 0;

    return {
      ruleId: rule.id,
      ruleName: rule.title,
      status: passed ? "PASSED" : "FAILED",
      passed,
      severity: rule.severity,
      expected: formatExpected(expected),
      actual: formatActual(sectionPageSizes),
      message: passed
        ? `${rule.title} kuralı başarılı.`
        : createFailureMessage(expected, sectionPageSizes),
      ...(passed
        ? {}
        : {
            evidence: failures.map((failure) =>
              createPageSizeEvidence(expected, failure),
            ),
            evidenceTotal: failures.length,
          }),
    };
  }
}

function assertPageSizeRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "PAGE_SIZE" } {
  if (rule.type !== "PAGE_SIZE") {
    throw new Error("PageSizeValidator yalnızca PAGE_SIZE tipindeki kuralları çalıştırır.");
  }
}

function getPageSizeExpected(
  expected: RuleDefinition["expected"],
): PageSizeRuleExpected {
  if (
    typeof expected !== "object" ||
    expected === null ||
    !("widthMm" in expected) ||
    !isPositiveNumber(expected.widthMm) ||
    !("heightMm" in expected) ||
    !isPositiveNumber(expected.heightMm) ||
    !("toleranceMm" in expected) ||
    !isNonNegativeNumber(expected.toleranceMm) ||
    ("orientation" in expected &&
      expected.orientation !== undefined &&
      expected.orientation !== "portrait" &&
      expected.orientation !== "landscape")
  ) {
    throw new Error(
      "PAGE_SIZE kuralı pozitif widthMm/heightMm, non-negative toleranceMm ve optional portrait/landscape orientation içermelidir.",
    );
  }

  return expected;
}

function getSectionPageSizes(
  document: Readonly<NormalizedDocument>,
): SectionPageSize[] {
  if (document.pageSections.length === 0) {
    return [{ pageSize: document.pageSize ?? null }];
  }

  return document.pageSections.map((section) => ({
    pageSize: section.pageSize ?? null,
    sectionIndex: section.index,
  }));
}

function matchesExpectedPageSize(
  pageSize: Readonly<PageSize> | null,
  expected: Readonly<PageSizeRuleExpected>,
): boolean {
  if (
    !pageSize ||
    pageSize.widthMm === null ||
    pageSize.heightMm === null ||
    pageSize.orientation === null
  ) {
    return false;
  }

  const dimensionsMatch =
    isWithinTolerance(pageSize.widthMm, expected.widthMm, expected.toleranceMm) &&
    isWithinTolerance(pageSize.heightMm, expected.heightMm, expected.toleranceMm);
  const orientationMatches =
    expected.orientation === undefined ||
    pageSize.orientation === expected.orientation;

  return dimensionsMatch && orientationMatches;
}

function isWithinTolerance(
  actual: number,
  expected: number,
  tolerance: number,
): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function createPageSizeEvidence(
  expected: Readonly<PageSizeRuleExpected>,
  sectionPageSize: Readonly<SectionPageSize>,
): RuleEvidence {
  return createDocumentFormatEvidence("Sayfa boyutu", {
    actual: formatPageSize(sectionPageSize.pageSize),
    expected: formatExpected(expected),
    sectionIndex: sectionPageSize.sectionIndex,
  });
}

function createFailureMessage(
  expected: Readonly<PageSizeRuleExpected>,
  sectionPageSizes: readonly SectionPageSize[],
): string {
  if (
    sectionPageSizes.length === 0 ||
    sectionPageSizes.every((sectionPageSize) => sectionPageSize.pageSize === null)
  ) {
    return "Sayfa boyutu uygun değil. Belgede w:pgSz bilgisi tespit edilemedi.";
  }

  return `Sayfa boyutu uygun değil. Beklenen: ${formatExpected(expected)}, Bulunan: ${formatActual(sectionPageSizes)}.`;
}

function formatActual(
  sectionPageSizes: readonly SectionPageSize[],
): string | null {
  if (sectionPageSizes.length === 0) {
    return null;
  }

  if (sectionPageSizes.length === 1) {
    return formatPageSize(sectionPageSizes[0].pageSize);
  }

  return sectionPageSizes
    .map((sectionPageSize, index) => {
      const sectionNumber = sectionPageSize.sectionIndex === undefined
        ? index + 1
        : sectionPageSize.sectionIndex + 1;

      return `Bölüm ${sectionNumber}: ${formatPageSize(sectionPageSize.pageSize) ?? "Tespit edilemedi"}`;
    })
    .join("; ");
}

function formatPageSize(pageSize: Readonly<PageSize> | null): string | null {
  if (!pageSize) {
    return null;
  }

  const width = pageSize.widthMm === null ? "?" : `${pageSize.widthMm} mm`;
  const height = pageSize.heightMm === null ? "?" : `${pageSize.heightMm} mm`;
  const orientation = pageSize.orientation ?? "belirsiz";

  return `${width} x ${height}, ${orientation}`;
}

function formatExpected(expected: Readonly<PageSizeRuleExpected>): string {
  return `${expected.widthMm} mm x ${expected.heightMm} mm${
    expected.orientation ? `, ${expected.orientation}` : ""
  } (±${expected.toleranceMm} mm)`;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
