import type {
  HeaderFooterLocation,
  HeaderFooterReferenceType,
  PageNumberField,
  PageNumberHeaderFooterReference,
  PageNumbering,
  ParagraphAlignment,
} from "../types";

const RELATIONSHIPS_NAMESPACE = "http://schemas.openxmlformats.org/package/2006/relationships";

interface RelationshipTarget {
  id: string;
  targetPath: string;
  location: HeaderFooterLocation;
}

export function normalizePageNumberingSemantics(
  pageNumbering: Readonly<PageNumbering>,
  documentRelationshipsXml: string | null,
): PageNumbering {
  const relationships = documentRelationshipsXml
    ? parseHeaderFooterRelationships(documentRelationshipsXml)
    : [];
  const fieldsByPath = groupFieldsBySourcePath(pageNumbering.fields);
  const inheritedReferences = new Map<string, PageNumberHeaderFooterReference>();

  const sections = pageNumbering.sections.map((section) => {
    const explicitReferences = (section.headerFooterReferences ?? []).map((reference) =>
      enrichReference(reference, relationships, fieldsByPath),
    );
    const inherited = createInheritedReferences(explicitReferences, inheritedReferences);
    const references = [...explicitReferences, ...inherited];

    for (const reference of explicitReferences) {
      inheritedReferences.set(referenceKey(reference.location, reference.type), reference);
    }

    return {
      ...section,
      headerFooterReferences: references,
    };
  });

  return {
    ...pageNumbering,
    sections,
  };
}

function parseHeaderFooterRelationships(xml: string): RelationshipTarget[] {
  const xmlDocument = new DOMParser().parseFromString(xml, "application/xml");

  if (xmlDocument.querySelector("parsererror")) {
    throw new Error("word/_rels/document.xml.rels gecerli XML degil.");
  }

  return Array.from(
    xmlDocument.getElementsByTagNameNS(RELATIONSHIPS_NAMESPACE, "Relationship"),
  ).flatMap((relationship) => {
    const id = relationship.getAttribute("Id");
    const type = relationship.getAttribute("Type");
    const target = relationship.getAttribute("Target")?.replaceAll("\\", "/") ?? null;
    const targetMode = relationship.getAttribute("TargetMode")?.toLowerCase();
    const location = type?.endsWith("/header")
      ? "header"
      : type?.endsWith("/footer")
        ? "footer"
        : null;

    if (!id || !target || !location || targetMode === "external") {
      return [];
    }

    const targetPath = resolveWordPartTarget(target);

    return targetPath ? [{ id, targetPath, location }] : [];
  });
}

function resolveWordPartTarget(target: string): string | null {
  const segments = target.startsWith("/") ? [] : ["word"];

  for (const segment of target.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (segments.length === 0) {
        return null;
      }

      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  const resolved = segments.join("/");

  return resolved.startsWith("word/") ? resolved : null;
}

function groupFieldsBySourcePath(
  fields: readonly PageNumberField[],
): ReadonlyMap<string, PageNumberField[]> {
  const fieldsByPath = new Map<string, PageNumberField[]>();

  for (const field of fields) {
    fieldsByPath.set(field.sourcePath, [
      ...(fieldsByPath.get(field.sourcePath) ?? []),
      field,
    ]);
  }

  return fieldsByPath;
}

function enrichReference(
  reference: Readonly<PageNumberHeaderFooterReference>,
  relationships: readonly RelationshipTarget[],
  fieldsByPath: ReadonlyMap<string, readonly PageNumberField[]>,
): PageNumberHeaderFooterReference {
  const relationship = relationships.find(
    (item) => item.id === reference.relationshipId && item.location === reference.location,
  );
  const targetPath = relationship?.targetPath ?? null;
  const fields = targetPath ? fieldsByPath.get(targetPath) ?? [] : [];

  return {
    ...reference,
    targetPath,
    resolution: targetPath ? reference.resolution : "unresolved",
    hasPageField: fields.length > 0,
    pageFieldCount: fields.length,
    alignments: collectAlignments(fields),
  };
}

function createInheritedReferences(
  explicitReferences: readonly PageNumberHeaderFooterReference[],
  inheritedReferences: ReadonlyMap<string, PageNumberHeaderFooterReference>,
): PageNumberHeaderFooterReference[] {
  const explicitKeys = new Set(
    explicitReferences.map((reference) => referenceKey(reference.location, reference.type)),
  );
  const inherited: PageNumberHeaderFooterReference[] = [];

  for (const reference of inheritedReferences.values()) {
    const key = referenceKey(reference.location, reference.type);

    if (!explicitKeys.has(key)) {
      inherited.push({
        ...reference,
        resolution: reference.targetPath ? "inherited" : "unresolved",
      });
    }
  }

  return inherited;
}

function collectAlignments(
  fields: readonly PageNumberField[],
): ParagraphAlignment[] {
  return [
    ...new Set(
      fields
        .map((field) => field.alignment)
        .filter((alignment): alignment is ParagraphAlignment => alignment !== null),
    ),
  ];
}

function referenceKey(
  location: HeaderFooterLocation,
  type: HeaderFooterReferenceType,
): string {
  return `${location}:${type}`;
}
