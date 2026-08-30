import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import type {
  HeadingAlignmentRuleExpected,
  NormalizedDocument,
  ParagraphAlignment,
  RuleDefinition,
  RuleResult,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";
import { createHeadingEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";

const MAX_SAMPLES = 3;

export class HeadingAlignmentValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expected = getExpected(rule);
    const headings = document.headings.filter((heading) => expected.levels.includes(heading.level));
    if (headings.length === 0) {
      return result(rule, "NOT_APPLICABLE", true, expected.alignment, null,
        "Güvenilir akademik gövde başlığı bulunmadığı için hizalama kontrolü uygulanmadı.");
    }

    const resolver = new EffectiveFormattingResolver(document.styles, document.documentDefaults);
    const paragraphsById = new Map(document.paragraphs.map((paragraph) => [paragraph.id, paragraph]));
    const failures = headings.flatMap((heading) => {
      const paragraph = paragraphsById.get(heading.paragraphId);
      if (!paragraph) return [{ heading, actual: null }];
      const actual = resolver.resolveParagraphAlignment(paragraph.styleId, paragraph.alignment);
      return actual === expected.alignment ? [] : [{ heading, actual }];
    });

    if (failures.length === 0) {
      return result(rule, "PASSED", true, expected.alignment, expected.alignment,
        "Akademik bölüm başlıklarının hizalaması kurala uygundur: sola yaslı.");
    }

    const samples = failures.slice(0, MAX_SAMPLES).map(({ heading, actual }) =>
      `“${formatHeadingLabel(heading.visibleLabel, heading.text)}” (${formatAlignment(actual)})`,
    );
    return {
      ...result(rule, "FAILED", false, expected.alignment, samples.join("; "),
        `${failures.length} akademik başlığın hizalaması uygun değil. ${samples.join("; ")}`),
      evidence: failures.slice(0, MAX_RULE_EVIDENCE_ITEMS).map(({ heading, actual }) =>
        createHeadingEvidence(heading, {
          actual: formatAlignment(actual),
          expected: formatAlignment(expected.alignment),
        }),
      ),
      evidenceTotal: failures.length,
    };
  }
}

function getExpected(rule: RuleDefinition): HeadingAlignmentRuleExpected {
  const expected = rule.expected;
  if (typeof expected !== "object" || expected === null || !("levels" in expected) ||
      !("alignment" in expected) || !Array.isArray(expected.levels) || expected.levels.length === 0 ||
      !expected.levels.every((level) => Number.isInteger(level) && level >= 0) ||
      new Set(expected.levels).size !== expected.levels.length || !isAlignment(expected.alignment)) {
    throw new Error("HEADING_ALIGNMENT kuralı benzersiz non-negative levels ve geçerli alignment içermelidir.");
  }
  return expected;
}

function isAlignment(value: unknown): value is ParagraphAlignment {
  return value === "left" || value === "right" || value === "center" || value === "justify";
}

function formatHeadingLabel(label: string | null, text: string): string {
  return `${label ? `${label} ` : ""}${text}`.trim();
}

function formatAlignment(value: ParagraphAlignment | null): string {
  return value === null ? "hizalama çözümlenemedi" :
    ({ left: "sola yaslı", right: "sağa yaslı", center: "ortalı", justify: "iki yana yaslı" })[value];
}

function result(
  rule: RuleDefinition,
  status: RuleResult["status"],
  passed: boolean,
  expected: ParagraphAlignment,
  actual: string | null,
  message: string,
): RuleResult {
  return { ruleId: rule.id, ruleName: rule.title, status, passed, severity: rule.severity,
    expected: formatAlignment(expected), actual, message };
}
