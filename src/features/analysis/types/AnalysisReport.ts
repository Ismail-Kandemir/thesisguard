import type { RuleResult } from "./RuleResult";
import type {
  AcademicDocumentScopeKind,
  AcademicScopeReason,
  AcademicObjectResolutionStatus,
  ObjectCaptionAssociationStatus,
  ObjectRepresentationKind,
  ObjectRepresentationScope,
} from "./index";

export interface AnalysisAcademicContext {
  universityName: string;
  organizationName?: string;
  organizationType?: "faculty" | "institute";
  unitName?: string;
  unitType?: "department" | "program";
  thesisTypeName: string;
  studyTypeName?: string;
  ruleSetId: string;
  ruleSetVersion: string;
}

export interface AnalysisRuleSource {
  guideTitle: string;
}

export type AnalysisDiagnosticSeverity = "info" | "warning";

export type AnalysisDiagnosticCode =
  | "UNRESOLVED_ACADEMIC_OBJECT"
  | "AMBIGUOUS_ACADEMIC_OBJECT"
  | "AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION"
  | "UNSUPPORTED_OBJECT_REPRESENTATION";

export type AnalysisDiagnosticReason =
  | "missing-academic-declaration"
  | "ambiguous-caption-association"
  | "conflicting-caption-type"
  | "unsupported-representation-semantics";

export interface AnalysisDiagnosticEvidence {
  representationId: string;
  representationKind: ObjectRepresentationKind;
  representationScope: ObjectRepresentationScope;
  academicScope: AcademicDocumentScopeKind;
  academicScopeReason: AcademicScopeReason;
  sourcePart: "word/document.xml";
  blockIndex: number | null;
  paragraphId: string | null;
  paragraphIndex: number | null;
  drawingType: "inline" | "anchor" | "unknown" | null;
  associationStatus: ObjectCaptionAssociationStatus | null;
  associationReasons: string[];
  candidateCaptionIds: string[];
  candidateCaptions: AnalysisDiagnosticCaptionEvidence[];
  resolutionStatus: AcademicObjectResolutionStatus;
  resolutionReasons: string[];
  technicalEvidence: string[];
}

export interface AnalysisDiagnosticCaptionEvidence {
  captionId: string;
  paragraphId: string;
  blockIndex: number;
  textExcerpt: string;
  semanticStatus: "declared" | "malformed" | "unnumbered" | "unknown";
}

export interface AnalysisDiagnostic {
  id: string;
  code: AnalysisDiagnosticCode;
  severity: AnalysisDiagnosticSeverity;
  message: string;
  scope: "academic-object-semantics";
  representationId: string;
  representationKind: ObjectRepresentationKind;
  associationStatus: ObjectCaptionAssociationStatus | null;
  resolutionStatus: AcademicObjectResolutionStatus;
  reason: AnalysisDiagnosticReason;
  evidence: AnalysisDiagnosticEvidence;
}

export interface AnalysisReport {
  totalRules: number;
  evaluatedRules: number;
  passedRules: number;
  failedRules: number;
  notApplicableRules: number;
  score: number;
  diagnostics: AnalysisDiagnostic[];
  academicContext?: AnalysisAcademicContext;
  ruleSource?: AnalysisRuleSource;
  results: RuleResult[];
}
