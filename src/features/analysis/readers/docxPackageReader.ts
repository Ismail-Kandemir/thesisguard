import JSZip from "jszip";
import type {
  DocxAnalysisXmlParts,
  DocxPackageInspection,
  HeaderFooterLocation,
  HeaderFooterXmlPart,
} from "../types";

const DOCUMENT_XML_PATH = "word/document.xml";
const STYLES_XML_PATH = "word/styles.xml";
const NUMBERING_XML_PATH = "word/numbering.xml";
const DOCUMENT_RELATIONSHIPS_PATH = "word/_rels/document.xml.rels";
const CONVENTIONAL_THEME_XML_PATH = "word/theme/theme1.xml";
const RELATIONSHIPS_NAMESPACE = "http://schemas.openxmlformats.org/package/2006/relationships";
const HEADER_XML_PATTERN = /^word\/header[\w-]*\.xml$/;
const FOOTER_XML_PATTERN = /^word\/footer[\w-]*\.xml$/;

export async function inspectDocxPackage(file: File): Promise<DocxPackageInspection> {
  try {
    const zip = await JSZip.loadAsync(file);
    const packageFiles = Object.values(zip.files).filter((entry) => !entry.dir);
    const fileNames = packageFiles.map((entry) => entry.name);

    const hasDocumentXml = zip.file(DOCUMENT_XML_PATH) !== null;
    const hasStylesXml = zip.file(STYLES_XML_PATH) !== null;
    const hasNumberingXml = zip.file(NUMBERING_XML_PATH) !== null;

    if (!hasDocumentXml) {
      throw new Error("DOCX paketinde word/document.xml bulunamadi.");
    }

    await readXmlPart(file, DOCUMENT_XML_PATH, zip);

    return {
      fileName: file.name,
      fileSize: file.size,
      hasDocumentXml,
      hasStylesXml,
      hasNumberingXml,
      headerXmlFiles: fileNames.filter((fileName) => HEADER_XML_PATTERN.test(fileName)).sort(),
      footerXmlFiles: fileNames.filter((fileName) => FOOTER_XML_PATTERN.test(fileName)).sort(),
      totalFileCount: packageFiles.length,
    };
  } catch (error) {
    throw new Error(createDocxInspectionErrorMessage(error), { cause: error });
  }
}

export async function readDocxDocumentXml(file: File): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(file);

    return await readXmlPart(file, DOCUMENT_XML_PATH, zip);
  } catch (error) {
    throw new Error(createDocxInspectionErrorMessage(error), { cause: error });
  }
}

export async function readDocxAnalysisXmlParts(file: File): Promise<DocxAnalysisXmlParts> {
  try {
    const zip = await JSZip.loadAsync(file);
    const documentXml = await readXmlPart(file, DOCUMENT_XML_PATH, zip);
    const stylesXml = zip.file(STYLES_XML_PATH)
      ? await readXmlPart(file, STYLES_XML_PATH, zip)
      : null;
    const numberingXml = zip.file(NUMBERING_XML_PATH)
      ? await readXmlPart(file, NUMBERING_XML_PATH, zip)
      : null;
    const themeXml = await readThemeXmlPart(file, zip);
    const headerFooterXmlParts = await readHeaderFooterXmlParts(file, zip);

    return { documentXml, stylesXml, numberingXml, themeXml, headerFooterXmlParts };
  } catch (error) {
    throw new Error(createDocxInspectionErrorMessage(error), { cause: error });
  }
}

async function readThemeXmlPart(file: File, zip: JSZip): Promise<string | null> {
  const relationshipPath = zip.file(DOCUMENT_RELATIONSHIPS_PATH)
    ? await findThemeRelationshipTarget(file, zip)
    : null;
  const themePath = relationshipPath ??
    (zip.file(CONVENTIONAL_THEME_XML_PATH) ? CONVENTIONAL_THEME_XML_PATH : null);
  return themePath && zip.file(themePath) ? readXmlPart(file, themePath, zip) : null;
}

async function findThemeRelationshipTarget(file: File, zip: JSZip): Promise<string | null> {
  const xml = await readXmlPart(file, DOCUMENT_RELATIONSHIPS_PATH, zip);
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const relationship = Array.from(
    document.getElementsByTagNameNS(RELATIONSHIPS_NAMESPACE, "Relationship"),
  ).find((entry) =>
    entry.getAttribute("Type")?.endsWith("/theme") &&
    entry.getAttribute("TargetMode")?.toLowerCase() !== "external",
  );
  const target = relationship?.getAttribute("Target")?.replaceAll("\\", "/") ?? null;
  return target ? resolveWordPartTarget(target) : null;
}

function resolveWordPartTarget(target: string): string | null {
  const segments = target.startsWith("/") ? [] : ["word"];
  for (const segment of target.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return null;
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  const resolved = segments.join("/");
  return resolved.startsWith("word/") ? resolved : null;
}

async function readHeaderFooterXmlParts(
  file: File,
  zip: JSZip,
): Promise<HeaderFooterXmlPart[]> {
  const partDescriptors = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => ({ path: entry.name, location: getHeaderFooterLocation(entry.name) }))
    .filter(
      (descriptor): descriptor is { path: string; location: HeaderFooterLocation } =>
        descriptor.location !== null,
    )
    .sort((first, second) => first.path.localeCompare(second.path));

  return Promise.all(
    partDescriptors.map(async ({ path, location }) => ({
      path,
      location,
      xml: await readXmlPart(file, path, zip),
    })),
  );
}

function getHeaderFooterLocation(path: string): HeaderFooterLocation | null {
  if (HEADER_XML_PATTERN.test(path)) {
    return "header";
  }

  if (FOOTER_XML_PATTERN.test(path)) {
    return "footer";
  }

  return null;
}

async function readXmlPart(file: File, partPath: string, zip: JSZip): Promise<string> {
  const xmlFile = zip.file(partPath);

  if (!xmlFile) {
    throw new Error(`${partPath} okunamadi.`);
  }

  const xmlContent = await xmlFile.async("text");
  const xmlDocument = new DOMParser().parseFromString(xmlContent, "application/xml");

  if (xmlDocument.querySelector("parsererror")) {
    throw new Error(`${file.name} icindeki ${partPath} gecerli XML degil.`);
  }

  return xmlContent;
}

function createDocxInspectionErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `DOCX paketi okunamadi: ${error.message}`;
  }

  return "DOCX paketi okunamadi: Bilinmeyen bir hata olustu.";
}
