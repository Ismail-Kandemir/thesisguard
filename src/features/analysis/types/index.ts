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
  | "format"
  | "heading";

export type RuleSeverity = "info" | "warning" | "error";

export type RuleType =
  | "PAGE_NUMBER"
  | "CONDITIONAL_REQUIRED_SECTION"
  | "REQUIRED_SECTION"
  | "SECTION_ORDER"
  | "SECTION_WORD_COUNT";

export interface PageNumberRuleExpected {
  required: boolean;
  location?: HeaderFooterLocation;
  alignment?: Exclude<ParagraphAlignment, "justify">;
}

export interface RequiredSectionRuleExpected {
  section: string;
  aliases?: string[];
  required: boolean;
}

export type ConditionalRequiredSectionFact = "hasTables" | "hasFigures";

export interface ConditionalRequiredSectionCondition {
  fact: ConditionalRequiredSectionFact;
  equals: boolean;
}

export interface ConditionalRequiredSectionRuleExpected {
  section: string;
  aliases?: string[];
  requiredWhen: ConditionalRequiredSectionCondition;
}

export interface SectionOrderItem {
  section: string;
  aliases?: string[];
}

export interface SectionOrderRuleExpected {
  sections: SectionOrderItem[];
}

export interface SectionWordCountRuleExpected {
  section: string;
  aliases?: string[];
  min?: number;
  max?: number;
}

export type HeadingLevel = "Heading1" | "Heading2" | "Heading3";

export type RuleScopeLevel =
  | "university"
  | "faculty"
  | "institute"
  | "department"
  | "program";

export interface RuleScope {
  level: RuleScopeLevel;
  targetId: string;
  targetSlug: string;
}

export interface RuleOverride {
  ruleId: string;
}

export type UniversityGeneralRuleId =
  `${string}.${string}.general.${string}`;

export type OrganizationalRuleId =
  `${string}.${string}.${string}.${string}.${string}`;

export type NamespacedRuleId =
  | UniversityGeneralRuleId
  | OrganizationalRuleId;

export type RuleExpectedValue =
  | string
  | number
  | boolean
  | PageNumberRuleExpected
  | ConditionalRequiredSectionRuleExpected
  | RequiredSectionRuleExpected
  | SectionOrderRuleExpected
  | SectionWordCountRuleExpected
  | {
      value: string | number | boolean;
      unit?: string;
      level?: HeadingLevel;
      fontFamily?: string;
      fontSize?: number;
      bold?: boolean;
    };

export interface RuleDefinition {
  id: string;
  type?: RuleType;
  scope?: RuleScope;
  overrides?: RuleOverride[];
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
  headerFooterXmlParts: HeaderFooterXmlPart[];
}

export type HeaderFooterLocation = "header" | "footer";

export interface HeaderFooterXmlPart {
  path: string;
  location: HeaderFooterLocation;
  xml: string;
}

export interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontFamily: string | null;
  fontSize: number | null;
}

export type ParagraphAlignment =
  | "left"
  | "right"
  | "center"
  | "justify";

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
  lineSpacing: number | null;
}

export interface EffectiveFormatting {
  fontFamily: string | null;
  fontSize: number | null;
  bold: boolean;
  lineSpacing: number | null;
}

export interface Paragraph {
  id: string;
  text: string;
  runs: Run[];
  alignment: ParagraphAlignment | null;
  lineSpacing: number | null;
  styleId: string | null;
  isEmpty: boolean;
}

export interface PageMargins {
  left: number | null;
  right: number | null;
  top: number | null;
  bottom: number | null;
}

export type PageNumberFieldType = "PAGE";

export type PageNumberFieldStructure =
  | "fldSimple"
  | "instrText";

export interface PageNumberField {
  sourcePath: string;
  location: HeaderFooterLocation;
  alignment: ParagraphAlignment | null;
  fieldType: PageNumberFieldType;
  structure: PageNumberFieldStructure;
}

export interface PageNumbering {
  hasPageNumbers: boolean;
  fields: PageNumberField[];
}

export type TableOfContentsFieldType = "TOC";

export type TableOfContentsFieldStructure = "fldSimple" | "complex";

export interface TableOfContentsField {
  fieldType: TableOfContentsFieldType;
  structure: TableOfContentsFieldStructure;
  instruction: string;
  sourcePath: string;
}

export interface TableOfContents {
  hasField: boolean;
  fields: TableOfContentsField[];
}

export interface DocumentTables {
  count: number;
  hasTables: boolean;
}

export interface DocumentFigures {
  count: number;
  hasFigures: boolean;
}

export interface DocumentSection {
  normalizedName: string;
  displayName: string;
  paragraphId: string;
  paragraphIndex: number;
  isRuleDefinedHeading: boolean;
}

export interface NormalizedDocument {
  paragraphs: Paragraph[];
  styles: StyleDefinition[];
  documentDefaults: DocumentDefaults;
  pageMargins: PageMargins;
  pageNumbering: PageNumbering;
  tableOfContents: TableOfContents;
  tables: DocumentTables;
  figures: DocumentFigures;
  sections: DocumentSection[];
}

export type { AnalysisReport } from "./AnalysisReport";
export type {
  AcademicSelection,
  AcademicSelectionBase,
} from "./AcademicSelection";

export type {
  RuleResult,
  RuleResultValue,
} from "./RuleResult";

export type {
  Department,
  Faculty,
  Institute,
  Program,
  RuleSetMetadata,
  RuleSetReference,
  StudyType,
  ThesisType,
  University,
  UniversityRuleSet,
} from "./UniversityRuleSet";
