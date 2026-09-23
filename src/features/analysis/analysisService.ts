import { RuleEngine } from "./engine/RuleEngine";
import { buildAnalysisDiagnostics } from "./diagnostics/academicObjectDiagnostics";
import { parseDocumentXml } from "./parsers/documentXmlParser";
import { normalizeDocumentNumbering } from "./parsers/documentNumberingNormalizer";
import { parseNumberingXml } from "./parsers/numberingXmlParser";
import { normalizeDocumentAbbreviations } from "./parsers/documentAbbreviationsNormalizer";
import { normalizeAcademicDocumentScopes } from "./parsers/academicDocumentScopeNormalizer";
import { normalizeAcademicSections } from "./parsers/academicSectionsNormalizer";
import { normalizeBibliographySemantics } from "./parsers/bibliographySemanticsNormalizer";
import { parseHeaderFooterPageNumbering } from "./parsers/headerFooterXmlParser";
import { normalizePageNumberingSemantics } from "./parsers/pageNumberingSemantics";
import { parseStylesXml } from "./parsers/stylesXmlParser";
import { parseThemeFontsXml } from "./parsers/themeFontsXmlParser";
import { normalizeDocumentObjectReferences } from "./parsers/documentObjectReferencesNormalizer";
import { normalizeDocumentHeadings } from "./parsers/documentHeadingsNormalizer";
import { readDocxAnalysisXmlParts } from "./readers/docxPackageReader";
import { ReportBuilder } from "./report/ReportBuilder";
import { loadRuleSets } from "./rules/RuleLoader";
import { RuleResolver } from "./rules/RuleResolver";
import { RuleSetSelector } from "./rules/RuleSetSelector";
import { markRequiredSectionHeadings } from "./rules/markRequiredSectionHeadings";
import { assertValidUploadFile } from "../upload/utils";
import type {
  AnalysisAcademicContext,
  AcademicSelection,
  AnalysisReport,
  AnalysisRuleSource,
  NormalizedDocument,
  UniversityRuleSet,
} from "./types";

export async function createNormalizedDocumentFromDocx(file: File): Promise<NormalizedDocument> {
  assertValidUploadFile(file);

  const {
    documentXml,
    documentRelationshipsXml,
    stylesXml,
    numberingXml,
    themeXml,
    headerFooterXmlParts,
  } =
    await readDocxAnalysisXmlParts(file);
  const normalizedDocument = parseDocumentXml(documentXml);
  const parsedStyles = stylesXml ? parseStylesXml(stylesXml) : null;

  const documentWithFormatting: NormalizedDocument = {
    ...normalizedDocument,
    styles: parsedStyles?.styles ?? [],
    documentDefaults: parsedStyles?.documentDefaults ?? normalizedDocument.documentDefaults,
    themeFonts: themeXml ? parseThemeFontsXml(themeXml) : null,
    numberingDefinitions: numberingXml ? parseNumberingXml(numberingXml) : [],
    pageNumbering: normalizePageNumberingSemantics(
      {
        ...parseHeaderFooterPageNumbering(headerFooterXmlParts),
        sections: normalizedDocument.pageNumbering.sections,
      },
      documentRelationshipsXml,
    ),
  };

  const documentWithNumbering = normalizeDocumentNumbering(documentWithFormatting);

  return {
    ...documentWithNumbering,
    abbreviations: normalizeDocumentAbbreviations(documentWithNumbering),
    objectReferences: normalizeDocumentObjectReferences(documentWithNumbering),
  };
}

export async function analyzeDocx(
  file: File,
  selection?: Readonly<AcademicSelection>,
): Promise<AnalysisReport> {
  assertValidUploadFile(file);

  const normalizedDocument = await createNormalizedDocumentFromDocx(file);
  const ruleSets = selection
    ? new RuleSetSelector().select(selection)
    : loadRuleSets();
  const rules = new RuleResolver().resolve(ruleSets);
  const documentWithMarkedSectionHeadings = markRequiredSectionHeadings(
    normalizedDocument,
    rules,
  );
  const documentWithHeadingOccurrences = normalizeDocumentHeadings(
    documentWithMarkedSectionHeadings,
    rules,
  );
  const documentWithAcademicScopes = normalizeAcademicDocumentScopes(
    documentWithHeadingOccurrences,
    rules,
  );
  const documentWithAcademicSections = normalizeAcademicSections(
    documentWithAcademicScopes,
    rules,
  );
  const documentWithBibliographySemantics = normalizeBibliographySemantics(
    documentWithAcademicSections,
    rules,
  );
  const documentWithSectionHeadings: NormalizedDocument = {
    ...documentWithBibliographySemantics,
    abbreviations: normalizeDocumentAbbreviations(
      documentWithBibliographySemantics,
    ),
    objectReferences: normalizeDocumentObjectReferences(
      documentWithBibliographySemantics,
    ),
  };
  const ruleEngine = new RuleEngine();
  const reportBuilder = new ReportBuilder();
  const results = ruleEngine.run(documentWithSectionHeadings, rules);
  const diagnostics = buildAnalysisDiagnostics(
    documentWithSectionHeadings.objectSemantics,
  );

  return reportBuilder.build(
    results,
    createAcademicContext(ruleSets),
    createRuleSource(ruleSets),
    diagnostics,
  );
}

function createRuleSource(
  ruleSets: readonly UniversityRuleSet[],
): AnalysisRuleSource | undefined {
  const ruleSetWithGuide = [...ruleSets]
    .sort(compareRuleSetSpecificity)
    .reverse()
    .find((ruleSet) => ruleSet.metadata.guide);

  return ruleSetWithGuide?.metadata.guide
    ? { guideTitle: ruleSetWithGuide.metadata.guide.title }
    : undefined;
}

function createAcademicContext(
  ruleSets: readonly UniversityRuleSet[],
): AnalysisAcademicContext | undefined {
  const ruleSet = [...ruleSets].sort(compareRuleSetSpecificity).at(-1);

  if (!ruleSet) {
    return undefined;
  }

  const { metadata } = ruleSet;

  return {
    universityName: metadata.university.name,
    ...(metadata.faculty
      ? {
          organizationName: metadata.faculty.name,
          organizationType: "faculty" as const,
        }
      : {}),
    ...(metadata.institute
      ? {
          organizationName: metadata.institute.name,
          organizationType: "institute" as const,
        }
      : {}),
    ...(metadata.department
      ? {
          unitName: metadata.department.name,
          unitType: "department" as const,
        }
      : {}),
    ...(metadata.program
      ? {
          unitName: metadata.program.name,
          unitType: "program" as const,
        }
      : {}),
    thesisTypeName: metadata.thesisType.name,
    ...(metadata.studyType ? { studyTypeName: metadata.studyType.name } : {}),
    ruleSetId: ruleSet.id,
    ruleSetVersion: metadata.version,
  };
}

function compareRuleSetSpecificity(
  first: UniversityRuleSet,
  second: UniversityRuleSet,
): number {
  return getRuleSetSpecificity(first) - getRuleSetSpecificity(second);
}

function getRuleSetSpecificity(ruleSet: UniversityRuleSet): number {
  return [
    ruleSet.metadata.faculty ?? ruleSet.metadata.institute,
    ruleSet.metadata.department ?? ruleSet.metadata.program,
    ruleSet.metadata.studyType,
  ].filter(Boolean).length;
}
