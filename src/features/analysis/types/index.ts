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
  | "ALIGNMENT"
  | "FONT_FAMILY"
  | "FONT_SIZE"
  | "HEADING"
  | "LINE_SPACING"
  | "MARGIN_BOTTOM"
  | "MARGIN_LEFT"
  | "MARGIN_RIGHT"
  | "MARGIN_TOP"
  | "PAGE_NUMBER"
  | "PAGE_NUMBER_SEQUENCE"
  | "PAGE_SIZE"
  | "OBJECT_ALIGNMENT"
  | "OBJECT_CAPTION_PLACEMENT"
  | "OBJECT_CAPTION_FORMAT"
  | "OBJECT_MIN_WIDTH"
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
  | "ABBREVIATION_LIST_CONSISTENCY"
  | "COVER_FIELD_PRESENCE"
  | "COVER_FIELD_FORMAT"
  | "CITATION_BIBLIOGRAPHY_CONSISTENCY"
  | "DIRECT_QUOTATION_PAGE_LOCATOR";

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

export type PageOrientation = "portrait" | "landscape";

export interface PageSizeRuleExpected {
  widthMm: number;
  heightMm: number;
  orientation?: PageOrientation;
  toleranceMm: number;
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

export type PageNumberFormat = "decimal" | "lowerRoman" | "upperRoman";

export interface PageNumberPlacementExpected {
  location?: HeaderFooterLocation;
  alignment?: Exclude<ParagraphAlignment, "justify">;
}

export interface PageNumberFirstPageExpected {
  hidden: boolean;
}

export interface PageNumberSequenceRuleExpected {
  transitionSection: string;
  aliases?: string[];
  beforeStartSection?: string;
  beforeStartAliases?: string[];
  untilSection?: string;
  untilAliases?: string[];
  beforeFormat: PageNumberFormat;
  fromFormat: PageNumberFormat;
  restartAt?: number;
  beforePageNumber?: PageNumberPlacementExpected;
  fromPageNumber?: PageNumberPlacementExpected;
  beforeFirstPage?: PageNumberFirstPageExpected;
  fromFirstPage?: PageNumberFirstPageExpected;
  definesMainContentBoundary?: boolean;
}

export interface ObjectCaptionPlacementRuleExpected {
  object: CaptionKind;
  position: "before" | "after";
}

export interface ObjectCaptionFormatRuleExpected {
  object: CaptionKind;
  alignment?: ParagraphAlignment;
  lineSpacing?: number;
  fontSize?: number;
}

export interface ObjectAlignmentRuleExpected {
  object: CaptionKind;
  alignment: ObjectAlignment;
}

export interface ObjectInTextReferenceRuleExpected {
  object: CaptionKind;
}

export interface ObjectMinimumWidthRuleExpected {
  object: CaptionKind;
  minWidthCm: number;
  toleranceCm?: number;
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

export interface CoverFieldPresenceRuleExpected {
  coverScope: CoverScopeKind;
  field: CoverFieldKind;
  required: boolean;
  minConfidence?: Exclude<CoverScopeConfidence, "unknown">;
  datePrecision?: "month-year";
}

export interface CoverFieldFormatRuleExpected {
  coverScope: CoverScopeKind;
  field: CoverFieldKind;
  minConfidence?: Exclude<CoverScopeConfidence, "unknown">;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
}

export interface HeadingNumberingSectionExpectation {
  section: string;
  aliases?: string[];
  level: number;
}

export interface HeadingNumberingRuleExpected {
  sections: HeadingNumberingSectionExpectation[];
  requireHierarchicalLabels?: boolean;
  maxLevel?: number;
}

export interface HeadingLevelFormatRuleExpected {
  level: number;
  sections?: SectionOrderItem[];
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
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

export type RuleValidationCoverageStatus =
  | "COMPLETE"
  | "PARTIAL"
  | "SHALLOW"
  | "MISSING";

export type RuleValidationTrustStatus =
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export interface RuleValidationMetadata {
  coverage: RuleValidationCoverageStatus;
  trust: RuleValidationTrustStatus;
}

export interface RuleValidationEvidenceMetadata {
  coverage: RuleValidationCoverageStatus;
  trust: RuleValidationTrustStatus;
  note?: string;
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
  | PageSizeRuleExpected
  | ObjectAlignmentRuleExpected
  | ObjectCaptionPlacementRuleExpected
  | ObjectCaptionFormatRuleExpected
  | ObjectMinimumWidthRuleExpected
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
  | CoverFieldPresenceRuleExpected
  | CoverFieldFormatRuleExpected
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
  validationEvidence?: RuleValidationEvidenceMetadata;
  validation?: RuleValidationMetadata;
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

export type TextOffsetUnit = "utf16-code-unit";

export interface RunTextSpanSegment {
  runIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;
}

export interface TextSpan {
  paragraphId: string;
  startOffset: number;
  endOffset: number;
  offsetUnit: TextOffsetUnit;
  runSegments: RunTextSpanSegment[];
  text: string;
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
  lineSpacing: LineSpacingValue | null;
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
  defaultParagraphStyleId: string | null;
  fontFamily: string | null;
  fontFamilyReference?: RunFontFamilyReference | null;
  fontSize: number | null;
  bold: boolean | null;
  italic: boolean | null;
  underline: boolean | null;
  lineSpacing: LineSpacingValue | null;
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
  lineSpacing: LineSpacingValue | null;
}

export type LineSpacingRule =
  | "auto"
  | "exact"
  | "atLeast"
  | "unknown";

export interface LineSpacingValue {
  value: number;
  rule: LineSpacingRule;
}

export interface Paragraph {
  id: string;
  text: string;
  runs: Run[];
  contentScope: ParagraphContentScope;
  alignment: ParagraphAlignment | null;
  lineSpacing: LineSpacingValue | null;
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

export interface PageSize {
  widthMm: number | null;
  heightMm: number | null;
  orientation: PageOrientation | null;
}

export type DocumentPageSectionSource =
  | "paragraph"
  | "body";

export interface DocumentPageSection {
  index: number;
  startParagraphIndex: number;
  endParagraphIndex: number;
  pageMargins: PageMargins;
  pageSize?: PageSize | null;
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

export type ObjectDimensionEvidenceStatus =
  | "available"
  | "missing"
  | "malformed"
  | "ambiguous"
  | "unsupported";

export interface ObjectRepresentationDimensions {
  status: ObjectDimensionEvidenceStatus;
  source: "wp:extent" | null;
  widthCm: number | null;
  heightCm: number | null;
}

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
  dimensions: ObjectRepresentationDimensions;
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

export type CitationOccurrenceConfidence =
  | "medium"
  | "low";

export type CitationOccurrenceEvidence =
  | "visible-document-paragraph"
  | "body-academic-scope"
  | "author-year-parenthetical-pattern"
  | "citation-marker-preserved"
  | "bibliography-section-excluded"
  | "academic-section-boundary-excluded"
  | "document-heading-excluded"
  | "caption-excluded"
  | "list-section-excluded"
  | "front-matter-excluded";

export type CitationOccurrenceScope =
  | "body"
  | "unknown";

export type CitationAuthorKind =
  | "named"
  | "anonymous"
  | "organization"
  | "unknown";

export type CitationItemContext =
  | "parenthetical"
  | "narrative"
  | "unknown";

export type CitationItemConfidence =
  | "high"
  | "medium"
  | "low";

export type CitationItemParseEvidence =
  | "parenthetical-citation-group"
  | "semicolon-item-separator"
  | "author-year-separator"
  | "single-author-pattern"
  | "two-author-ve-pattern"
  | "et-al-pattern"
  | "anonymous-author-marker"
  | "organization-author-marker"
  | "year-pattern"
  | "year-suffix"
  | "ambiguous-author";

export interface CitationItem {
  id: string;
  occurrenceId: string;
  authors: string[];
  authorKind: CitationAuthorKind;
  year: string;
  yearSuffix: string | null;
  context: CitationItemContext;
  rawText: string;
  normalizedText: string;
  confidence: CitationItemConfidence;
  parseEvidence: CitationItemParseEvidence[];
}

export interface CitationOccurrence {
  id: string;
  paragraphId: string;
  paragraphIndex: number;
  blockIndex: number | null;
  rawText: string;
  normalizedText: string;
  matchedText: string;
  normalizedMatchedText: string;
  matchStart: number;
  matchEnd: number;
  scope: CitationOccurrenceScope;
  confidence: CitationOccurrenceConfidence;
  evidence: CitationOccurrenceEvidence[];
  items: CitationItem[];
}

export interface DocumentCitationSemantics {
  occurrences: CitationOccurrence[];
  excludedParagraphIds: string[];
}

export type CitationBibliographyAssociationStatus =
  | "matched"
  | "missing-entry"
  | "ambiguous"
  | "unresolved";

export type CitationBibliographyAssociationConfidence =
  | "high"
  | "medium"
  | "low";

export type CitationBibliographyAssociationEvidence =
  | "citation-item-reliable"
  | "citation-item-unreliable"
  | "bibliography-entry-identity-reliable"
  | "bibliography-entry-identity-unreliable"
  | "author-kind-match"
  | "author-identity-match"
  | "lead-author-et-al-match"
  | "year-match"
  | "year-suffix-match"
  | "year-suffix-mismatch"
  | "single-reliable-match"
  | "no-reliable-match"
  | "multiple-reliable-matches";

export interface CitationBibliographyIdentityKey {
  authorKind: CitationAuthorKind;
  normalizedAuthors: string[];
  year: string;
  yearSuffix: string | null;
}

export interface CitationBibliographyAssociation {
  id: string;
  citationOccurrenceId: string;
  citationItemId: string;
  citationKey: CitationBibliographyIdentityKey | null;
  status: CitationBibliographyAssociationStatus;
  matchedEntryId: string | null;
  candidateEntryIds: string[];
  confidence: CitationBibliographyAssociationConfidence;
  evidence: CitationBibliographyAssociationEvidence[];
}

export interface DocumentCitationBibliographyLinkSemantics {
  associations: CitationBibliographyAssociation[];
}

export type DirectQuotationKind =
  | "inline"
  | "block-candidate"
  | "ambiguous";

export type DirectQuotationScope =
  | "body"
  | "unknown";

export type DirectQuotationConfidence =
  | "high"
  | "low";

export type DirectQuotationDelimiterKind =
  | "straight-double"
  | "smart-left-double"
  | "smart-right-double";

export type DirectQuotationDelimiterRole =
  | "opening"
  | "closing"
  | "ambiguous";

export interface DirectQuotationDelimiterEvidence {
  character: string;
  kind: DirectQuotationDelimiterKind;
  role: DirectQuotationDelimiterRole;
  span: TextSpan;
}

export type DirectQuotationCitationAssociationMethod =
  | "same-paragraph-single-following-citation"
  | "same-paragraph-sequential-following-citation";

export type DirectQuotationCitationAssociationStatus =
  | "associated"
  | "unresolved"
  | "ambiguous";

export type DirectQuotationCitationAssociationConfidence =
  | "high"
  | "low";

export type DirectQuotationCitationAmbiguityReason =
  | "no-following-citation"
  | "citation-before-quote"
  | "multiple-candidate-citations"
  | "multiple-quotes-one-citation"
  | "multiple-quotes-citations-not-sequential"
  | "ambiguous-quotation";

export interface DirectQuotationPageEvidence {
  hasPageMarker: boolean;
  marker: "s." | "ss." | null;
  rawText: string | null;
  pageStart: string | null;
  pageEnd: string | null;
  confidence: DirectQuotationCitationAssociationConfidence;
}

export interface DirectQuotationCitationEvidence {
  citationOccurrenceId: string | null;
  associationStatus: DirectQuotationCitationAssociationStatus;
  associationMethod: DirectQuotationCitationAssociationMethod | null;
  pageEvidence: DirectQuotationPageEvidence;
  confidence: DirectQuotationCitationAssociationConfidence;
  ambiguityReason: DirectQuotationCitationAmbiguityReason | null;
}

export type DirectQuotationExclusionEvidence =
  | "non-main-content-scope"
  | "empty-paragraph"
  | "textbox-excluded"
  | "table-cell-excluded"
  | "toc-excluded"
  | "heading-excluded"
  | "caption-excluded"
  | "list-section-excluded"
  | "bibliography-section-excluded"
  | "academic-section-boundary-excluded"
  | "unmatched-delimiter"
  | "nested-double-quote"
  | "empty-quoted-span"
  | "word-count-not-short-quote"
  | "citation-association-missing"
  | "citation-association-ambiguous";

export interface DirectQuotationOccurrence {
  id: string;
  kind: DirectQuotationKind;
  paragraphIds: string[];
  textSpan: TextSpan;
  rawText: string;
  normalizedText: string;
  wordCount: number;
  delimiterEvidence: DirectQuotationDelimiterEvidence[];
  citationOccurrenceIds: string[];
  citationEvidence: DirectQuotationCitationEvidence[];
  scope: DirectQuotationScope;
  confidence: DirectQuotationConfidence;
  exclusionEvidence: DirectQuotationExclusionEvidence[];
}

export interface DocumentDirectQuotationSemantics {
  occurrences: DirectQuotationOccurrence[];
  excludedParagraphIds: string[];
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

export type BibliographyAuthorKind =
  | "named"
  | "anonymous"
  | "organization"
  | "unknown";

export type BibliographyEntryIdentityParseStatus =
  | "parsed"
  | "partial"
  | "unresolved";

export type BibliographyEntryIdentityConfidence =
  | "high"
  | "medium"
  | "low";

export type BibliographyEntryIdentityEvidence =
  | "year-pattern"
  | "year-suffix"
  | "author-segment-before-year"
  | "named-author-pattern"
  | "anonymous-author-marker"
  | "organization-author-marker"
  | "title-after-year"
  | "missing-year"
  | "missing-author"
  | "missing-title"
  | "ambiguous-author";

export interface BibliographyEntryIdentity {
  authors: string[];
  authorKind: BibliographyAuthorKind;
  year: string | null;
  yearSuffix: string | null;
  title: string | null;
  parseStatus: BibliographyEntryIdentityParseStatus;
  confidence: BibliographyEntryIdentityConfidence;
  parseEvidence: BibliographyEntryIdentityEvidence[];
}

export type BibliographyContributorKind =
  | "person"
  | "organization"
  | "anonymous"
  | "unknown";

export type BibliographyContributorCompleteness =
  | "complete"
  | "incomplete"
  | "ambiguous"
  | "unknown";

export type BibliographyContributorAmbiguityReason =
  | "none"
  | "entry-boundary-unresolved"
  | "missing-year"
  | "missing-contributor"
  | "ambiguous-contributor"
  | "malformed-contributor-list"
  | "et-al-marker"
  | "insufficient-identity-evidence";

export interface BibliographyContributor {
  kind: BibliographyContributorKind;
  familyName: string | null;
  givenNameEvidence: string | null;
  initials: string[];
  normalizedComparisonForm: string | null;
  originalText: string;
  displayText: string;
  order: number;
  parseConfidence: BibliographyEntryIdentityConfidence;
  completeness: BibliographyContributorCompleteness;
  ambiguityReason: BibliographyContributorAmbiguityReason;
}

export interface BibliographyContributorSemantics {
  contributors: BibliographyContributor[];
  completeness: BibliographyContributorCompleteness;
  confidence: BibliographyEntryIdentityConfidence;
  hasEtAlEvidence: boolean;
  etAlEvidence: string[];
  ambiguityReasons: BibliographyContributorAmbiguityReason[];
}

export interface BibliographySortKey {
  contributorKind: BibliographyContributorKind;
  primaryContributorIdentity: string;
  subsequentContributorIdentities: string[];
  year: string;
  yearSuffix: string | null;
  originalEntryOrder: number;
  confidence: BibliographyEntryIdentityConfidence;
}

export interface BibliographyEntryFormattingFacts {
  paragraphStyleId: string | null;
  alignment: ParagraphAlignment | null;
  lineSpacing: LineSpacingValue | null;
  paragraphFormatting: ParagraphFormatting;
}

export type BibliographySourceType =
  | "journal-article"
  | "book"
  | "book-chapter"
  | "thesis"
  | "conference-proceedings"
  | "web-online"
  | "in-press"
  | "unknown"
  | "ambiguous";

export type BibliographySourceTypeConfidence = "high" | "medium" | "low";

export type BibliographySourceTypeEvidence =
  | "journal-volume-issue-pages"
  | "journal-volume-pages"
  | "book-page-count"
  | "book-publisher-marker"
  | "book-chapter-in-marker"
  | "book-chapter-editor-marker"
  | "thesis-marker"
  | "conference-marker"
  | "url-marker"
  | "access-date-marker"
  | "retrieved-marker"
  | "in-press-marker"
  | "identity-parsed"
  | "identity-partial"
  | "identity-unresolved";

export type BibliographySourceTypeAmbiguityReason =
  | "none"
  | "entry-boundary-unresolved"
  | "insufficient-evidence"
  | "conflicting-source-type-evidence"
  | "url-without-web-context"
  | "incomplete-entry-identity";

export interface BibliographyPublicationFacts {
  journalOrVenueCandidate: string | null;
  volumeIssueCandidate: string | null;
  pageRangeCandidate: string | null;
  publisherCandidate: string | null;
  thesisMarker: string | null;
  conferenceProceedingsMarker: string | null;
  urlCandidate: string | null;
  accessDateCandidate: string | null;
  inPressMarker: string | null;
}

export interface BibliographySourceTypeClassification {
  sourceType: BibliographySourceType;
  confidence: BibliographySourceTypeConfidence;
  evidence: BibliographySourceTypeEvidence[];
  ambiguityReason: BibliographySourceTypeAmbiguityReason;
  publicationFacts: BibliographyPublicationFacts;
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
  identity: BibliographyEntryIdentity;
  contributorSemantics: BibliographyContributorSemantics;
  sortKey: BibliographySortKey | null;
  sourceTypeClassification: BibliographySourceTypeClassification;
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

export interface FigureListEntryOccurrence {
  id: string;
  sectionOccurrenceId: string;
  paragraphId: string;
  paragraphIndex: number;
  blockIndex: number | null;
  rawText: string;
  normalizedText: string;
  label: "Şekil";
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

export interface FigureListFigureAssociation {
  objectId: string;
  captionId: string | null;
  number: string | null;
  listEntryIds: string[];
  status: ObjectListAssociationStatus;
  evidence: string[];
}

export interface FigureListEntryAssociation {
  listEntryId: string;
  objectIds: string[];
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

export interface DocumentFigureList {
  sectionOccurrenceId: string | null;
  sectionIdentity: string | null;
  sectionHeadingParagraphId: string | null;
  sectionHeadingParagraphIndex: number | null;
  sectionBoundary: AcademicSectionBoundary | null;
  status: ObjectListSectionContentStatus;
  entries: FigureListEntryOccurrence[];
  figureAssociations: FigureListFigureAssociation[];
  entryAssociations: FigureListEntryAssociation[];
  unresolvedParagraphIds: string[];
}

export type CoverScopeKind =
  | "outer-cover"
  | "inner-cover"
  | "unknown";

export type CoverScopeConfidence =
  | "high"
  | "medium"
  | "low"
  | "unknown";

export type CoverBoundaryEvidenceKind =
  | "explicit-page-break"
  | "paragraph-section-break"
  | "body-section-break";

export interface CoverBoundaryEvidence {
  id: string;
  kind: CoverBoundaryEvidenceKind;
  paragraphId: string | null;
  paragraphIndex: number | null;
  beforeParagraphIndex: number | null;
  afterParagraphIndex: number | null;
  confidence: "high";
  sourcePart: "word/document.xml";
}

export type CoverFieldKind =
  | "institution"
  | "title"
  | "author"
  | "advisor"
  | "work-type"
  | "date"
  | "publication-place";

export type CoverFieldEvidenceKind =
  | "explicit-label"
  | "academic-work-type-pattern"
  | "date-pattern"
  | "turkish-month-year-pattern"
  | "place-date-pattern"
  | "terminal-place-date-proximity"
  | "institution-pattern";

export type CoverDateDetectionStrategy =
  | "year-only"
  | "numeric-month-year"
  | "turkish-month-year";

export interface CoverDateFacts {
  month: number | null;
  year: string;
  rawText: string;
  confidence: Exclude<CoverScopeConfidence, "unknown">;
  detectionStrategy: CoverDateDetectionStrategy;
  precision: "year" | "month-year";
}

export interface CoverFieldOccurrence {
  id: string;
  field: CoverFieldKind;
  value: string;
  normalizedValue: string;
  paragraphId: string;
  paragraphIndex: number;
  coverOccurrenceId: string;
  confidence: Exclude<CoverScopeConfidence, "unknown">;
  evidence: CoverFieldEvidenceKind[];
  dateFacts?: CoverDateFacts;
  sourcePart: "word/document.xml";
}

export interface CoverOccurrence {
  id: string;
  scope: CoverScopeKind;
  confidence: CoverScopeConfidence;
  startParagraphIndex: number;
  endParagraphIndex: number;
  boundaryEvidenceIds: string[];
  fieldOccurrenceIds: string[];
  evidence: string[];
  sourcePart: "word/document.xml";
}

export interface DocumentCoverSemantics {
  occurrences: CoverOccurrence[];
  fields: CoverFieldOccurrence[];
  boundaryEvidence: CoverBoundaryEvidence[];
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
  pageSize?: PageSize | null;
  pageSections: DocumentPageSection[];
  pageNumbering: PageNumbering;
  tableOfContents: TableOfContents;
  tables: DocumentTables;
  blocks: DocumentBlock[];
  captions: DocumentCaptions;
  objectSemantics: DocumentObjectSemantics;
  academicScopes: AcademicDocumentScopes;
  objectReferences: DocumentObjectReferences;
  citationSemantics: DocumentCitationSemantics;
  citationBibliographyLinks: DocumentCitationBibliographyLinkSemantics;
  directQuotations: DocumentDirectQuotationSemantics;
  abbreviations: DocumentAbbreviations;
  bibliography?: DocumentBibliography;
  tableList?: DocumentTableList;
  figureList?: DocumentFigureList;
  coverSemantics: DocumentCoverSemantics;
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
