import type { StyleDefinition } from "../types";

export type StyleInheritanceEntry =
  | {
      type: "style";
      style: StyleDefinition;
    }
  | {
      type: "documentDefaults";
    };

export class StyleInheritanceResolver {
  private readonly stylesById: Map<string, StyleDefinition>;
  private readonly duplicateStyleIds: Set<string>;

  constructor(styles: StyleDefinition[]) {
    this.stylesById = new Map(styles.map((style) => [style.id, style]));
    const seen = new Set<string>();
    this.duplicateStyleIds = new Set(styles.filter((style) => {
      if (seen.has(style.id)) return true;
      seen.add(style.id);
      return false;
    }).map((style) => style.id));
  }

  resolve(styleId: string): StyleInheritanceEntry[] {
    const styleChain = this.resolveStyleChain(styleId);

    return [
      ...styleChain.map(createStyleEntry),
      { type: "documentDefaults" },
    ];
  }

  /** Opt-in integrity check; legacy resolve() retains its tolerant traversal. */
  resolveParagraphChain(styleId: string): { styles: StyleDefinition[]; error: string | null } {
    const styles = this.resolve(styleId).flatMap((entry) => entry.type === "style" ? [entry.style] : []);
    if (styles.length === 0) return { styles, error: "The referenced paragraph style is missing." };
    if (styles.some((style) => this.duplicateStyleIds.has(style.id))) {
      return { styles, error: "Duplicate style definitions make inheritance ambiguous." };
    }
    if (styles.some((style) => style.type !== "paragraph")) {
      return { styles, error: "The paragraph style chain contains a non-paragraph style." };
    }
    const unresolvedParent = styles.at(-1)?.basedOn;
    if (unresolvedParent !== null && unresolvedParent !== undefined) {
      return { styles, error: styles.some((style) => style.id === unresolvedParent)
        ? "The paragraph style inheritance chain is cyclic."
        : "A referenced parent style is missing." };
    }
    return { styles, error: null };
  }

  private resolveStyleChain(styleId: string): StyleDefinition[] {
    const resolvedStyles: StyleDefinition[] = [];
    const visitedStyleIds = new Set<string>();
    let currentStyleId: string | null = styleId;

    while (currentStyleId && !visitedStyleIds.has(currentStyleId)) {
      visitedStyleIds.add(currentStyleId);

      const currentStyle = this.stylesById.get(currentStyleId);

      if (!currentStyle) {
        break;
      }

      resolvedStyles.push(currentStyle);
      currentStyleId = currentStyle.basedOn;
    }

    return resolvedStyles;
  }
}

function createStyleEntry(style: StyleDefinition): StyleInheritanceEntry {
  return {
    type: "style",
    style,
  };
}
