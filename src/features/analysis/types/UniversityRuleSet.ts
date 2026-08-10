import type { RuleDefinition, RuleScopeLevel } from "./index";

export interface University {
  id: string;
  name: string;
  slug: string;
}

export interface Faculty {
  id: string;
  name: string;
  slug: string;
}

export interface Institute {
  id: string;
  name: string;
  slug: string;
}

export interface Department {
  id: string;
  name: string;
  slug: string;
}

export interface Program {
  id: string;
  name: string;
  slug: string;
}

export interface ThesisType {
  id: string;
  name: string;
  slug: string;
}

interface RuleSetMetadataBase {
  university: University;
  thesisType: ThesisType;
  version: string;
}

type FacultyOrInstituteMetadata =
  | { faculty: Faculty; institute?: never }
  | { faculty?: never; institute: Institute }
  | { faculty?: never; institute?: never };

type DepartmentOrProgramMetadata =
  | { department: Department; program?: never }
  | { department?: never; program: Program }
  | { department?: never; program?: never };

export type RuleSetMetadata = RuleSetMetadataBase &
  FacultyOrInstituteMetadata &
  DepartmentOrProgramMetadata;

export interface RuleSetReference {
  id: string;
  scopeLevel: RuleScopeLevel;
  version?: string;
}

export interface UniversityRuleSet {
  id: string;
  metadata: RuleSetMetadata;
  extends?: RuleSetReference[];
  rules: RuleDefinition[];
}
