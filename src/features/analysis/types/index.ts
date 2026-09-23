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
  | "PAGE_NUMBER_SEQUENCE"
  | "OBJECT_ALIGNMENT"
  | "OBJECT_CAPTION_PLACEMENT"
  | "OBJECT_CAPTION_FORMAT"
  | "OBJECT_IN_TEXT_REFERENCE"
  | "CONDITIONAL_REQUIRED_SECTION"
  | "REQUIRED_SECTION"
  | "SECTION_ORDER"
  | "SECTION_WORD_COUNT"
  | "SECTION_KEYWORDS"
  | "HEADING_NUMBERING"
  | "HEADING_LEVEL_FORMAT"
  | "HEADING_ALIGNMENT"
  | "PARAGRAPH_INDENTATION"
  | "ABBREVIATION_LIST_CONSISTENCY";

export interface ParagraphIndentationRuleExpected {
  firstLineCm: number;
  toleranceTwips: number;
  sections: string[];
}

export interface HeadingAlignmentRuleExpected {
  levels: number[];
  alignment: ParagraphAlignment;
}

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

export type ConditionalRequiredSectionFact =
  | "hasTables"
  | "hasFigures"
  | "hasAbbreviations";

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

export type PageNumberFormat = "decimal" | "lowerRoman";

export interface PageNumberSequenceRuleExpected {
  transitionSection: string;
  aliases?: string[];
  beforeFormat: PageNumberFormat;
  fromFormat: PageNumberFormat;
  restartAt?: number;
}

export interface ObjectCaptionPlacementRuleExpected {
  object: CaptionKind;
  position: "before" | "after";
}

export interface ObjectCaptionFormatRuleExpected {
  object: CaptionKind;
  alignment: ParagraphAlignment;
  lineSpacing: number;
}

export interface ObjectAlignmentRuleExpected {
  object: CaptionKind;
  alignment: ObjectAlignment;
}

export interface ObjectInTextReferenceRuleExpected {
  object: CaptionKind;
}

export interface SectionKeywordsRuleExpected {
  section: string;
  labels: string[];
  min: number;
  max: number;
  separators: string[];
  placement: "section-end";
}

export interface AbbreviationListConsistencyRuleExpected {
  section: string;
  aliases?: string[];
}

export interface HeadingNumberingSectionExpectation {
  section: string;
  aliases?: string[];
  level: number;
}

export interface HeadingNumberingRuleExpected {
  sections: HeadingNumberingSectionExpectation[];
}

export interface HeadingLevelFormatRuleExpected {
  level: number;
  sections: SectionOrderItem[];
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
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
  | PageNumberSequenceRuleExpected
  | ObjectAlignmentRuleExpected
  | ObjectCaptionPlacementRuleExpected
  | ObjectCaptionFormatRuleExpected
  | ObjectInTextReferenceRuleExpected
  | ConditionalRequiredSectionRuleExpected
  | RequiredSectionRuleExpected
  | SectionOrderRuleExpected
  | SectionWordCountRuleExpected
  | SectionKeywordsRuleExpected
  | HeadingNumberingRuleExpected
  | HeadingLevelFormatRuleExpected
  | HeadingAlignmentRuleExpected
  | ParagraphIndentationRuleExpected
  | AbbreviationListConsistencyRuleExpected
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
  documentRelationshipsXml: string | null;
  stylesXml: string | null;
  numberingXml: string | null;
  themeXml: string | null;
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
  styleId: string | null;
  fontFamilyReference?: RunFontFamilyReference | null;
  bold: boolean | null;
  italic: boolean | null;
  underline: boolean | null;
  fontFamily: string | null;
  fontSize: number | null;
}

export type FontSlotReference =
  | { kind: "explicit"; value: string }
  | { kind: "theme"; value: string };

export interface RunFontFamilyReference {
  ascii: FontSlotReference | null;
  highAnsi: FontSlotReference | null;
  eastAsia: FontSlotReference | null;
  complexScript: FontSlotReference | null;
}

export interface ThemeFontFamily {
  latin: string | null;
  eastAsia: string | null;
  complexScript: string | null;
  scriptOverrides: Readonly<Record<string, string>>;
}

export interface DocumentThemeFonts {
  major: ThemeFontFamily;
  minor: ThemeFontFamily;
}

export type ParagraphAlignment =
  | "left"
  | "right"
  | "center"
  | "justify";

export interface StyleDefinition {
  id: string;
  type: "paragraph" | "character" | "table" | "numbering" | "unknown";
  name: string | null;
  basedOn: string | null;
  nextStyle: string | null;
  fontFamily: string | null;
  fontFamilyReference?: RunFontFamilyReference | null;
  fontSize: number | null;
  bold: boolean | null;
  italic: boolean | null;
  underline: boolean | null;
  lineSpacing: number | null;
  paragraphFormatting: ParagraphFormatting;
  alignment: ParagraphAlignment | null;
  tableAlignment: ObjectAlignment | null;
  numbering: NumberingReference | null;
}

export interface NumberingReference {
  numId: string;
  level: number;
}

export interface NumberingLevelDefinition {
  level: number;
  format: string;
  levelText: string;
  start: number;
}

export interface NumberingDefinition {
  numId: string;
  abstractNumId: string;
  levels: NumberingLevelDefinition[];
}

export interface ParagraphNumbering {
  source: "none" | "text" | "word";
  numId: string | null;
  level: number | null;
  visibleLabel: string | null;
}

export interface DocumentDefaults {
  fontFamily: string | null;
  fontFamilyReference?: RunFontFamilyReference | null;
  fontSize: number | null;
  bold: boolean | null;
  italic: boolean | null;
  underline: boolean | null;
  lineSpacing: number | null;
  alignment: ParagraphAlignment | null;
  paragraphFormatting: ParagraphFormatting;
}

export interface ParagraphIndentation {
  leftTwips: number | null;
  rightTwips: number | null;
  firstLineTwips: number | null;
  hangingTwips: number | null;
  leftChars: number | null;
  rightChars: number | null;
  firstLineChars: number | null;
  hangingChars: number | null;
}

export interface ParagraphSpacing {
  beforeTwips: number | null;
  afterTwips: number | null;
  beforeLines: number | null;
  afterLines: number | null;
}

export interface ParagraphFormatting {
  indentation: ParagraphIndentation;
  spacing: ParagraphSpacing;
}

export type ParagraphContentScope =
  | "document"
  | "textbox";

export interface EffectiveFormatting {
  fontFamily: string | null;
  fontSize: number | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  lineSpacing: number | null;
}

export interface Paragraph {
  id: string;
  text: string;
  runs: Run[];
  contentScope: ParagraphContentScope;
  alignment: ParagraphAlignment | null;
  lineSpacing: number | null;
  paragraphFormatting: ParagraphFormatting;
  styleId: string | null;
  numbering: ParagraphNumbering;
  isTableOfContentsEntry: boolean;
  isInTableCell: boolean;
  isEmpty: boolean;
}

export interface PageMargins {
  left: number | null;
  right: number | null;
  top: number | null;
  bottom: number | null;
}

export type DocumentPageSectionSource =
  | "paragraph"
  | "body";

export interface DocumentPageSection {
  index: number;
  startParagraphIndex: number;
  endParagraphIndex: number;
  pageMargins: PageMargins;
  source: DocumentPageSectionSource;
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

export type HeaderFooterReferenceType = "default" | "first" | "even";

export type HeaderFooterReferenceResolution =
  | "explicit"
  | "inherited"
  | "unresolved";

export interface PageNumberHeaderFooterReference {
  location: HeaderFooterLocation;
  type: HeaderFooterReferenceType;
  relationshipId: string | null;
  targetPath: string | null;
  resolution: HeaderFooterReferenceResolution;
  hasPageField: boolean;
  pageFieldCount: number;
  alignments: ParagraphAlignment[];
}

export interface PageNumbering {
  hasPageNumbers: boolean;
  fields: PageNumberField[];
  sections: PageNumberSection[];
}

export type PageNumberStartSemantics =
  | "explicit-start"
  | "continuation-or-inherited"
  | "unresolved";

export interface PageNumberSection {
  index?: number;
  startParagraphIndex?: number;
  endParagraphIndex: number;
  source?: DocumentPageSectionSource;
  format: string | null;
  start: number | null;
  startSemantics?: PageNumberStartSemantics;
  headerFooterReferences?: PageNumberHeaderFooterReference[];
  differentFirstPage?: boolean;
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
  items: DocumentTableOccurrence[];
}

export type CaptionKind = "table" | "figure";

export type CaptionPosition =
  | "before"
  | "after"
  | "none"
  | "ambiguous";

export type FigureDrawingType =
  | "inline"
  | "anchor"
  | "unknown";

export type ObjectAlignment =
  | "left"
  | "center"
  | "right"
  | "unknown";

export type ObjectAlignmentSource =
  | "direct"
  | "style"
  | "paragraph"
  | "unknown";

export interface DocumentCaption {
  id: string;
  paragraphId: string;
  paragraphIndex: number;
  blockIndex: number;
  text: string;
  kind: CaptionKind;
  label: "Tablo" | "Şekil";
  number: string;
}

export interface DocumentTableOccurrence {
  id: string;
  blockIndex: number | null;
  isNested: boolean;
  tableStyleId: string | null;
  alignment: ObjectAlignment;
  alignmentSource: ObjectAlignmentSource;
  captionId: string | null;
  captionPosition: CaptionPosition;
}

export type DocumentBlock =
  | {
      id: string;
      blockIndex: number;
      type: "paragraph";
      paragraphId: string;
    }
  | {
      id: string;
      blockIndex: number;
      type: "table";
      tableId: string;
    };

export interface DocumentCaptions {
  items: DocumentCaption[];
  orphanCaptionIds: string[];
}

export type ObjectRepresentationKind =
  | "picture"
  | "chart"
  | "diagram"
  | "group"
  | "textbox"
  | "vml-image"
  | "ole"
  | "equation"
  | "table"
  | "unknown-drawing";

export type ObjectRepresentationScope =
  | "body"
  | "table-cell"
  | "textbox";

export interface ObjectRepresentationOccurrence {
  id: string;
  kind: ObjectRepresentationKind;
  sourcePart: "word/document.xml";
  xmlOrder: number;
  blockIndex: number | null;
  paragraphId: string | null;
  paragraphIndex: number | null;
  scope: ObjectRepresentationScope;
  academicScope: AcademicScopeAssignment;
  drawingType: FigureDrawingType | null;
  alignment: ObjectAlignment | null;
  alignmentSource: ObjectAlignmentSource | null;
  evidence: string[];
}

export type AcademicDocumentScopeKind =
  | "front-matter"
  | "main-content"
  | "unknown";

export type AcademicScopeReason =
  | "before-main-content-boundary"
  | "main-content-section"
  | "missing-main-boundary"
  | "ambiguous-main-boundary"
  | "insufficient-location-evidence";

export interface AcademicScopeAssignment {
  scope: AcademicDocumentScopeKind;
  reason: AcademicScopeReason;
  boundaryParagraphId: string | null;
  boundaryParagraphIndex: number | null;
}

export interface AcademicDocumentScopes {
  paragraphs: AcademicScopeAssignment[];
  blocks: AcademicScopeAssignment[];
  mainContentBoundary: AcademicScopeAssignment | null;
}

export type CaptionSemantic =
  | {
      status: "declared";
      academicType: CaptionKind;
      label: "Tablo" | "Şekil";
      number: string;
    }
  | {
      status: "malformed" | "unnumbered" | "unknown";
      academicType: null;
      candidateLabel: "Tablo" | "Şekil" | null;
      reason: string;
    };

export interface CaptionFieldEvidence {
  instruction: string;
}

export interface CaptionOccurrence {
  id: string;
  rawText: string;
  normalizedText: string;
  paragraphId: string;
  paragraphIndex: number;
  blockIndex: number;
  sourcePart: "word/document.xml";
  scope: "body";
  semantic: CaptionSemantic;
  fieldEvidence: CaptionFieldEvidence[];
  isOrphan: boolean;
}

export type ObjectCaptionAssociationStatus =
  | "matched"
  | "missing"
  | "ambiguous"
  | "conflicting"
  | "not-attempted";

export interface ObjectCaptionAssociation {
  objectId: string;
  status: ObjectCaptionAssociationStatus;
  captionId: string | null;
  candidateCaptionIds: string[];
  position: "before" | "after" | null;
  distanceInBlocks: number | null;
  reasons: string[];
}

export type AcademicObjectResolutionStatus =
  | "declared"
  | "unresolved"
  | "ambiguous"
  | "excluded";

export interface AcademicObjectResolution {
  objectId: string;
  status: AcademicObjectResolutionStatus;
  academicType: CaptionKind | null;
  captionId: string | null;
  reasons: string[];
}

export interface DocumentObjectSemantics {
  representations: ObjectRepresentationOccurrence[];
  captions: CaptionOccurrence[];
  associations: ObjectCaptionAssociation[];
  resolutions: AcademicObjectResolution[];
}

export interface DocumentObjectReference {
  kind: CaptionKind;
  number: string;
  paragraphId: string;
  paragraphIndex: number;
  blockIndex: number;
  matchedText: string;
}

export interface DocumentObjectReferences {
  items: DocumentObjectReference[];
}

export interface DocumentAbbreviation {
  value: string;
  occurrences: number;
}

export interface DocumentAbbreviations {
  items: DocumentAbbreviation[];
  count: number;
  hasAbbreviations: boolean;
}

export type AcademicTermEntryKind = "abbreviation" | "symbol";

export type AcademicTermEntryParseStatus = "valid" | "malformed";

export interface AcademicTermEntry {
  kind: AcademicTermEntryKind;
  term: string;
  normalizedTerm: string;
  definition: string;
  paragraphId: string;
  paragraphIndex: number;
  blockIndex: number | null;
  sourceSectionId: string;
  sourceSectionIdentity: string | null;
  confidence: "high" | "low";
  status: AcademicTermEntryParseStatus;
  parsingEvidence: string[];
}

export type BibliographyEntryBoundaryStatus =
  | "DEFINITE_ENTRY"
  | "POSSIBLE_CONTINUATION"
  | "UNRESOLVED";

export interface BibliographyEntryFormattingFacts {
  paragraphStyleId: string | null;
  alignment: ParagraphAlignment | null;
  lineSpacing: number | null;
  paragraphFormatting: ParagraphFormatting;
}

export interface BibliographyEntryOccurrence {
  id: string;
  sectionOccurrenceId: string;
  paragraphIds: string[];
  paragraphIndexes: number[];
  blockStart: number | null;
  blockEnd: number | null;
  visibleText: string;
  normalizedText: string;
  entryIndex: number;
  boundaryStatus: BibliographyEntryBoundaryStatus;
  confidence: "high" | "low";
  formatting: BibliographyEntryFormattingFacts;
  evidence: string[];
}

export type BibliographySectionContentStatus =
  | "SECTION_MISSING"
  | "SECTION_PRESENT_EMPTY"
  | "SECTION_PRESENT_WITH_ENTRIES"
  | "SECTION_PRESENT_UNRESOLVED_CONTENT";

export interface DocumentBibliography {
  sectionOccurrenceId: string | null;
  sectionIdentity: string | null;
  sectionHeadingParagraphId: string | null;
  sectionHeadingParagraphIndex: number | null;
  sectionBoundary: AcademicSectionBoundary | null;
  status: BibliographySectionContentStatus;
  entries: BibliographyEntryOccurrence[];
  unresolvedParagraphIds: string[];
}

export type ObjectListSectionContentStatus =
  | "LIST_SECTION_MISSING"
  | "LIST_SECTION_PRESENT_EMPTY"
  | "LIST_SECTION_PRESENT_WITH_ENTRIES"
  | "LIST_SECTION_PRESENT_UNRESOLVED";

export type ObjectListAssociationStatus =
  | "MATCHED"
  | "MISSING_LIST_ENTRY"
  | "ORPHAN_LIST_ENTRY"
  | "AMBIGUOUS"
  | "UNRESOLVED";

export interface TableListEntryOccurrence {
  id: string;
  sectionOccurrenceId: string;
  paragraphId: string;
  paragraphIndex: number;
  blockIndex: number | null;
  rawText: string;
  normalizedText: string;
  label: "Tablo";
  number: string;
  title: string | null;
  entryIndex: number;
  confidence: "high" | "low";
  evidence: string[];
}

export interface TableListTableAssociation {
  tableId: string;
  captionId: string | null;
  number: string | null;
  listEntryIds: string[];
  status: ObjectListAssociationStatus;
  evidence: string[];
}

export interface TableListEntryAssociation {
  listEntryId: string;
  tableIds: string[];
  captionIds: string[];
  number: string;
  status: ObjectListAssociationStatus;
  evidence: string[];
}

export interface DocumentTableList {
  sectionOccurrenceId: string | null;
  sectionIdentity: string | null;
  sectionHeadingParagraphId: string | null;
  sectionHeadingParagraphIndex: number | null;
  sectionBoundary: AcademicSectionBoundary | null;
  status: ObjectListSectionContentStatus;
  entries: TableListEntryOccurrence[];
  tableAssociations: TableListTableAssociation[];
  entryAssociations: TableListEntryAssociation[];
  unresolvedParagraphIds: string[];
}

export type AcademicSectionRecognitionStatus =
  | "declared"
  | "ambiguous"
  | "unresolved";

export type AcademicSectionConfidence =
  | "high"
  | "ambiguous"
  | "unresolved";

export type AcademicSectionRecognitionEvidence =
  | "rule-expected-section"
  | "rule-alias"
  | "standalone-heading-text"
  | "manual-numbering-prefix"
  | "automatic-numbering"
  | "heading-style"
  | "toc-excluded"
  | "caption-excluded"
  | "textbox-excluded"
  | "table-cell-excluded";

export interface AcademicSectionBoundary {
  startParagraphIndex: number;
  endParagraphIndex: number;
  startBlockIndex: number | null;
  endBlockIndex: number | null;
}

export interface AcademicSectionOccurrence {
  id: string;
  identity: string | null;
  canonicalName: string | null;
  candidateIdentities: string[];
  status: AcademicSectionRecognitionStatus;
  confidence: AcademicSectionConfidence;
  headingParagraphId: string;
  headingParagraphIndex: number;
  blockIndex: number | null;
  normalizedHeadingText: string;
  displayHeadingText: string;
  headingLevel: number | null;
  numberingLevel: number | null;
  numberingSource: HeadingNumberingSource;
  visibleNumberingLabel: string | null;
  recognitionEvidence: AcademicSectionRecognitionEvidence[];
  boundary: AcademicSectionBoundary;
  scope: AcademicScopeAssignment | null;
}

export interface DocumentAcademicSections {
  occurrences: AcademicSectionOccurrence[];
}

export interface DocumentSection {
  normalizedName: string;
  displayName: string;
  paragraphId: string;
  paragraphIndex: number;
  isRuleDefinedHeading: boolean;
  isObjectReferenceExcluded: boolean;
}

export type HeadingNumberingSource =
  | "text"
  | "word"
  | "none";

export interface DocumentHeadingOccurrence {
  id: string;
  paragraphId: string;
  paragraphIndex: number;
  blockIndex: number | null;
  text: string;
  normalizedText: string;
  level: number;
  numberingLevel: number | null;
  numberingSource: HeadingNumberingSource;
  numId: string | null;
  visibleLabel: string | null;
  styleId: string | null;
  styleName: string | null;
  sectionName: string | null;
  isRuleDefinedSection: boolean;
  isAcademicHeading: true;
}

export interface NormalizedDocument {
  paragraphs: Paragraph[];
  styles: StyleDefinition[];
  documentDefaults: DocumentDefaults;
  numberingDefinitions: NumberingDefinition[];
  pageMargins: PageMargins;
  pageSections: DocumentPageSection[];
  pageNumbering: PageNumbering;
  tableOfContents: TableOfContents;
  tables: DocumentTables;
  blocks: DocumentBlock[];
  captions: DocumentCaptions;
  objectSemantics: DocumentObjectSemantics;
  academicScopes: AcademicDocumentScopes;
  objectReferences: DocumentObjectReferences;
  abbreviations: DocumentAbbreviations;
  bibliography?: DocumentBibliography;
  tableList?: DocumentTableList;
  academicSections: DocumentAcademicSections;
  sections: DocumentSection[];
  headings: DocumentHeadingOccurrence[];
  themeFonts?: DocumentThemeFonts | null;
}

export type {
  AnalysisAcademicContext,
  AnalysisDiagnostic,
  AnalysisDiagnosticCaptionEvidence,
  AnalysisDiagnosticCode,
  AnalysisDiagnosticEvidence,
  AnalysisDiagnosticReason,
  AnalysisDiagnosticSeverity,
  AnalysisReport,
  AnalysisRuleSource,
} from "./AnalysisReport";

export type {
  AcademicSelection,
  AcademicSelectionBase,
} from "./AcademicSelection";

export type {
  CaptionRuleEvidence,
  DocumentFormatRuleEvidence,
  HeadingRuleEvidence,
  ObjectRuleEvidence,
  ParagraphRuleEvidence,
  RunRuleEvidence,
  RuleEvidence,
  RuleEvaluationCoverage,
  RuleEvaluationCoverageReason,
  RuleEvaluationCoverageStatus,
  RuleResult,
  RuleResultStatus,
  RuleResultValue,
  SectionRuleEvidence,
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
