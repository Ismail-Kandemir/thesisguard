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

  constructor(styles: StyleDefinition[]) {
    this.stylesById = new Map(styles.map((style) => [style.id, style]));
  }

  resolve(styleId: string): StyleInheritanceEntry[] {
    const styleChain = this.resolveStyleChain(styleId);

    return [
      ...styleChain.map(createStyleEntry),
      { type: "documentDefaults" },
    ];
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
