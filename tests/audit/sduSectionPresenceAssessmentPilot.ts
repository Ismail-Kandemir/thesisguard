import { AssessmentExecutionService } from "../../src/features/analysis/engine/AssessmentExecutionService";
import type { AssessmentExecutionEntry } from "../../src/features/analysis/engine/AssessmentExecutionService";
import type { AssessmentCandidateReadiness } from "../../src/features/analysis/engine/AssessmentReadinessGate";
import { normalizeAcademicSections } from "../../src/features/analysis/parsers/academicSectionsNormalizer";
import { normalizeDocumentNumbering } from "../../src/features/analysis/parsers/documentNumberingNormalizer";
import { parseDocumentXml } from "../../src/features/analysis/parsers/documentXmlParser";
import { parseNumberingXml } from "../../src/features/analysis/parsers/numberingXmlParser";
import { parseStylesXml } from "../../src/features/analysis/parsers/stylesXmlParser";
import { readDocxAnalysisXmlParts } from "../../src/features/analysis/readers/docxPackageReader";
import { markRequiredSectionHeadings } from "../../src/features/analysis/rules/markRequiredSectionHeadings";
import type { NormalizedDocument, RuleDefinition } from "../../src/features/analysis/types";

function presenceRule(id: string, section: string, item: number, guideSection?: string): RuleDefinition {
  return {
    id, type: "REQUIRED_SECTION", category: "structure",
    title: `SDÜ ${section} section presence assessment pilot`,
    description: `SDÜ 2026 guide: section 1, printed page 3, item ${item}${guideSection ? `; section ${guideSection}, printed page 16` : ""}. Academic section presence only.`,
    expected: { section, required: true }, severity: "error", score: 0,
    message: "Assessment-only academic section presence requirement.", solution: "", enabled: true,
    version: "2026-section-presence-assessment-pilot",
  };
}

/** Test-only, independent execution scope; never a production UniversityRuleSet. */
export const sduSectionPresenceAssessmentPilot = {
  id: "sdu-2026-section-presence-assessment-pilot",
  mode: "assessment-only",
  source: {
    title: "SDÜ 2026 Bitirme Çalışması ve Tasarım Projesi Dersleri Hazırlama Kılavuzu",
    url: "https://muhendislik.sdu.edu.tr/assets/uploads/sites/152/files/bitirme-odevitasarim-projesi-dersleri-hazirlama-kilavuzu-06042026.pdf",
    // Frozen inventory provenance; not a fresh download/hash assertion.
    frozenSourceSha256: "f3920ac00da8e53994a01b8ee0faa728cb1bcde7ca022fc6337a9feeadf63a44",
    claim: "Qualified academic section presence only. Order, first-section position, academic content quality and formatting are separate claims.",
  },
  candidates: [
    { inventoryId: "SDU-INV-SEC-13", readiness: "assessment-ready",
      references: [{ section: "1", printedPage: 3, item: 13 }, { section: "4.2", printedPage: 16 }],
      rule: presenceRule("pilot.sdu.2026.section.introduction.presence", "Giriş", 13, "4.2") },
    { inventoryId: "SDU-INV-SEC-07", readiness: "assessment-ready",
      references: [{ section: "1", printedPage: 3, item: 7 }, { section: "4.1", printedPage: 16 }],
      rule: presenceRule("pilot.sdu.2026.section.summary.presence", "Özet", 7, "4.1") },
    { inventoryId: "SDU-INV-SEC-08", readiness: "assessment-ready",
      references: [{ section: "1", printedPage: 3, item: 8 }, { section: "4.1", printedPage: 16 }],
      rule: presenceRule("pilot.sdu.2026.section.abstract.presence", "Abstract", 8, "4.1") },
    { inventoryId: "SDU-INV-SEC-03", readiness: "assessment-ready",
      references: [{ section: "1", printedPage: 3, item: 3 }],
      rule: presenceRule("pilot.sdu.2026.section.thesis-approval.presence", "Tez Onayı", 3) },
    { inventoryId: "SDU-INV-SEC-05", readiness: "assessment-ready",
      references: [{ section: "1", printedPage: 3, item: 5 }],
      rule: presenceRule("pilot.sdu.2026.section.undertaking.presence", "Taahhütname", 5) },
  ],
} as const;

/** Only these five section contracts have permission; the margin policy is unchanged. */
export const sduSectionPresencePilotReadiness: readonly AssessmentCandidateReadiness[] = sduSectionPresenceAssessmentPilot.candidates;

/** Read existing package parts without rewriting the DOCX or invoking production analysis. */
export async function readSduSectionPresencePilotDocx(file: File): Promise<NormalizedDocument> {
  const { documentXml, stylesXml, numberingXml } = await readDocxAnalysisXmlParts(file);
  const document = parseDocumentXml(documentXml);
  const styles = stylesXml ? parseStylesXml(stylesXml) : null;
  return normalizeDocumentNumbering({
    ...document,
    styles: styles?.styles ?? [],
    documentDefaults: styles?.documentDefaults ?? document.documentDefaults,
    numberingDefinitions: numberingXml ? parseNumberingXml(numberingXml) : [],
  });
}

/** Existing normalizers qualify the requested presence contract without numbering anchors. */
export function runSduSectionPresenceAssessmentPilot(
  document: NormalizedDocument,
  executor = new AssessmentExecutionService(undefined, sduSectionPresencePilotReadiness),
  rules: readonly RuleDefinition[] = sduSectionPresenceAssessmentPilot.candidates.map((candidate) => candidate.rule),
): readonly AssessmentExecutionEntry[] {
  const qualified = normalizeAcademicSections(markRequiredSectionHeadings(document, rules), rules);
  return executor.run(qualified, rules);
}
