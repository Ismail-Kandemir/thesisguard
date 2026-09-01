import type { RuleResult } from "./RuleResult";

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

export interface AnalysisReport {
  totalRules: number;
  evaluatedRules: number;
  passedRules: number;
  failedRules: number;
  notApplicableRules: number;
  score: number;
  academicContext?: AnalysisAcademicContext;
  results: RuleResult[];
}
