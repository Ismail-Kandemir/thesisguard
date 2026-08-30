import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import type { HeadingLevel, NormalizedDocument, RuleDefinition, RuleExpectedValue, RuleResult } from "../../types";
import type { RuleValidator } from "./RuleValidator";
import { fontFamiliesEqual } from "../fontFamilyComparison";
import { createHeadingEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";

const LEVELS: HeadingLevel[] = ["Heading1", "Heading2", "Heading3"];
const MAX_SAMPLES = 3;

interface ExpectedHeadingFormatting {
  level: HeadingLevel;
  semanticLevel: number;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
}

export class HeadingValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expected = getExpected(rule);
    const occurrences = document.headings.filter((heading) => heading.level === expected.semanticLevel);
    if (occurrences.length === 0) {
      return createResult(rule, "NOT_APPLICABLE", true, expected, null,
        `${formatLevel(expected.level)} düzeyinde güvenilir akademik başlık bulunmadı.`);
    }
    const paragraphsById = new Map(document.paragraphs.map((paragraph) => [paragraph.id, paragraph]));
    const resolver = new EffectiveFormattingResolver(document.styles, document.documentDefaults, document.themeFonts);
    const failures = occurrences.flatMap((heading) => {
      const paragraph = paragraphsById.get(heading.paragraphId);
      if (!paragraph) return [{ heading, actual: "Paragraf bulunamadı" }];
      const visibleRuns = paragraph.runs.filter((run) => run.text.trim().length > 0);
      const wrongRuns = visibleRuns.filter((run) => {
        const actual = resolver.resolveRun(run, paragraph.styleId, paragraph.lineSpacing);
        return !fontFamiliesEqual(actual.fontFamily, expected.fontFamily) || actual.fontSize !== expected.fontSize || actual.bold !== expected.bold;
      });
      if (visibleRuns.length > 0 && wrongRuns.length === 0) return [];
      const actualValues = wrongRuns.map((run) => {
        const actual = resolver.resolveRun(run, paragraph.styleId, paragraph.lineSpacing);
        return `${actual.fontFamily ?? "belirtilmemiş"}, ${actual.fontSize ?? "belirtilmemiş"} pt, ${actual.bold ? "kalın" : "kalın değil"}`;
      });
      return [{ heading, actual: Array.from(new Set(actualValues)).join(" / ") || "Biçim çözümlenemedi" }];
    });
    if (failures.length === 0) {
      return createResult(rule, "PASSED", true, expected, formatExpected(expected),
        `${formatLevel(expected.level)} akademik başlık biçimi kurala uygundur.`);
    }
    const samples = failures.slice(0, MAX_SAMPLES).map(({ heading, actual }) => `“${heading.text}”: ${actual}`);
    return {
      ...createResult(rule, "FAILED", false, expected, samples.join("; "),
        `${failures.length} akademik başlığın biçimi uygun değil. ${samples.join("; ")}`),
      evidence: failures.slice(0, MAX_RULE_EVIDENCE_ITEMS).map(({ heading, actual }) =>
        createHeadingEvidence(heading, {
          actual,
          expected: formatExpected(expected),
        }),
      ),
      evidenceTotal: failures.length,
    };
  }
}

function getExpected(rule: RuleDefinition): ExpectedHeadingFormatting {
  const expected = rule.expected;
  if (rule.category !== "heading" || typeof expected !== "object") throw new Error("Heading kuralı heading kategorisinde nesne expected içermelidir.");
  const level = expected.level ?? parseLevel(expected.value);
  if (!level || typeof expected.fontFamily !== "string" || typeof expected.fontSize !== "number" ||
      !Number.isFinite(expected.fontSize) || typeof expected.bold !== "boolean") {
    throw new Error("Heading kuralı geçerli level, fontFamily, fontSize ve bold içermelidir.");
  }
  return { level, semanticLevel: LEVELS.indexOf(level), fontFamily: expected.fontFamily, fontSize: expected.fontSize, bold: expected.bold };
}

function parseLevel(value: RuleExpectedValue): HeadingLevel | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return LEVELS.find((level) => level.toLowerCase() === normalized) ?? null;
}

function formatExpected(expected: ExpectedHeadingFormatting): string {
  return `${expected.fontFamily}, ${expected.fontSize} pt, ${expected.bold ? "kalın" : "kalın değil"}`;
}

function formatLevel(level: HeadingLevel): string { return level.replace("Heading", "Heading "); }

function createResult(rule: RuleDefinition, status: RuleResult["status"], passed: boolean,
  expected: ExpectedHeadingFormatting, actual: string | null, message: string): RuleResult {
  return { ruleId: rule.id, ruleName: rule.title, status, passed, severity: rule.severity,
    expected: formatExpected(expected), actual, message };
}
