import type {
  DocumentThemeFonts,
  DocumentDefaults,
  EffectiveFormatting,
  ParagraphAlignment,
  ParagraphFormatting,
  Run,
  StyleDefinition,
  FontSlotReference,
  RunFontFamilyReference,
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
    private readonly themeFonts: DocumentThemeFonts | null = null,
  ) {
    this.inheritanceResolver = new StyleInheritanceResolver(styles);
  }

  resolveRun(
    run: Run,
    paragraphStyleId: string | null,
    paragraphLineSpacing: number | null = null,
  ): EffectiveFormatting {
    const characterStyleChain = run.styleId
      ? this.inheritanceResolver.resolve(run.styleId)
      : [];
    const paragraphStyleChain = paragraphStyleId
      ? this.inheritanceResolver.resolve(paragraphStyleId)
      : [];
    const resolveStyleValue = <TValue>(
      selectValue: (style: StyleDefinition) => TValue | null,
    ): TValue | null =>
      findFirstStyleValue(characterStyleChain, selectValue) ??
      findFirstStyleValue(paragraphStyleChain, selectValue);

    return {
      fontFamily: this.resolveFontFamily(
        run,
        characterStyleChain,
        paragraphStyleChain,
      ),
      fontSize:
        run.fontSize ??
        resolveStyleValue((style) => style.fontSize) ??
        this.documentDefaults.fontSize,
      bold:
        run.bold ??
        resolveStyleValue((style) => style.bold) ??
        this.documentDefaults.bold ??
        false,
      italic:
        run.italic ??
        resolveStyleValue((style) => style.italic) ??
        this.documentDefaults.italic ??
        false,
      underline:
        run.underline ??
        resolveStyleValue((style) => style.underline) ??
        this.documentDefaults.underline ??
        false,
      lineSpacing:
        paragraphLineSpacing ??
        findFirstStyleValue(paragraphStyleChain, (style) => style.lineSpacing) ??
        this.documentDefaults.lineSpacing,
    };
  }

  resolveParagraphAlignment(
    paragraphStyleId: string | null,
    paragraphAlignment: ParagraphAlignment | null,
  ): ParagraphAlignment | null {
    const styleChain = paragraphStyleId
      ? this.inheritanceResolver.resolve(paragraphStyleId)
      : [];

    return (
      paragraphAlignment ??
      findFirstStyleValue(styleChain, (style) => style.alignment) ??
      this.documentDefaults.alignment
    );
  }

  resolveParagraphLineSpacing(
    paragraphStyleId: string | null,
    paragraphLineSpacing: number | null,
  ): number | null {
    const styleChain = paragraphStyleId
      ? this.inheritanceResolver.resolve(paragraphStyleId)
      : [];

    return (
      paragraphLineSpacing ??
      findFirstStyleValue(styleChain, (style) => style.lineSpacing) ??
      this.documentDefaults.lineSpacing
    );
  }

  resolveParagraphFormatting(
    paragraphStyleId: string | null,
    direct: ParagraphFormatting,
  ): ParagraphFormatting {
    const styleChain = paragraphStyleId
      ? this.inheritanceResolver.resolve(paragraphStyleId)
      : [];
    const resolve = <TValue>(
      directValue: TValue | null,
      select: (formatting: ParagraphFormatting) => TValue | null,
    ): TValue | null =>
      directValue ??
      findFirstStyleValue(styleChain, (style) => select(style.paragraphFormatting)) ??
      select(this.documentDefaults.paragraphFormatting);

    return {
      indentation: {
        leftTwips: resolve(direct.indentation.leftTwips, (value) => value.indentation.leftTwips),
        rightTwips: resolve(direct.indentation.rightTwips, (value) => value.indentation.rightTwips),
        firstLineTwips: resolve(direct.indentation.firstLineTwips, (value) => value.indentation.firstLineTwips),
        hangingTwips: resolve(direct.indentation.hangingTwips, (value) => value.indentation.hangingTwips),
        leftChars: resolve(direct.indentation.leftChars, (value) => value.indentation.leftChars),
        rightChars: resolve(direct.indentation.rightChars, (value) => value.indentation.rightChars),
        firstLineChars: resolve(direct.indentation.firstLineChars, (value) => value.indentation.firstLineChars),
        hangingChars: resolve(direct.indentation.hangingChars, (value) => value.indentation.hangingChars),
      },
      spacing: {
        beforeTwips: resolve(direct.spacing.beforeTwips, (value) => value.spacing.beforeTwips),
        afterTwips: resolve(direct.spacing.afterTwips, (value) => value.spacing.afterTwips),
        beforeLines: resolve(direct.spacing.beforeLines, (value) => value.spacing.beforeLines),
        afterLines: resolve(direct.spacing.afterLines, (value) => value.spacing.afterLines),
      },
    };
  }

  private resolveFontFamily(
    run: Run,
    characterStyleChain: StyleInheritanceEntry[],
    paragraphStyleChain: StyleInheritanceEntry[],
  ): string | null {
    const layers = [
      getFontReference(run.fontFamilyReference, run.fontFamily),
      ...getStyleFontReferences(characterStyleChain),
      ...getStyleFontReferences(paragraphStyleChain),
      getFontReference(this.documentDefaults.fontFamilyReference, this.documentDefaults.fontFamily),
    ];
    const slots = getRequiredLatinSlots(run.text);
    const resolved = slots.map((slot) => {
      const reference = layers.find((layer) => layer?.[slot] != null)?.[slot] ?? null;
      return resolveFontReference(reference, this.themeFonts);
    });
    if (resolved.some((font) => font === null)) return null;
    const unique = Array.from(new Set(resolved));
    return unique.length === 1 ? unique[0] ?? null : unique.join(" / ");
  }
}

type LatinSlot = "ascii" | "highAnsi";

function getRequiredLatinSlots(text: string): LatinSlot[] {
  let ascii = false;
  let highAnsi = false;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) ascii = true;
    else highAnsi = true;
  }
  return [...(ascii ? ["ascii" as const] : []), ...(highAnsi ? ["highAnsi" as const] : [])];
}

function getStyleFontReferences(chain: StyleInheritanceEntry[]): Array<RunFontFamilyReference | null> {
  return chain.flatMap((entry) =>
    entry.type === "style"
      ? [getFontReference(entry.style.fontFamilyReference, entry.style.fontFamily)]
      : [],
  );
}

function getFontReference(
  reference: RunFontFamilyReference | null | undefined,
  legacyFont: string | null,
): RunFontFamilyReference | null {
  return reference ?? (legacyFont ? {
    ascii: { kind: "explicit", value: legacyFont },
    highAnsi: { kind: "explicit", value: legacyFont },
    eastAsia: null,
    complexScript: null,
  } : null);
}

function resolveFontReference(
  reference: FontSlotReference | null,
  theme: DocumentThemeFonts | null,
): string | null {
  if (!reference) return null;
  if (reference.kind === "explicit") return reference.value;
  if (!theme) return null;
  switch (reference.value) {
    case "majorAscii":
    case "majorHAnsi": return theme.major.latin;
    case "minorAscii":
    case "minorHAnsi": return theme.minor.latin;
    case "majorEastAsia": return theme.major.eastAsia;
    case "minorEastAsia": return theme.minor.eastAsia;
    case "majorBidi": return theme.major.complexScript;
    case "minorBidi": return theme.minor.complexScript;
    default: return null;
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
