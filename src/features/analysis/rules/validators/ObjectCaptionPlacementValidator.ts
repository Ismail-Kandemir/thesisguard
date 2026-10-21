import type {
  CaptionKind,
  CaptionPosition,
  DocumentTableOccurrence,
  NormalizedDocument,
  ObjectRepresentationOccurrence,
  ObjectCaptionPlacementRuleExpected,
  RuleDefinition,
  RuleEvidence,
  RuleResult,
  RuleResultStatus,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";
import type {
  AssessmentEvidence,
  AssessmentExclusion,
  AssessmentObservation,
  AssessmentSubject,
  RuleAssessment,
} from "../../types/RuleAssessment";
import { createDocumentFormatEvidence, createObjectEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";
import { getDeclaredAcademicFigures } from "../objectApplicability";

type CaptionOccurrence = DocumentTableOccurrence | FigureCaptionOccurrence;

interface FigureCaptionOccurrence extends ObjectRepresentationOccurrence {
  captionPosition: CaptionPosition;
}

export class ObjectCaptionPlacementValidator implements RuleValidator {
  /** Opt-in figure caption placement; table assessment is not migrated. */
  assess(document: NormalizedDocument, rule: RuleDefinition): RuleAssessment {
    assertRule(rule);
    const expected = getExpected(rule.expected);
    const reference = { kind: "rule", id: rule.id } as const;
    const semantics = document.objectSemantics;
    if (!rule.enabled || expected.object !== "figure" || !semantics) {
      return {
        reference,
        applicability: { state: "undetermined", reason: "An enabled figure placement rule and semantic inventory are required." },
        coverage: {
          population: "open", excludedSubjects: [],
          reason: "Figure assessment scope is unavailable.", unresolvedSubjects: [{ kind: "document" }],
        },
        observations: [],
      };
    }

    const declaredById = new Map(getDeclaredAcademicFigures(document).map((figure) => [figure.representation.id, figure]));
    const resolutionById = new Map(semantics.resolutions.map((resolution) => [resolution.objectId, resolution]));
    const representationIds = new Set(semantics.representations.map((item) => item.id));
    const observations: AssessmentObservation[] = [];
    const excludedSubjects: AssessmentExclusion[] = [];
    const unresolvedSubjects: AssessmentSubject[] = [];

    for (const representation of semantics.representations) {
      const subject = { kind: "representation", representationId: representation.id } as const;
      const resolution = resolutionById.get(representation.id);
      const resolutionEvidence: AssessmentEvidence = [createDocumentFormatEvidence(
        `${representation.id}: academic resolution`,
        { actual: resolution ? `${resolution.status}: ${resolution.academicType ?? "unknown"}; ${resolution.reasons.join("; ")}` : null },
      )];
      if (resolution?.status === "excluded" && resolution.reasons.some((reason) => reason.trim().length > 0)) {
        excludedSubjects.push({ subject, reason: resolution.reasons.join("; "), evidence: resolutionEvidence });
        continue;
      }
      if (resolution?.status === "declared" && resolution.academicType === "table") {
        excludedSubjects.push({ subject, reason: "Declared academic table is outside figure placement scope.", evidence: resolutionEvidence });
        continue;
      }

      const figure = declaredById.get(representation.id);
      if (!figure) {
        unresolvedSubjects.push(subject);
        observations.push({
          state: "undetermined", subject,
          identity: {
            certainty: resolution?.status === "ambiguous" ? "ambiguous" : "unresolved",
            reason: "No supported declared academic figure identity is available.",
          },
          evidence: { certainty: "sufficient", items: resolutionEvidence },
        });
        continue;
      }

      const identity = { certainty: "confirmed", evidence: resolutionEvidence } as const;
      if (representation.drawingType !== "inline") {
        observations.push({
          state: "undetermined", subject, identity,
          evidence: {
            certainty: "unsupported",
            boundary: representation.drawingType === "anchor" ? "rendered-layout" : "static-docx",
            reason: "Only inline figure caption placement is deterministically supported.",
          },
        });
        continue;
      }

      const { association, semanticCaption } = figure;
      if (
        representation.blockIndex === null || association?.status !== "matched" ||
        !semanticCaption || semanticCaption.semantic.status !== "declared" ||
        semanticCaption.semantic.academicType !== "figure" || association.captionId !== semanticCaption.id ||
        (association.position !== "before" && association.position !== "after")
      ) {
        observations.push({
          state: "undetermined", subject, identity,
          evidence: { certainty: "missing", reason: "A deterministic matched figure caption position is unavailable." },
        });
        continue;
      }
      observations.push({
        state: "confirmed", subject, identity,
        evidence: {
          certainty: "sufficient",
          items: [createObjectEvidence("figure", representation, {
            captionId: semanticCaption.id, actual: association.position, expected: expected.position,
          })],
        },
        finding: association.position === expected.position ? "compliant" : "violation",
      });
    }

    // Dangling semantic records and unaccounted figure declarations cannot close scope.
    for (const resolution of semantics.resolutions) {
      if (!representationIds.has(resolution.objectId)) {
        unresolvedSubjects.push({ kind: "representation", representationId: resolution.objectId });
      }
    }
    for (const association of semantics.associations) {
      if (!representationIds.has(association.objectId)) {
        unresolvedSubjects.push({ kind: "representation", representationId: association.objectId });
      }
    }
    for (const caption of semantics.captions) {
      if (
        caption.semantic.status === "declared" && caption.semantic.academicType === "figure" &&
        !semantics.resolutions.some((resolution) => representationIds.has(resolution.objectId) &&
          resolution.status === "declared" && resolution.academicType === "figure" && resolution.captionId === caption.id)
      ) {
        unresolvedSubjects.push({ kind: "caption", captionId: caption.id });
      }
    }

    const inventoryEvidence: AssessmentEvidence = [createDocumentFormatEvidence(
      `${rule.id}: semantic figure placement inventory`,
      { actual: `${semantics.representations.length} representations; ${semantics.resolutions.length} resolutions; ${semantics.captions.length} captions`, expected: expected.position },
    )];
    if (unresolvedSubjects.length === 0 && observations.length === 0) {
      return {
        reference,
        applicability: {
          state: "not-applicable", reason: "The closed semantic inventory contains no eligible academic figure.",
          evidence: [inventoryEvidence[0], ...excludedSubjects.flatMap((subject) => subject.evidence)],
        },
      };
    }
    return {
      reference,
      applicability: { state: "applicable", evidence: inventoryEvidence },
      coverage: unresolvedSubjects.length > 0
        ? { population: "open", excludedSubjects, unresolvedSubjects, reason: "Academic object identity or inventory remains unresolved." }
        : { population: "closed", excludedSubjects },
      observations,
    };
  }

  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertRule(rule);
    const expected = getExpected(rule.expected);
    const occurrences = getReliableOccurrences(document, expected.object);

    if (occurrences.length === 0) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadı",
        `${objectName(expected.object)} bulunmadığı veya konumu güvenle belirlenemediği için başlık konumu kontrol edilmedi.`,
      );
    }

    const wrong = occurrences.filter(
      (occurrence) => occurrence.captionPosition !== expected.position,
    );

    if (wrong.length === 0) {
      return createResult(
        rule,
        expected,
        "PASSED",
        formatActual(occurrences),
        `${objectName(expected.object)} başlıklarının konumu uygun.`,
      );
    }

    return createResult(
      rule,
      expected,
      "FAILED",
      formatActual(occurrences),
      createFailureMessage(expected.object, occurrences.length, wrong),
      wrong.slice(0, MAX_RULE_EVIDENCE_ITEMS).map((occurrence) =>
        createObjectEvidence(expected.object, occurrence, {
          actual: positionName(occurrence.captionPosition),
          expected: positionName(expected.position),
        }),
      ),
      wrong.length,
    );
  }
}

function getReliableOccurrences(
  document: Readonly<NormalizedDocument>,
  object: CaptionKind,
): CaptionOccurrence[] {
  return object === "table"
    ? document.tables.items.filter((item) => !item.isNested)
    : getDeclaredAcademicFigures(document)
        .filter((item) => item.representation.drawingType === "inline")
        .map((item) => ({
          ...item.representation,
          captionPosition: item.association?.position ?? "none",
        }));
}

function assertRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "OBJECT_CAPTION_PLACEMENT" } {
  if (rule.type !== "OBJECT_CAPTION_PLACEMENT") {
    throw new Error("ObjectCaptionPlacementValidator yalnızca OBJECT_CAPTION_PLACEMENT kurallarını çalıştırır.");
  }
}

function getExpected(expected: RuleDefinition["expected"]): ObjectCaptionPlacementRuleExpected {
  if (
    typeof expected !== "object" || expected === null ||
    !("object" in expected) || !isObjectKind(expected.object) ||
    !("position" in expected) || (expected.position !== "before" && expected.position !== "after")
  ) {
    throw new Error("OBJECT_CAPTION_PLACEMENT kuralı geçerli object ve position içermelidir.");
  }

  return expected as ObjectCaptionPlacementRuleExpected;
}

function isObjectKind(value: unknown): value is CaptionKind {
  return value === "table" || value === "figure";
}

function createResult(
  rule: RuleDefinition,
  expected: ObjectCaptionPlacementRuleExpected,
  status: RuleResultStatus,
  actual: string,
  message: string,
  evidence?: RuleEvidence[],
  evidenceTotal?: number,
): RuleResult {
  return {
    ruleId: rule.id,
    ruleName: rule.title,
    status,
    passed: status === "PASSED",
    severity: rule.severity,
    expected: `${objectName(expected.object)} başlığı: ${positionName(expected.position)}`,
    actual,
    message,
    ...(evidence && evidence.length > 0 ? { evidence } : {}),
    ...(evidenceTotal !== undefined ? { evidenceTotal } : {}),
  };
}

function formatActual(occurrences: readonly CaptionOccurrence[]): string {
  return occurrences
    .map((item, index) => `${index + 1}: ${positionName(item.captionPosition)}`)
    .join(", ");
}

function createFailureMessage(
  object: CaptionKind,
  total: number,
  wrong: readonly CaptionOccurrence[],
): string {
  const missing = wrong.filter((item) => item.captionPosition === "none").length;
  const ambiguous = wrong.filter((item) => item.captionPosition === "ambiguous").length;

  if (total === 1 && missing === 1) {
    return `${objectName(object)} başlığı tespit edilemedi.`;
  }

  if (total === 1 && ambiguous === 1) {
    return `Başlık ile ${objectName(object).toLocaleLowerCase("tr-TR")} eşleştirmesi güvenilir biçimde belirlenemedi.`;
  }

  if (total === 1) {
    return object === "table"
      ? "Tablo başlığı tablonun üstünde bulunmalıdır."
      : "Şekil başlığı şeklin altında bulunmalıdır.";
  }

  return `${total} ${object === "table" ? "tablodan" : "şekilden"} ${wrong.length} tanesinin başlık konumu uygun değil.`;
}

function objectName(object: CaptionKind): "Tablo" | "Şekil" {
  return object === "table" ? "Tablo" : "Şekil";
}

function positionName(position: CaptionPosition): string {
  switch (position) {
    case "before": return "Üstte";
    case "after": return "Altta";
    case "none": return "Başlık tespit edilemedi";
    case "ambiguous": return "Eşleştirme belirsiz";
  }
}
