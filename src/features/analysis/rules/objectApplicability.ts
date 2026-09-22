import type {
  CaptionKind,
  CaptionOccurrence,
  DocumentCaption,
  NormalizedDocument,
  ObjectCaptionAssociation,
  ObjectRepresentationOccurrence,
  RuleEvaluationCoverage,
} from "../types";

export interface DeclaredAcademicFigure {
  association: ObjectCaptionAssociation | null;
  caption: DocumentCaption | null;
  representation: ObjectRepresentationOccurrence;
  semanticCaption: CaptionOccurrence | null;
}

export interface DeclaredAcademicFigureIdentity {
  caption: DocumentCaption;
  representation: ObjectRepresentationOccurrence;
}

export function isFigurePhysicalAlignmentEvaluable(
  representation: Readonly<ObjectRepresentationOccurrence>,
): boolean {
  return representation.drawingType === "inline";
}

export function getFigurePhysicalAlignmentCoverage(
  document: Readonly<NormalizedDocument>,
): RuleEvaluationCoverage {
  const declaredFigures = getDeclaredAcademicFigures(document);
  const evaluatedCount = declaredFigures.filter((figure) =>
    isFigurePhysicalAlignmentEvaluable(figure.representation),
  ).length;
  const unevaluatedCount =
    declaredFigures.filter((figure) => figure.representation.drawingType === "anchor").length +
    countUndeclaredAnchoredFigureCandidates(document, declaredFigures);
  const relevantCount = evaluatedCount + unevaluatedCount;

  if (relevantCount === 0) {
    return {
      status: "none",
      evaluatedCount: 0,
      relevantCount: 0,
      unevaluatedCount: 0,
      reasons: ["no-relevant-object"],
    };
  }

  if (evaluatedCount === 0) {
    return {
      status: "none",
      evaluatedCount,
      relevantCount,
      unevaluatedCount,
      reasons: ["unsupported-anchored-placement"],
    };
  }

  if (unevaluatedCount === 0) {
    return {
      status: "complete",
      evaluatedCount,
      relevantCount,
      unevaluatedCount,
      reasons: ["all-relevant-objects-evaluable"],
    };
  }

  return {
    status: "partial",
    evaluatedCount,
    relevantCount,
    unevaluatedCount,
    reasons: ["unsupported-anchored-placement"],
  };
}

export function hasFigurePresenceForConditionalRequirement(
  document: Readonly<NormalizedDocument>,
): boolean {
  return getDeclaredAcademicFigures(document).length > 0;
}

export function getDeclaredAcademicFigureIdentities(
  document: Readonly<NormalizedDocument>,
): DeclaredAcademicFigureIdentity[] {
  return getDeclaredAcademicFigures(document).flatMap((figure) =>
    figure.caption
      ? [{ caption: figure.caption, representation: figure.representation }]
      : [],
  );
}

export function getDeclaredAcademicFigureCarrierParagraphIds(
  document: Readonly<NormalizedDocument>,
): Set<string> {
  return new Set(
    getDeclaredAcademicFigures(document)
      .map((figure) => figure.representation.paragraphId)
      .filter((paragraphId): paragraphId is string => paragraphId !== null),
  );
}

export function getDeclaredAcademicFigures(
  document: Readonly<NormalizedDocument>,
): DeclaredAcademicFigure[] {
  const representationById = new Map(
    document.objectSemantics.representations.map((item) => [item.id, item]),
  );
  const associationByObjectId = new Map(
    document.objectSemantics.associations.map((item) => [item.objectId, item]),
  );
  const semanticCaptionById = new Map(
    document.objectSemantics.captions.map((caption) => [caption.id, caption]),
  );
  const legacyCaptionByParagraphId = new Map(
    document.captions.items.map((caption) => [caption.paragraphId, caption]),
  );

  return document.objectSemantics.resolutions.flatMap((resolution) => {
    if (resolution.status !== "declared" || resolution.academicType !== "figure") {
      return [];
    }

    const representation = representationById.get(resolution.objectId);

    if (!representation) {
      return [];
    }

    const association = associationByObjectId.get(resolution.objectId) ?? null;
    const semanticCaption = resolution.captionId
      ? semanticCaptionById.get(resolution.captionId) ?? null
      : null;
    const caption = semanticCaption
      ? legacyCaptionByParagraphId.get(semanticCaption.paragraphId) ?? null
      : null;

    return [{
      association,
      caption: caption && isFigureCaption(caption) ? caption : null,
      representation,
      semanticCaption,
    }];
  });
}

function isFigureCaption(caption: Readonly<DocumentCaption>): caption is DocumentCaption & {
  kind: Extract<CaptionKind, "figure">;
} {
  return caption.kind === "figure";
}

function countUndeclaredAnchoredFigureCandidates(
  document: Readonly<NormalizedDocument>,
  declaredFigures: readonly DeclaredAcademicFigure[],
): number {
  const declaredRepresentationIds = new Set(
    declaredFigures.map((figure) => figure.representation.id),
  );
  const figureCaptionsByBlock = new Map(
    document.objectSemantics.captions
      .filter((caption) =>
        caption.semantic.status === "declared" &&
        caption.semantic.academicType === "figure"
      )
      .map((caption) => [caption.blockIndex, caption]),
  );

  return document.objectSemantics.representations.filter((representation) => {
    if (
      declaredRepresentationIds.has(representation.id) ||
      representation.kind !== "picture" ||
      representation.drawingType !== "anchor" ||
      representation.academicScope.scope === "front-matter"
    ) {
      return false;
    }

    return hasAdjacentFigureCaption(representation, figureCaptionsByBlock);
  }).length;
}

function hasAdjacentFigureCaption(
  representation: Readonly<ObjectRepresentationOccurrence>,
  figureCaptionsByBlock: ReadonlyMap<number, unknown>,
): boolean {
  if (representation.blockIndex === null) {
    return false;
  }

  return (
    figureCaptionsByBlock.has(representation.blockIndex - 1) ||
    figureCaptionsByBlock.has(representation.blockIndex + 1)
  );
}
