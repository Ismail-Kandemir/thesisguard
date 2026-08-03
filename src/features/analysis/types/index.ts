export interface DocumentInfo {
  id: string;
}

export interface ParagraphInfo {
  text: string;
}

export interface HeadingInfo {
  text: string;
}

export type RuleCategory =
  | "typography"
  | "spacing"
  | "margin"
  | "structure"
  | "citation"
  | "format";

export type RuleSeverity = "info" | "warning" | "error";

export type RuleExpectedValue =
  | string
  | number
  | boolean
  | {
      value: string | number | boolean;
      unit?: string;
    };

export interface RuleDefinition {
  id: string;
  title: string;
  description: string;
  category: RuleCategory;
  expected: RuleExpectedValue;
  severity: RuleSeverity;
  score: number;
  message: string;
  solution: string;
  enabled: boolean;
  version: string;
}

export interface DocxPackageInspection {
  fileName: string;
  fileSize: number;
  hasDocumentXml: boolean;
  hasStylesXml: boolean;
  hasNumberingXml: boolean;
  headerXmlFiles: string[];
  footerXmlFiles: string[];
  totalFileCount: number;
}

export interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  fontFamily?: string;
}

export interface Paragraph {
  id: string;
  text: string;
  runs: Run[];
}

export interface NormalizedDocument {
  paragraphs: Paragraph[];
}

export interface RuleResult {
  ruleId: string;
  title: string;
  passed: boolean;
  severity: RuleSeverity;
  score: number;
  message: string;
  solution: string;
  details: string[];
}

export interface AnalysisReport {
  document: DocumentInfo;
  results: RuleResult[];
}
