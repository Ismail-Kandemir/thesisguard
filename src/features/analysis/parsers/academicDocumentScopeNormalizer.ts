import type {
  AcademicDocumentScopes,
  AcademicScopeAssignment,
  DocumentBlock,
  DocumentSection,
  NormalizedDocument,
  PageNumberSequenceRuleExpected,
  RuleDefinition,
} from "../types";
import { sectionMatchesExpectedName } from "./sectionNameMatcher";

const DEFAULT_MAIN_CONTENT_BOUNDARY_NAMES = ["Giriş"];

export function normalizeAcademicDocumentScopes(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): NormalizedDocument {
  const boundaryNames = getMainContentBoundaryNames(rules);
  const boundaryCandidates = document.sections.filter((section) =>
    section.isRuleDefinedHeading &&
    boundaryNames.some((boundaryName) =>
      sectionMatchesExpectedName(section, boundaryName),
    ),
  );
  const academicScopes = createAcademicScopes(
    document.paragraphs.length,
    document.blocks,
    boundaryCandidates,
  );
  const blockScopeByIndex = new Map(
    document.blocks.map((block, index) => [block.blockIndex, academicScopes.blocks[index]]),
  );

  return {
    ...document,
    academicScopes,
    objectSemantics: {
      ...document.objectSemantics,
      representations: document.objectSemantics.representations.map((representation) => ({
        ...representation,
        academicScope: representation.blockIndex !== null
          ? blockScopeByIndex.get(representation.blockIndex) ?? insufficientLocationScope()
          : representation.paragraphIndex !== null
            ? academicScopes.paragraphs[representation.paragraphIndex] ?? insufficientLocationScope()
            : insufficientLocationScope(),
      })),
    },
  };
}

function getMainContentBoundaryNames(
  rules: readonly RuleDefinition[],
): readonly string[] {
  const transitionSections = rules
    .filter(isPageNumberSequenceRule)
    .map((rule) => rule.expected.transitionSection);

  return transitionSections.length > 0
    ? uniqueStrings(transitionSections)
    : DEFAULT_MAIN_CONTENT_BOUNDARY_NAMES;
}

function createAcademicScopes(
  paragraphCount: number,
  blocks: readonly DocumentBlock[],
  boundaryCandidates: readonly DocumentSection[],
): AcademicDocumentScopes {
  if (boundaryCandidates.length === 0) {
    return createUniformScopes(
      paragraphCount,
      blocks.length,
      unknownScope("missing-main-boundary"),
    );
  }

  if (boundaryCandidates.length > 1) {
    return createUniformScopes(
      paragraphCount,
      blocks.length,
      unknownScope("ambiguous-main-boundary"),
    );
  }

  const boundary = boundaryCandidates[0];
  const boundaryScope = {
    scope: "main-content",
    reason: "main-content-section",
    boundaryParagraphId: boundary.paragraphId,
    boundaryParagraphIndex: boundary.paragraphIndex,
  } satisfies AcademicScopeAssignment;
  const paragraphs = Array.from({ length: paragraphCount }, (_, paragraphIndex) =>
    paragraphIndex < boundary.paragraphIndex
      ? frontMatterScope(boundary)
      : boundaryScope,
  );
  const blockScopes = blocks.map((block) => {
    if (block.type === "paragraph") {
      const paragraphNumber = Number(block.paragraphId.replace("paragraph-", ""));
      const paragraphIndex = Number.isInteger(paragraphNumber) ? paragraphNumber - 1 : null;
      return paragraphIndex !== null
        ? paragraphs[paragraphIndex] ?? insufficientLocationScope()
        : insufficientLocationScope();
    }

    return block.blockIndex < getBoundaryBlockIndex(blocks, boundary)
      ? frontMatterScope(boundary)
      : boundaryScope;
  });

  return {
    paragraphs,
    blocks: blockScopes,
    mainContentBoundary: boundaryScope,
  };
}

function createUniformScopes(
  paragraphCount: number,
  blockCount: number,
  scope: AcademicScopeAssignment,
): AcademicDocumentScopes {
  return {
    paragraphs: Array.from({ length: paragraphCount }, () => scope),
    blocks: Array.from({ length: blockCount }, () => scope),
    mainContentBoundary: null,
  };
}

function frontMatterScope(boundary: DocumentSection): AcademicScopeAssignment {
  return {
    scope: "front-matter",
    reason: "before-main-content-boundary",
    boundaryParagraphId: boundary.paragraphId,
    boundaryParagraphIndex: boundary.paragraphIndex,
  };
}

function unknownScope(
  reason: Extract<
    AcademicScopeAssignment["reason"],
    "missing-main-boundary" | "ambiguous-main-boundary"
  >,
): AcademicScopeAssignment {
  return {
    scope: "unknown",
    reason,
    boundaryParagraphId: null,
    boundaryParagraphIndex: null,
  };
}

function insufficientLocationScope(): AcademicScopeAssignment {
  return {
    scope: "unknown",
    reason: "insufficient-location-evidence",
    boundaryParagraphId: null,
    boundaryParagraphIndex: null,
  };
}

function getBoundaryBlockIndex(
  blocks: readonly DocumentBlock[],
  boundary: DocumentSection,
): number {
  return blocks.find((block) =>
    block.type === "paragraph" && block.paragraphId === boundary.paragraphId,
  )?.blockIndex ?? boundary.paragraphIndex;
}

function isPageNumberSequenceRule(
  rule: RuleDefinition,
): rule is RuleDefinition & {
  type: "PAGE_NUMBER_SEQUENCE";
  expected: PageNumberSequenceRuleExpected;
} {
  return (
    rule.enabled &&
    rule.type === "PAGE_NUMBER_SEQUENCE" &&
    typeof rule.expected === "object" &&
    rule.expected !== null &&
    "transitionSection" in rule.expected
  );
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
