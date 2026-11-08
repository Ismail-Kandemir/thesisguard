import { parseDocumentXml } from "./parsers/documentXmlParser";
import { normalizeDocumentNumbering } from "./parsers/documentNumberingNormalizer";
import { parseNumberingXml } from "./parsers/numberingXmlParser";
import { normalizeDocumentAbbreviations } from "./parsers/documentAbbreviationsNormalizer";
import { normalizeCoverSemantics } from "./parsers/coverSemanticsNormalizer";
import { parseHeaderFooterPageNumbering } from "./parsers/headerFooterXmlParser";
import { normalizePageNumberingSemantics } from "./parsers/pageNumberingSemantics";
import { EffectiveFormattingResolver } from "./parsers/effectiveFormattingResolver";
import { parseStylesXml } from "./parsers/stylesXmlParser";
import { parseThemeFontsXml } from "./parsers/themeFontsXmlParser";
import { normalizeDocumentObjectReferences } from "./parsers/documentObjectReferencesNormalizer";
import type { DocxAnalysisXmlParts, NormalizedDocument } from "./types";

/** Shared normalization of one already-read DOCX package. */
export function normalizeDocxParts(parts: DocxAnalysisXmlParts): NormalizedDocument {
  const {
    documentXml,
    documentRelationshipsXml,
    stylesXml,
    numberingXml,
    themeXml,
    headerFooterXmlParts,
  } = parts;
  const normalizedDocument = parseDocumentXml(documentXml);
  const parsedStyles = stylesXml ? parseStylesXml(stylesXml) : null;
  const styles = parsedStyles?.styles ?? [];
  const documentDefaults =
    parsedStyles?.documentDefaults ?? normalizedDocument.documentDefaults;
  const themeFonts = themeXml ? parseThemeFontsXml(themeXml) : null;
  const formattingResolver = new EffectiveFormattingResolver(
    styles,
    documentDefaults,
    themeFonts,
  );

  const documentWithFormatting: NormalizedDocument = {
    ...normalizedDocument,
    styles,
    documentDefaults,
    themeFonts,
    numberingDefinitions: numberingXml ? parseNumberingXml(numberingXml) : [],
    pageNumbering: normalizePageNumberingSemantics(
      {
        ...parseHeaderFooterPageNumbering(
          headerFooterXmlParts,
          (paragraphStyleId, directAlignment) =>
            formattingResolver.resolveParagraphAlignment(
              paragraphStyleId,
              directAlignment,
            ),
        ),
        sections: normalizedDocument.pageNumbering.sections,
      },
      documentRelationshipsXml,
    ),
  };

  const documentWithNumbering = normalizeCoverSemantics(
    normalizeDocumentNumbering(documentWithFormatting),
    documentXml,
  );

  return {
    ...documentWithNumbering,
    abbreviations: normalizeDocumentAbbreviations(documentWithNumbering),
    objectReferences: normalizeDocumentObjectReferences(documentWithNumbering),
  };
}
