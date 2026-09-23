import type {
  HeaderFooterLocation,
  NormalizedDocument,
  PageNumberHeaderFooterReference,
  PageNumberField,
  PageNumberRuleExpected,
  ParagraphAlignment,
  RuleDefinition,
  RuleEvidence,
  RuleResult,
} from "../../types";
import { createDocumentFormatEvidence } from "../ruleEvidence";
import type { RuleValidator } from "./RuleValidator";

type PageNumberAlignment = Exclude<ParagraphAlignment, "justify">;

export class PageNumberValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertPageNumberRule(rule);
    const expected = getPageNumberExpected(rule.expected);
    const referencedPageFields = getReferencedPageFieldEvidence(document);
    const fields = referencedPageFields.length > 0 || hasSectionReferences(document)
      ? referencedPageFields
      : document.pageNumbering.fields;

    if (fields.length === 0) {
      return createResult(
        rule,
        expected,
        !expected.required,
        null,
        expected.required
          ? "Sayfa numarası tespit edilemedi."
          : `${rule.title} kuralı başarılı.`,
        expected.required
          ? [
              createDocumentFormatEvidence("Sayfa numarası alanı", {
                actual: "Tespit edilmedi",
                expected: "PAGE alanı bulunmalı",
              }),
            ]
          : undefined,
        expected.required ? 1 : undefined,
      );
    }

    const fieldsAtExpectedLocation = expected.location
      ? fields.filter((field) => field.location === expected.location)
      : fields;

    if (fieldsAtExpectedLocation.length === 0 && expected.location) {
      return createResult(
        rule,
        expected,
        false,
        formatActualFields(fields),
        `Sayfa numarası uygun konumda değil. Beklenen: ${formatLocation(expected.location)}, Bulunan: ${formatLocations(fields)}.`,
        [
          createDocumentFormatEvidence("Sayfa numarası konumu", {
            actual: formatLocations(fields),
            expected: formatLocation(expected.location),
          }),
        ],
        1,
      );
    }

    if (expected.alignment) {
      const matchingField = fieldsAtExpectedLocation.find((field) =>
        field.alignment === expected.alignment,
      );

      if (!matchingField) {
        const detectedAlignments = fieldsAtExpectedLocation
          .map((field) => field.alignment)
          .filter(isPageNumberAlignment);
        const message =
          detectedAlignments.length === 0
            ? `Sayfa numarası hizalaması tespit edilemedi. Beklenen: ${formatAlignment(expected.alignment)}.`
            : `Sayfa numarası uygun hizalamada değil. Beklenen: ${formatAlignment(expected.alignment)}, Bulunan: ${formatAlignments(detectedAlignments)}.`;

        return createResult(
          rule,
          expected,
          false,
          formatActualFields(fieldsAtExpectedLocation),
          message,
          [
            createDocumentFormatEvidence("Sayfa numarası hizalaması", {
              actual: detectedAlignments.length === 0
                ? "Tespit edilemedi"
                : formatAlignments(detectedAlignments),
              expected: formatAlignment(expected.alignment),
            }),
          ],
          1,
        );
      }
    }

    return createResult(
      rule,
      expected,
      true,
      formatActualFields(fields),
      `${rule.title} kuralı başarılı.`,
    );
  }
}

function assertPageNumberRule(rule: RuleDefinition): asserts rule is RuleDefinition & {
  type: "PAGE_NUMBER";
} {
  if (rule.type !== "PAGE_NUMBER") {
    throw new Error("PageNumberValidator yalnızca PAGE_NUMBER tipindeki kuralları çalıştırır.");
  }
}

function getPageNumberExpected(expected: RuleDefinition["expected"]): PageNumberRuleExpected {
  if (
    typeof expected !== "object" ||
    !("required" in expected) ||
    typeof expected.required !== "boolean" ||
    (expected.location !== undefined && !isHeaderFooterLocation(expected.location)) ||
    (expected.alignment !== undefined && !isPageNumberAlignment(expected.alignment))
  ) {
    throw new Error("PAGE_NUMBER kuralı geçerli bir expected değeri içermelidir.");
  }

  return expected;
}

function isHeaderFooterLocation(value: unknown): value is HeaderFooterLocation {
  return value === "header" || value === "footer";
}

function isPageNumberAlignment(value: unknown): value is PageNumberAlignment {
  return value === "left" || value === "center" || value === "right";
}

function hasSectionReferences(document: Readonly<NormalizedDocument>): boolean {
  return document.pageNumbering.sections.some(
    (section) => (section.headerFooterReferences ?? []).length > 0,
  );
}

function getReferencedPageFieldEvidence(
  document: Readonly<NormalizedDocument>,
): PageNumberField[] {
  const fields: PageNumberField[] = [];

  for (const section of document.pageNumbering.sections) {
    for (const reference of section.headerFooterReferences ?? []) {
      if (!reference.hasPageField) {
        continue;
      }

      fields.push(...referenceToFields(reference));
    }
  }

  return fields;
}

function referenceToFields(
  reference: Readonly<PageNumberHeaderFooterReference>,
): PageNumberField[] {
  const alignments = reference.alignments.length > 0 ? reference.alignments : [null];
  const count = Math.max(reference.pageFieldCount, 1);
  const fields: PageNumberField[] = [];

  for (let index = 0; index < count; index += 1) {
    fields.push({
      sourcePath: reference.targetPath ?? "unresolved",
      location: reference.location,
      alignment: alignments[Math.min(index, alignments.length - 1)] ?? null,
      fieldType: "PAGE",
      structure: "instrText",
    });
  }

  return fields;
}

function createResult(
  rule: RuleDefinition,
  expected: PageNumberRuleExpected,
  passed: boolean,
  actual: string | null,
  message: string,
  evidence?: RuleEvidence[],
  evidenceTotal?: number,
): RuleResult {
  return {
    ruleId: rule.id,
    ruleName: rule.title,
    status: passed ? "PASSED" : "FAILED",
    passed,
    severity: rule.severity,
    expected: formatExpected(expected),
    actual,
    message,
    ...(evidence && evidence.length > 0 ? { evidence } : {}),
    ...(evidenceTotal !== undefined ? { evidenceTotal } : {}),
  };
}

function formatExpected(expected: PageNumberRuleExpected): string {
  const values = [`Zorunlu: ${expected.required ? "Evet" : "Hayır"}`];

  if (expected.location) {
    values.push(`Konum: ${formatLocation(expected.location)}`);
  }

  if (expected.alignment) {
    values.push(`Hizalama: ${formatAlignment(expected.alignment)}`);
  }

  return values.join(", ");
}

function formatActualFields(fields: PageNumberField[]): string {
  return fields
    .map(
      (field) =>
        `${formatLocation(field.location)} / ${field.alignment ? formatAlignment(field.alignment) : "Hizalama tespit edilemedi"}`,
    )
    .join(", ");
}

function formatLocations(fields: PageNumberField[]): string {
  return Array.from(new Set(fields.map((field) => formatLocation(field.location)))).join(
    ", ",
  );
}

function formatAlignments(alignments: PageNumberAlignment[]): string {
  return Array.from(new Set(alignments.map(formatAlignment))).join(", ");
}

function formatLocation(location: HeaderFooterLocation): string {
  return location === "header" ? "Üst bilgi" : "Alt bilgi";
}

function formatAlignment(alignment: PageNumberAlignment): string {
  switch (alignment) {
    case "left":
      return "Sol";
    case "center":
      return "Orta";
    case "right":
      return "Sağ";
  }
}
