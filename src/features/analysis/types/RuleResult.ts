import type { RuleSeverity } from "./index";

export type RuleResultValue = string | number | boolean | null;
export type RuleResultStatus = "PASSED" | "FAILED" | "NOT_APPLICABLE";

export interface ParagraphRuleEvidence {
  kind: "paragraph";
  paragraphId: string;
  paragraphIndex: number;
  textExcerpt?: string;
  sectionName?: string;
  expected?: RuleResultValue;
  actual?: RuleResultValue;
  unit?: string;
}

export interface RunRuleEvidence {
  kind: "run";
  paragraphId: string;
  paragraphIndex: number;
  runIndex: number;
  textExcerpt?: string;
  paragraphExcerpt?: string;
  sectionName?: string;
  expected?: RuleResultValue;
  actual?: RuleResultValue;
  unit?: string;
}

export interface HeadingRuleEvidence {
  kind: "heading";
  paragraphId: string;
  paragraphIndex: number;
  blockIndex?: number | null;
  textExcerpt?: string;
  headingLevel?: number;
  sectionName?: string;
  expected?: RuleResultValue;
  actual?: RuleResultValue;
}

export interface SectionRuleEvidence {
  kind: "section";
  sectionName: string;
  paragraphId?: string;
  paragraphIndex?: number;
  expected?: RuleResultValue;
  actual?: RuleResultValue;
}

export interface CaptionRuleEvidence {
  kind: "caption";
  captionKind: "table" | "figure";
  captionId: string;
  paragraphId: string;
  paragraphIndex: number;
  blockIndex?: number | null;
  label?: string;
  number?: string;
  textExcerpt?: string;
  expected?: RuleResultValue;
  actual?: RuleResultValue;
}

export interface ObjectRuleEvidence {
  kind: "table" | "figure";
  objectId: string;
  blockIndex?: number | null;
  paragraphId?: string;
  paragraphIndex?: number;
  objectLabel?: string;
  captionId?: string;
  captionText?: string;
  captionNumber?: string;
  expected?: RuleResultValue;
  actual?: RuleResultValue;
}

export type RuleEvidence =
  | ParagraphRuleEvidence
  | RunRuleEvidence
  | HeadingRuleEvidence
  | SectionRuleEvidence
  | CaptionRuleEvidence
  | ObjectRuleEvidence;

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  status: RuleResultStatus;
  /** @deprecated Prefer status. Kept for backward compatibility. */
  passed: boolean;
  severity: RuleSeverity;
  expected: RuleResultValue;
  actual: RuleResultValue;
  message: string;
  evidence?: RuleEvidence[];
  evidenceTotal?: number;
}
