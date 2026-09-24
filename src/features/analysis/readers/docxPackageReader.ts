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

export const DOCX_PACKAGE_LIMITS = {
  maxPartCount: 750,
  maxPartSizeBytes: 12 * 1024 * 1024,
  maxTotalUncompressedSizeBytes: 80 * 1024 * 1024,
} as const;

export type DocxPackageErrorCode =
  | "DOCX_MALFORMED_PACKAGE"
  | "DOCX_MISSING_DOCUMENT_XML"
  | "DOCX_INVALID_XML"
  | "DOCX_EXCESSIVE_PART_COUNT"
  | "DOCX_EXCESSIVE_PART_SIZE"
  | "DOCX_EXCESSIVE_TOTAL_SIZE";

export class DocxPackageError extends Error {
  constructor(
    readonly code: DocxPackageErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DocxPackageError";
  }
}

type ZipObjectWithSizeMetadata = JSZip.JSZipObject & {
  _data?: {
    uncompressedSize?: number;
  };
};

export async function inspectDocxPackage(file: File): Promise<DocxPackageInspection> {
  try {
    const zip = await JSZip.loadAsync(file);
    assertSafeDocxPackage(zip);
    const packageFiles = Object.values(zip.files).filter((entry) => !entry.dir);
    const fileNames = packageFiles.map((entry) => entry.name);

    const hasDocumentXml = zip.file(DOCUMENT_XML_PATH) !== null;
    const hasStylesXml = zip.file(STYLES_XML_PATH) !== null;
    const hasNumberingXml = zip.file(NUMBERING_XML_PATH) !== null;

    if (!hasDocumentXml) {
      throw new DocxPackageError(
        "DOCX_MISSING_DOCUMENT_XML",
        "DOCX paketinde word/document.xml bulunamadi.",
      );
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
    throw createDocxPackageReadError(error);
  }
}

export async function readDocxDocumentXml(file: File): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(file);
    assertSafeDocxPackage(zip);

    return await readXmlPart(file, DOCUMENT_XML_PATH, zip);
  } catch (error) {
    throw createDocxPackageReadError(error);
  }
}

export async function readDocxAnalysisXmlParts(file: File): Promise<DocxAnalysisXmlParts> {
  try {
    const zip = await JSZip.loadAsync(file);
    assertSafeDocxPackage(zip);
    const documentXml = await readXmlPart(file, DOCUMENT_XML_PATH, zip);
    const documentRelationshipsXml = zip.file(DOCUMENT_RELATIONSHIPS_PATH)
      ? await readXmlPart(file, DOCUMENT_RELATIONSHIPS_PATH, zip)
      : null;
    const stylesXml = zip.file(STYLES_XML_PATH)
      ? await readXmlPart(file, STYLES_XML_PATH, zip)
      : null;
    const numberingXml = zip.file(NUMBERING_XML_PATH)
      ? await readXmlPart(file, NUMBERING_XML_PATH, zip)
      : null;
    const themeXml = await readThemeXmlPart(file, zip);
    const headerFooterXmlParts = await readHeaderFooterXmlParts(file, zip);

    return {
      documentXml,
      documentRelationshipsXml,
      stylesXml,
      numberingXml,
      themeXml,
      headerFooterXmlParts,
    };
  } catch (error) {
    throw createDocxPackageReadError(error);
  }
}

function assertSafeDocxPackage(zip: JSZip): void {
  const packageFiles = Object.values(zip.files).filter((entry) => !entry.dir);

  if (packageFiles.length > DOCX_PACKAGE_LIMITS.maxPartCount) {
    throw new DocxPackageError(
      "DOCX_EXCESSIVE_PART_COUNT",
      `DOCX paketinde cok fazla parca var (${packageFiles.length}).`,
    );
  }

  let totalUncompressedSizeBytes = 0;

  for (const entry of packageFiles) {
    const uncompressedSize = getUncompressedEntrySize(entry);

    if (uncompressedSize > DOCX_PACKAGE_LIMITS.maxPartSizeBytes) {
      throw new DocxPackageError(
        "DOCX_EXCESSIVE_PART_SIZE",
        `${entry.name} parcasi guvenli sinirdan buyuk.`,
      );
    }

    totalUncompressedSizeBytes += uncompressedSize;

    if (totalUncompressedSizeBytes > DOCX_PACKAGE_LIMITS.maxTotalUncompressedSizeBytes) {
      throw new DocxPackageError(
        "DOCX_EXCESSIVE_TOTAL_SIZE",
        "DOCX paketinin acilmis boyutu guvenli siniri asiyor.",
      );
    }
  }
}

function getUncompressedEntrySize(entry: JSZip.JSZipObject): number {
  const size = (entry as ZipObjectWithSizeMetadata)._data?.uncompressedSize;

  if (!Number.isFinite(size)) {
    throw new DocxPackageError(
      "DOCX_MALFORMED_PACKAGE",
      `${entry.name} parcasi boyut bilgisi okunamadi.`,
    );
  }

  return size;
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
    throw new DocxPackageError("DOCX_MISSING_DOCUMENT_XML", `${partPath} okunamadi.`);
  }

  const xmlContent = await xmlFile.async("text");
  const xmlDocument = new DOMParser().parseFromString(xmlContent, "application/xml");

  if (xmlDocument.querySelector("parsererror")) {
    throw new DocxPackageError(
      "DOCX_INVALID_XML",
      `${file.name} icindeki ${partPath} gecerli XML degil.`,
    );
  }

  return xmlContent;
}

function createDocxPackageReadError(error: unknown): DocxPackageError {
  if (error instanceof DocxPackageError) {
    return error;
  }

  if (error instanceof Error) {
    return new DocxPackageError(
      "DOCX_MALFORMED_PACKAGE",
      `DOCX paketi okunamadi: ${error.message}`,
      { cause: error },
    );
  }

  return new DocxPackageError(
    "DOCX_MALFORMED_PACKAGE",
    "DOCX paketi okunamadi: Bilinmeyen bir hata olustu.",
  );
}
