import type {
  CaptionKind,
  DocumentFigureOccurrence,
  DocumentCaption,
  NormalizedDocument,
  ObjectRepresentationOccurrence,
  RuleEvaluationCoverage,
} from "../types";

interface DeclaredAcademicFigure {
  caption: DocumentCaption | null;
  representation: ObjectRepresentationOccurrence;
  structuralOccurrence: DocumentFigureOccurrence | null;
}

export function isFigurePhysicalAlignmentEvaluable(
  figure: Readonly<DocumentFigureOccurrence>,
): boolean {
  return figure.drawingType === "inline";
}

export function getFigurePhysicalAlignmentCoverage(
  document: Readonly<NormalizedDocument>,
): RuleEvaluationCoverage {
  if (!document.objectSemantics) {
    const evaluatedCount = document.figures.items.filter(isFigurePhysicalAlignmentEvaluable).length;

    return evaluatedCount === 0
      ? {
          status: "none",
          evaluatedCount: 0,
          relevantCount: 0,
          unevaluatedCount: 0,
          reasons: ["no-relevant-object"],
        }
      : {
          status: "complete",
          evaluatedCount,
          relevantCount: evaluatedCount,
          unevaluatedCount: 0,
          reasons: ["all-relevant-objects-evaluable"],
        };
  }

  const declaredFigures = getDeclaredAcademicFigures(document);
  const evaluatedCount = declaredFigures.filter(
    (figure) =>
      figure.structuralOccurrence !== null &&
      isFigurePhysicalAlignmentEvaluable(figure.structuralOccurrence),
  ).length;
  const unevaluatedCount = countDeclaredAnchoredFigureCandidates(document);
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
  if (!document.objectSemantics) {
    return document.figures.items.some((figure) => figure.drawingType !== "anchor");
  }

  return getDeclaredAcademicFigures(document).length > 0;
}

export function getDeclaredAcademicFigureOccurrences(
  document: Readonly<NormalizedDocument>,
): DocumentFigureOccurrence[] {
  if (!document.objectSemantics) {
    return document.figures.items.filter((figure) =>
      isLegacyFigureCaptioned(document, figure),
    );
  }

  return getDeclaredAcademicFigures(document).flatMap((figure) =>
    figure.structuralOccurrence ? [figure.structuralOccurrence] : [],
  );
}

export function getDeclaredAcademicFigureIdentities(
  document: Readonly<NormalizedDocument>,
): Array<{
  caption: DocumentCaption;
  occurrence: DocumentFigureOccurrence;
}> {
  if (!document.objectSemantics) {
    const captionById = new Map(document.captions.items.map((caption) => [caption.id, caption]));

    return document.figures.items.flatMap((figure) => {
      const caption = figure.captionId ? captionById.get(figure.captionId) : undefined;

      return caption?.kind === "figure" ? [{ caption, occurrence: figure }] : [];
    });
  }

  return getDeclaredAcademicFigures(document).flatMap((figure) =>
    figure.caption && figure.structuralOccurrence
      ? [{ caption: figure.caption, occurrence: figure.structuralOccurrence }]
      : [],
  );
}

export function getDeclaredAcademicFigureCarrierParagraphIds(
  document: Readonly<NormalizedDocument>,
): Set<string> {
  if (!document.objectSemantics) {
    return new Set(document.figures.items.map((figure) => figure.paragraphId));
  }

  return new Set(
    getDeclaredAcademicFigureOccurrences(document).map((figure) => figure.paragraphId),
  );
}

export function isDeclaredAcademicFigureOccurrence(
  document: Readonly<NormalizedDocument>,
  figure: Readonly<DocumentFigureOccurrence>,
): boolean {
  return getDeclaredAcademicFigureOccurrences(document).some(
    (item) => item.id === figure.id,
  );
}

export function getDeclaredAcademicFigures(
  document: Readonly<NormalizedDocument>,
): DeclaredAcademicFigure[] {
  if (!document.objectSemantics) {
    return [];
  }

  const representationById = new Map(
    document.objectSemantics.representations.map((item) => [item.id, item]),
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

    const semanticCaption = resolution.captionId
      ? semanticCaptionById.get(resolution.captionId)
      : undefined;
    const caption = semanticCaption
      ? legacyCaptionByParagraphId.get(semanticCaption.paragraphId) ?? null
      : null;

    return [{
      caption: caption && isFigureCaption(caption) ? caption : null,
      representation,
      structuralOccurrence: findStructuralFigureOccurrence(document, representation),
    }];
  });
}

function findStructuralFigureOccurrence(
  document: Readonly<NormalizedDocument>,
  representation: Readonly<ObjectRepresentationOccurrence>,
): DocumentFigureOccurrence | null {
  return document.figures.items.find((figure) =>
    figure.paragraphId === representation.paragraphId &&
    figure.paragraphIndex === representation.paragraphIndex &&
    figure.blockIndex === representation.blockIndex &&
    figure.drawingType === representation.drawingType
  ) ?? null;
}

function isFigureCaption(caption: Readonly<DocumentCaption>): caption is DocumentCaption & {
  kind: Extract<CaptionKind, "figure">;
} {
  return caption.kind === "figure";
}

function isLegacyFigureCaptioned(
  document: Readonly<NormalizedDocument>,
  figure: Readonly<DocumentFigureOccurrence>,
): boolean {
  if (!figure.captionId) {
    return false;
  }

  const caption = document.captions.items.find((item) => item.id === figure.captionId);
  return caption?.kind === "figure";
}

function countDeclaredAnchoredFigureCandidates(
  document: Readonly<NormalizedDocument>,
): number {
  const figureCaptionsByBlock = new Map(
    document.captions.items
      .filter((caption) => caption.kind === "figure")
      .map((caption) => [caption.blockIndex, caption]),
  );

  return document.figures.items.filter((figure) => {
    if (figure.drawingType !== "anchor" || isDeclaredAcademicFigureOccurrence(document, figure) || !isVisibleSemanticAnchorPicture(document, figure)) {
      return false;
    }

    const scope = getVisibleSemanticAnchorScope(document, figure);
    if (scope === "front-matter") {
      return false;
    }

    return hasAdjacentFigureCaption(figure, figureCaptionsByBlock);
  }).length;
}

function isVisibleSemanticAnchorPicture(
  document: Readonly<NormalizedDocument>,
  figure: Readonly<DocumentFigureOccurrence>,
): boolean {
  return getVisibleSemanticAnchorScope(document, figure) !== null;
}

function getVisibleSemanticAnchorScope(
  document: Readonly<NormalizedDocument>,
  figure: Readonly<DocumentFigureOccurrence>,
): NormalizedDocument["objectSemantics"]["representations"][number]["academicScope"]["scope"] | null {
  const representation = document.objectSemantics.representations.find(
    (item) =>
      item.kind === "picture" &&
      item.drawingType === "anchor" &&
      item.paragraphId === figure.paragraphId &&
      item.blockIndex === figure.blockIndex,
  );

  return representation?.academicScope.scope ?? null;
}

function hasAdjacentFigureCaption(
  figure: Readonly<DocumentFigureOccurrence>,
  figureCaptionsByBlock: ReadonlyMap<number, unknown>,
): boolean {
  if (figure.blockIndex === null) {
    return false;
  }

  return (
    figureCaptionsByBlock.has(figure.blockIndex - 1) ||
    figureCaptionsByBlock.has(figure.blockIndex + 1)
  );
}
