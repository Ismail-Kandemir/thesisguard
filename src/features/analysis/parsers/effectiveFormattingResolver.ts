import type {
  DocumentDefaults,
  EffectiveFormatting,
  Run,
  StyleDefinition,
} from "../types";
import {
  StyleInheritanceResolver,
  type StyleInheritanceEntry,
} from "./styleInheritanceResolver";

export class EffectiveFormattingResolver {
  private readonly inheritanceResolver: StyleInheritanceResolver;

  constructor(
    styles: StyleDefinition[],
    private readonly documentDefaults: DocumentDefaults,
  ) {
    this.inheritanceResolver = new StyleInheritanceResolver(styles);
  }

  resolveRun(
    run: Run,
    paragraphStyleId: string | null,
    paragraphLineSpacing: number | null = null,
  ): EffectiveFormatting {
    const styleChain = paragraphStyleId
      ? this.inheritanceResolver.resolve(paragraphStyleId)
      : [];

    return {
      fontFamily:
        run.fontFamily ??
        findFirstStyleValue(styleChain, (style) => style.fontFamily) ??
        this.documentDefaults.fontFamily,
      fontSize:
        run.fontSize ??
        findFirstStyleValue(styleChain, (style) => style.fontSize) ??
        this.documentDefaults.fontSize,
      lineSpacing:
        paragraphLineSpacing ??
        findFirstStyleValue(styleChain, (style) => style.lineSpacing) ??
        this.documentDefaults.lineSpacing,
    };
  }
}

function findFirstStyleValue<TValue>(
  styleChain: StyleInheritanceEntry[],
  selectValue: (style: StyleDefinition) => TValue | null,
): TValue | null {
  for (const entry of styleChain) {
    if (entry.type !== "style") {
      continue;
    }

    const value = selectValue(entry.style);

    if (value !== null) {
      return value;
    }
  }

  return null;
}
