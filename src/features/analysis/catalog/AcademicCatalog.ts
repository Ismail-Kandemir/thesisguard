import type {
  Department,
  Faculty,
  Institute,
  Program,
  StudyType,
  ThesisType,
  University,
} from "../types";

interface AcademicCatalogEntryBase {
  university: Readonly<University>;
  thesisType: Readonly<ThesisType>;
  studyTypes?: readonly Readonly<StudyType>[];
}

type FacultyOrInstituteCatalogEntry =
  | { faculty: Readonly<Faculty>; institute?: never }
  | { faculty?: never; institute: Readonly<Institute> };

type DepartmentOrProgramCatalogEntry =
  | { department: Readonly<Department>; program?: never }
  | { department?: never; program: Readonly<Program> };

export type AcademicCatalogEntry = Readonly<
  AcademicCatalogEntryBase &
    FacultyOrInstituteCatalogEntry &
    DepartmentOrProgramCatalogEntry
>;

export const ACADEMIC_CATALOG: readonly AcademicCatalogEntry[] = [
  {
    university: {
      id: "comu",
      name: "Çanakkale Onsekiz Mart Üniversitesi",
      slug: "comu",
    },
    faculty: {
      id: "applied-sciences",
      name: "Uygulamalı Bilimler Fakültesi",
      slug: "applied-sciences",
    },
    department: {
      id: "food-technology",
      name: "Gıda Teknolojisi",
      slug: "food-technology",
    },
    thesisType: {
      id: "bachelor",
      name: "Lisans",
      slug: "bachelor",
    },
    studyTypes: [
      {
        id: "experimental",
        name: "Deneysel Çalışma",
        slug: "experimental",
      },
      {
        id: "source-research",
        name: "Teorik / Kaynak Araştırması",
        slug: "source-research",
      },
    ],
  },
];
