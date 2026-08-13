export interface AcademicSelectionBase {
  universityId: string;
  thesisTypeId: string;
}

type FacultyOrInstituteSelection =
  | { facultyId: string; instituteId?: never }
  | { facultyId?: never; instituteId: string };

type DepartmentOrProgramSelection =
  | { departmentId: string; programId?: never }
  | { departmentId?: never; programId: string };

export type AcademicSelection = AcademicSelectionBase &
  FacultyOrInstituteSelection &
  DepartmentOrProgramSelection;
