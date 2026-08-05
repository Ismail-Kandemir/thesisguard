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

export interface DocxAnalysisXmlParts {
  documentXml: string;
  stylesXml: string | null;
}

export interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontFamily: string | null;
  fontSize: number | null;
}

export type ParagraphAlignment = "left" | "right" | "center" | "justify";

export interface StyleDefinition {
  id: string;
  name: string | null;
  basedOn: string | null;
  nextStyle: string | null;
  fontFamily: string | null;
  fontSize: number | null;
  bold: boolean | null;
  italic: boolean | null;
  underline: boolean | null;
  lineSpacing: number | null;
  alignment: ParagraphAlignment | null;
}

export interface DocumentDefaults {
  fontFamily: string | null;
  fontSize: number | null;
}

export interface Paragraph {
  id: string;
  text: string;
  runs: Run[];
  alignment: ParagraphAlignment | null;
  styleId: string | null;
  isEmpty: boolean;
}

export interface PageMargins {
  left: number | null;
  right: number | null;
  top: number | null;
  bottom: number | null;
}

export interface NormalizedDocument {
  paragraphs: Paragraph[];
  styles: StyleDefinition[];
  documentDefaults: DocumentDefaults;
  pageMargins: PageMargins;
}

export type { AnalysisReport } from "./AnalysisReport";
export type { RuleResult, RuleResultValue } from "./RuleResult";
