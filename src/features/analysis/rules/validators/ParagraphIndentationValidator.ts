import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import { sectionMatchesAnyExpectedName } from "../../parsers/sectionNameMatcher";
import type {
  NormalizedDocument,
  Paragraph,
  ParagraphIndentationRuleExpected,
  RuleDefinition,
  RuleResult,
} from "../../types";
import {
  createParagraphEvidence,
  MAX_RULE_EVIDENCE_ITEMS,
} from "../ruleEvidence";
import { getBodyParagraphs } from "./bodyParagraphs";
import type { RuleValidator } from "./RuleValidator";

const TWIPS_PER_INCH = 1440;
const CENTIMETERS_PER_INCH = 2.54;
const MAX_FAILURE_SAMPLES = 3;

interface LocatedAcademicParagraph {
  paragraph: Paragraph;
  paragraphIndex: number;
  sectionName?: string;
}

export class ParagraphIndentationValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expected = getExpected(rule);
    const candidates = getAcademicBodyParagraphs(document, expected.sections);

    if (candidates.length === 0) {
      return {
        ruleId: rule.id, ruleName: rule.title, status: "NOT_APPLICABLE", passed: true,
        severity: rule.severity, expected: expected.firstLineCm, actual: null,
        message: "Değerlendirilebilir akademik ana gövde paragrafı bulunamadı.",
      };
    }

    const resolver = new EffectiveFormattingResolver(document.styles, document.documentDefaults);
    const expectedTwips = (expected.firstLineCm / CENTIMETERS_PER_INCH) * TWIPS_PER_INCH;
    const failures = candidates.flatMap((candidate) => {
      const { paragraph } = candidate;
      const indentation = resolver.resolveParagraphFormatting(
        paragraph.styleId,
        paragraph.paragraphFormatting,
      ).indentation;
      const actual = indentation.firstLineChars !== null || indentation.hangingChars !== null
        ? null
        : indentation.hangingTwips !== null
          ? -indentation.hangingTwips
          : indentation.firstLineTwips ?? 0;
      return actual !== null && Math.abs(actual - expectedTwips) <= expected.toleranceTwips
        ? []
        : [{ ...candidate, actual }];
    });
    const passed = failures.length === 0;
    const samples = failures.slice(0, MAX_FAILURE_SAMPLES).map(({ paragraph, actual }) =>
      `${paragraph.id}: ${actual === null ? "karakter tabanlı/çözümlenemeyen" : `${twipsToCm(actual)} cm`} (${paragraph.text.slice(0, 60)})`,
    );
    const evidence = failures.slice(0, MAX_RULE_EVIDENCE_ITEMS).map((failure) =>
      createParagraphEvidence(failure.paragraph, failure.paragraphIndex, {
        expected: expected.firstLineCm,
        actual: failure.actual === null ? null : Number(twipsToCm(failure.actual)),
        unit: "cm",
        ...(failure.sectionName ? { sectionName: failure.sectionName } : {}),
      }),
    );

    return {
      ruleId: rule.id, ruleName: rule.title, status: passed ? "PASSED" : "FAILED", passed,
      severity: rule.severity, expected: expected.firstLineCm,
      actual: passed ? expected.firstLineCm : samples.join("; "),
      message: passed
        ? `${rule.title} kuralı başarılı.`
        : `${failures.length} akademik gövde paragrafında ilk satır girintisi uygun değil. ${samples.join("; ")}`,
      ...(passed ? {} : { evidence, evidenceTotal: failures.length }),
    };
  }
}

function getExpected(rule: RuleDefinition): ParagraphIndentationRuleExpected {
  const expected = rule.expected;
  if (typeof expected !== "object" || !("firstLineCm" in expected) ||
      !("toleranceTwips" in expected) || !("sections" in expected)) {
    throw new Error("Paragraf girintisi kuralı geçerli expected değerleri içermelidir.");
  }
  return expected;
}

function getAcademicBodyParagraphs(
  document: NormalizedDocument,
  sectionNames: readonly string[],
): LocatedAcademicParagraph[] {
  const selectedRanges = document.sections
    .filter(
      (section) =>
        section.isRuleDefinedHeading &&
        sectionMatchesAnyExpectedName(section, sectionNames),
    )
    .map((section) => {
      const next = document.sections.find(
        (candidate) => candidate.isRuleDefinedHeading && candidate.paragraphIndex > section.paragraphIndex,
      );
      return {
        start: section.paragraphIndex,
        end: next?.paragraphIndex ?? document.paragraphs.length,
        sectionName: section.displayName,
      };
    });
  const eligibleIds = new Set(getBodyParagraphs(document, {
    excludeCaptions: true,
    excludeTableCells: true,
    excludeLists: true,
    excludeTableOfContents: true,
    excludeFigureCarriers: true,
  }).map((paragraph) => paragraph.id));

  return document.paragraphs.flatMap((paragraph, index) => {
    const range = selectedRanges.find((candidate) => index > candidate.start && index < candidate.end);

    return eligibleIds.has(paragraph.id) && range
      ? [{ paragraph, paragraphIndex: index, sectionName: range.sectionName }]
      : [];
  });
}

function twipsToCm(twips: number): string {
  return ((twips / TWIPS_PER_INCH) * CENTIMETERS_PER_INCH).toFixed(2);
}
