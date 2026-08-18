import type {
  NormalizedDocument,
  NumberingDefinition,
  NumberingReference,
  Paragraph,
  ParagraphNumbering,
  StyleDefinition,
} from "../types";
import { parseManualNumberPrefix } from "./sectionNameMatcher";
import { parseDocumentSections } from "./documentSectionsParser";
import { StyleInheritanceResolver } from "./styleInheritanceResolver";

export function normalizeDocumentNumbering(
  document: Readonly<NormalizedDocument>,
): NormalizedDocument {
  const definitionsById = new Map(
    document.numberingDefinitions.map((definition) => [definition.numId, definition]),
  );
  const styleResolver = new StyleInheritanceResolver(document.styles);
  const countersByNumId = new Map<string, number[]>();
  const paragraphs = document.paragraphs.map((paragraph) =>
    normalizeParagraphNumbering(
      {
        ...paragraph,
        isTableOfContentsEntry:
          paragraph.isTableOfContentsEntry ||
          isTableOfContentsStyle(paragraph.styleId, styleResolver),
      },
      document.styles,
      definitionsById,
      styleResolver,
      countersByNumId,
    ),
  );

  return {
    ...document,
    paragraphs,
    sections: parseDocumentSections(paragraphs),
  };
}

function isTableOfContentsStyle(
  styleId: string | null,
  styleResolver: StyleInheritanceResolver,
): boolean {
  if (!styleId) {
    return false;
  }

  return styleResolver.resolve(styleId).some(
    (entry) =>
      entry.type === "style" &&
      (entry.style.id.toLocaleLowerCase("en-US").startsWith("toc") ||
        entry.style.name?.toLocaleLowerCase("en-US").startsWith("toc") === true),
  );
}

function normalizeParagraphNumbering(
  paragraph: Readonly<Paragraph>,
  styles: readonly StyleDefinition[],
  definitionsById: ReadonlyMap<string, NumberingDefinition>,
  styleResolver: StyleInheritanceResolver,
  countersByNumId: Map<string, number[]>,
): Paragraph {
  const manualPrefix = parseManualNumberPrefix(paragraph.text);

  if (manualPrefix) {
    return {
      ...paragraph,
      numbering: {
        source: "text",
        numId: null,
        level: manualPrefix.level,
        visibleLabel: manualPrefix.label,
      },
    };
  }

  const reference = resolveNumberingReference(paragraph, styles, styleResolver);

  if (!reference) {
    return { ...paragraph, numbering: createEmptyNumbering() };
  }

  return {
    ...paragraph,
    numbering: {
      source: "word",
      numId: reference.numId,
      level: reference.level,
      visibleLabel: resolveVisibleLabel(reference, definitionsById, countersByNumId),
    },
  };
}

function resolveNumberingReference(
  paragraph: Readonly<Paragraph>,
  styles: readonly StyleDefinition[],
  styleResolver: StyleInheritanceResolver,
): NumberingReference | null {
  if (paragraph.numbering.source === "word") {
    return paragraph.numbering.numId !== null && paragraph.numbering.level !== null
      ? { numId: paragraph.numbering.numId, level: paragraph.numbering.level }
      : null;
  }

  if (!paragraph.styleId || styles.length === 0) {
    return null;
  }

  for (const entry of styleResolver.resolve(paragraph.styleId)) {
    if (entry.type === "style" && entry.style.numbering) {
      return entry.style.numbering;
    }
  }

  return null;
}

function resolveVisibleLabel(
  reference: NumberingReference,
  definitionsById: ReadonlyMap<string, NumberingDefinition>,
  countersByNumId: Map<string, number[]>,
): string | null {
  const definition = definitionsById.get(reference.numId);
  const levelDefinition = definition?.levels.find((level) => level.level === reference.level);

  if (!levelDefinition || levelDefinition.format !== "decimal") {
    return null;
  }

  const counters = countersByNumId.get(reference.numId) ?? [];
  counters[reference.level] = (counters[reference.level] ?? levelDefinition.start - 1) + 1;
  counters.length = reference.level + 1;
  countersByNumId.set(reference.numId, counters);

  let unresolved = false;
  const label = levelDefinition.levelText.replace(/%(\d+)/g, (_, placeholder: string) => {
    const referencedLevel = Number(placeholder) - 1;
    const value = counters[referencedLevel];

    if (value === undefined) {
      unresolved = true;
      return "";
    }

    return String(value);
  });

  return unresolved ? null : label;
}

function createEmptyNumbering(): ParagraphNumbering {
  return { source: "none", numId: null, level: null, visibleLabel: null };
}
