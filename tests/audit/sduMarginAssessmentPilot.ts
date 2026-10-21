import { AssessmentExecutionService } from "../../src/features/analysis/engine/AssessmentExecutionService";
import type { AssessmentExecutionEntry } from "../../src/features/analysis/engine/AssessmentExecutionService";
import type { AssessmentCandidateReadiness } from "../../src/features/analysis/engine/AssessmentReadinessGate";
import type { NormalizedDocument, RuleDefinition } from "../../src/features/analysis/types";

/** Test-only configuration: never a discovered UniversityRuleSet or production ID. */
export const sduMarginAssessmentPilot = {
  id: "sdu-2026-margin-assessment-pilot",
  mode: "assessment-only",
  source: {
    title: "SDÜ 2026 Bitirme Çalışması ve Tasarım Projesi Dersleri Hazırlama Kılavuzu",
    url: "https://muhendislik.sdu.edu.tr/assets/uploads/sites/152/files/bitirme-odevitasarim-projesi-dersleri-hazirlama-kilavuzu-06042026.pdf",
    section: "2.2",
    printedPage: 4,
    // Frozen provenance from the inventory; not a fresh download/hash assertion.
    frozenSourceSha256: "f3920ac00da8e53994a01b8ee0faa728cb1bcde7ca022fc6337a9feeadf63a44",
    claim: "OOXML section top/bottom margin settings only; rendered and physical output are outside this pilot.",
  },
  candidates: [
    { inventoryId: "SDU-INV-LAY-05", readiness: "assessment-ready", rule: createPilotRule("top") },
    { inventoryId: "SDU-INV-LAY-06", readiness: "assessment-ready", rule: createPilotRule("bottom") },
  ],
  deferredCandidates: [
    "SDU-INV-SEC-03", "SDU-INV-SEC-05", "SDU-INV-SEC-06", "SDU-INV-SEC-07",
    "SDU-INV-SEC-08", "SDU-INV-SEC-09", "SDU-INV-SEC-10", "SDU-INV-SEC-11",
    "SDU-INV-SEC-12", "SDU-INV-SEC-13", "SDU-INV-SEC-14", "SDU-INV-SEC-19",
    "SDU-INV-SEC-22", "SDU-INV-FNT-08", "SDU-INV-HDG-01", "SDU-INV-OBJ-17",
  ].map((inventoryId) => ({ inventoryId, readiness: "deferred" as const })),
} as const;

export const sduAssessmentReadiness: readonly AssessmentCandidateReadiness[] = [
  ...sduMarginAssessmentPilot.candidates,
  ...sduMarginAssessmentPilot.deferredCandidates,
];

/** Only these two rules are passed to the unscored, opt-in execution service. */
export function runSduMarginAssessmentPilot(
  document: NormalizedDocument,
  executor = new AssessmentExecutionService(undefined, sduAssessmentReadiness),
): readonly AssessmentExecutionEntry[] {
  return executor.run(document, sduMarginAssessmentPilot.candidates.map((candidate) => candidate.rule));
}

function createPilotRule(side: "top" | "bottom"): RuleDefinition {
  return {
    id: `pilot.sdu.2026.margin.${side}`,
    type: side === "top" ? "MARGIN_TOP" : "MARGIN_BOTTOM",
    category: "margin",
    title: `SDU ${side} margin assessment pilot`,
    description: "SDU 2026 guide, section 2.2, printed page 4: section margin setting must be 2.5 cm.",
    expected: { value: 2.5, unit: "cm" },
    severity: "error",
    // Required RuleDefinition metadata; this pilot never invokes scoring.
    score: 0,
    message: "Assessment-only margin requirement.",
    solution: "",
    enabled: true,
    version: "2026-assessment-pilot",
  };
}
