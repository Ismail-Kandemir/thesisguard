import type {
  RuleValidationCoverageStatus,
  RuleValidationMetadata,
  RuleValidationTrustStatus,
} from "../types";

const PARTIAL_MEDIUM_RULE_IDS = new Set<string>([
  "comu.applied-sciences.food-technology.bachelor.page-number",
]);

const COMPLETE_HIGH_RULE_IDS = new Set<string>([
  "comu.bachelor.typography.font-family",
  "comu.bachelor.typography.font-size",
  "comu.bachelor.heading.heading2",
  "comu.bachelor.heading.heading3",
  "comu.bachelor.spacing.line-height",
  "comu.bachelor.format.alignment",
  "comu.bachelor.margin.left",
  "comu.bachelor.margin.right",
  "comu.bachelor.margin.bottom",
  "comu.applied-sciences.food-technology.bachelor.heading-alignment",
  "comu.applied-sciences.food-technology.bachelor.paragraph-indentation",
  "comu.applied-sciences.food-technology.bachelor.margin.top",
  "comu.applied-sciences.food-technology.bachelor.heading.heading1",
  "comu.applied-sciences.food-technology.bachelor.body-level-0-heading-format",
  "comu.applied-sciences.food-technology.bachelor.table-of-contents",
  "comu.applied-sciences.food-technology.bachelor.references",
  "comu.applied-sciences.food-technology.bachelor.summary-tr",
  "comu.applied-sciences.food-technology.bachelor.summary-en",
  "comu.applied-sciences.food-technology.bachelor.plagiarism-declaration",
  "comu.applied-sciences.food-technology.bachelor.page-number-sequence",
  "comu.applied-sciences.food-technology.bachelor.table-object-alignment",
  "comu.applied-sciences.food-technology.bachelor.figure-object-alignment",
  "comu.applied-sciences.food-technology.bachelor.table-caption-placement",
  "comu.applied-sciences.food-technology.bachelor.figure-caption-placement",
  "comu.applied-sciences.food-technology.bachelor.table-caption-format",
  "comu.applied-sciences.food-technology.bachelor.figure-caption-format",
  "comu.applied-sciences.food-technology.bachelor.table-in-text-reference",
  "comu.applied-sciences.food-technology.bachelor.figure-in-text-reference",
  "comu.applied-sciences.food-technology.bachelor.acceptance-approval",
  "comu.applied-sciences.food-technology.bachelor.acknowledgements",
  "comu.applied-sciences.food-technology.bachelor.introduction",
  "comu.applied-sciences.food-technology.bachelor.conclusion",
  "comu.applied-sciences.food-technology.bachelor.cv",
  "comu.applied-sciences.food-technology.bachelor.list-of-tables",
  "comu.applied-sciences.food-technology.bachelor.list-of-figures",
  "comu.applied-sciences.food-technology.bachelor.list-of-abbreviations",
  "comu.applied-sciences.food-technology.bachelor.summary-tr-word-count",
  "comu.applied-sciences.food-technology.bachelor.summary-en-word-count",
  "comu.applied-sciences.food-technology.bachelor.summary-tr-keywords",
  "comu.applied-sciences.food-technology.bachelor.summary-en-keywords",
  "comu.applied-sciences.food-technology.bachelor.experimental.general-information-literature",
  "comu.applied-sciences.food-technology.bachelor.experimental.material-method",
  "comu.applied-sciences.food-technology.bachelor.experimental.findings-discussion",
  "comu.applied-sciences.food-technology.bachelor.experimental.section-order",
  "comu.applied-sciences.food-technology.bachelor.experimental.heading-numbering",
]);

export function getRuleValidationMetadata(
  ruleId: string,
): RuleValidationMetadata {
  if (COMPLETE_HIGH_RULE_IDS.has(ruleId)) {
    return { coverage: "COMPLETE", trust: "HIGH" };
  }

  if (PARTIAL_MEDIUM_RULE_IDS.has(ruleId)) {
    return { coverage: "PARTIAL", trust: "MEDIUM" };
  }

  return { coverage: "MISSING", trust: "LOW" };
}

export function getAllowedRuleValidationCoverageStatuses():
  RuleValidationCoverageStatus[] {
  return ["COMPLETE", "PARTIAL", "SHALLOW", "MISSING"];
}

export function getAllowedRuleValidationTrustStatuses():
  RuleValidationTrustStatus[] {
  return ["HIGH", "MEDIUM", "LOW"];
}
