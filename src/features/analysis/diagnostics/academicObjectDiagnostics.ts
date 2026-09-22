import type {
  AnalysisDiagnostic,
  AnalysisDiagnosticCaptionEvidence,
  AnalysisDiagnosticCode,
  AnalysisDiagnosticReason,
  AnalysisDiagnosticSeverity,
  CaptionOccurrence,
  DocumentObjectSemantics,
  ObjectCaptionAssociation,
  ObjectRepresentationKind,
  ObjectRepresentationOccurrence,
} from "../types";

interface DiagnosticPolicy {
  code: AnalysisDiagnosticCode;
  severity: AnalysisDiagnosticSeverity;
  reason: AnalysisDiagnosticReason;
  message: string;
}

const MAX_TEXT_EXCERPT_LENGTH = 160;
const MAX_TECHNICAL_EVIDENCE_ITEMS = 6;

export function buildAnalysisDiagnostics(
  objectSemantics: DocumentObjectSemantics,
): AnalysisDiagnostic[] {
  const representationById = new Map(
    objectSemantics.representations.map((representation) => [
      representation.id,
      representation,
    ]),
  );
  const associationByObjectId = new Map(
    objectSemantics.associations.map((association) => [
      association.objectId,
      association,
    ]),
  );
  const captionById = new Map(
    objectSemantics.captions.map((caption) => [caption.id, caption]),
  );

  return objectSemantics.resolutions.flatMap((resolution) => {
    const representation = representationById.get(resolution.objectId);
    if (!representation) {
      return [];
    }

    const association = associationByObjectId.get(resolution.objectId) ?? null;
    const policy = selectDiagnosticPolicy(representation, association);
    if (!policy) {
      return [];
    }

    return [
      createDiagnostic(
        policy,
        representation,
        association,
        resolution.status,
        resolution.reasons,
        captionById,
      ),
    ];
  });
}

function selectDiagnosticPolicy(
  representation: ObjectRepresentationOccurrence,
  association: ObjectCaptionAssociation | null,
): DiagnosticPolicy | null {
  if (association?.status === "conflicting") {
    return {
      code: "AMBIGUOUS_ACADEMIC_OBJECT",
      severity: "warning",
      reason: "conflicting-caption-type",
      message:
        "Bir nesnenin teknik türü ile yakınındaki akademik başlık beyanı çeliştiği için akademik rol güvenilir biçimde belirlenemedi.",
    };
  }

  if (association?.status === "ambiguous") {
    if (representation.kind === "equation") {
      return null;
    }

    return {
      code: "AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION",
      severity: "warning",
      reason: "ambiguous-caption-association",
      message:
        "Bir nesne ile olası başlığı arasındaki ilişki güvenilir biçimde belirlenemedi.",
    };
  }

  if (association?.status !== "missing") {
    return null;
  }

  if (representation.academicScope.scope === "front-matter") {
    return null;
  }

  if (isUnsupportedRepresentationDiagnosticKind(representation.kind)) {
    return {
      code: "UNSUPPORTED_OBJECT_REPRESENTATION",
      severity: "info",
      reason: "unsupported-representation-semantics",
      message:
        "Otomatik akademik sınıflandırma kapsamı sınırlı olan bir nesne türü bulundu.",
    };
  }

  if (isUnresolvedDiagnosticKind(representation.kind)) {
    return {
      code: "UNRESOLVED_ACADEMIC_OBJECT",
      severity: "warning",
      reason: "missing-academic-declaration",
      message:
        "Akademik rolü belirlenemeyen bir teknik nesne bulundu; bu durum biçimlendirme hatası olarak puanlanmadı.",
    };
  }

  return null;
}

function isUnresolvedDiagnosticKind(
  kind: ObjectRepresentationKind,
): boolean {
  return kind === "chart" || kind === "diagram" || kind === "group";
}

function isUnsupportedRepresentationDiagnosticKind(
  kind: ObjectRepresentationKind,
): boolean {
  return (
    kind === "vml-image" ||
    kind === "ole" ||
    kind === "unknown-drawing"
  );
}

function createDiagnostic(
  policy: DiagnosticPolicy,
  representation: ObjectRepresentationOccurrence,
  association: ObjectCaptionAssociation | null,
  resolutionStatus: AnalysisDiagnostic["resolutionStatus"],
  resolutionReasons: readonly string[],
  captionById: ReadonlyMap<string, CaptionOccurrence>,
): AnalysisDiagnostic {
  const candidateCaptions = (association?.candidateCaptionIds ?? [])
    .map((captionId) => captionById.get(captionId))
    .filter((caption): caption is CaptionOccurrence => caption !== undefined)
    .map(createCaptionEvidence);

  return {
    id: [
      "diagnostic",
      representation.id,
      policy.code.toLocaleLowerCase("en-US"),
    ].join("-"),
    code: policy.code,
    severity: policy.severity,
    message: policy.message,
    scope: "academic-object-semantics",
    representationId: representation.id,
    representationKind: representation.kind,
    associationStatus: association?.status ?? null,
    resolutionStatus,
    reason: policy.reason,
    evidence: {
      representationId: representation.id,
      representationKind: representation.kind,
      representationScope: representation.scope,
      academicScope: representation.academicScope.scope,
      academicScopeReason: representation.academicScope.reason,
      sourcePart: representation.sourcePart,
      blockIndex: representation.blockIndex,
      paragraphId: representation.paragraphId,
      paragraphIndex: representation.paragraphIndex,
      drawingType: representation.drawingType,
      associationStatus: association?.status ?? null,
      associationReasons: association?.reasons ?? [],
      candidateCaptionIds: association?.candidateCaptionIds ?? [],
      candidateCaptions,
      resolutionStatus,
      resolutionReasons: [...resolutionReasons],
      technicalEvidence: representation.evidence.slice(
        0,
        MAX_TECHNICAL_EVIDENCE_ITEMS,
      ),
    },
  };
}

function createCaptionEvidence(
  caption: CaptionOccurrence,
): AnalysisDiagnosticCaptionEvidence {
  return {
    captionId: caption.id,
    paragraphId: caption.paragraphId,
    blockIndex: caption.blockIndex,
    textExcerpt: truncateText(caption.rawText),
    semanticStatus: caption.semantic.status,
  };
}

function truncateText(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  return normalized.length <= MAX_TEXT_EXCERPT_LENGTH
    ? normalized
    : `${normalized.slice(0, MAX_TEXT_EXCERPT_LENGTH - 1)}…`;
}
