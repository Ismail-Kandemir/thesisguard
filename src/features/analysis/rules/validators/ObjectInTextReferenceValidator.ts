import type {
  CaptionKind,
  DocumentCaption,
  DocumentFigureOccurrence,
  DocumentTableOccurrence,
  NormalizedDocument,
  ObjectInTextReferenceRuleExpected,
  RuleDefinition,
  RuleEvidence,
  RuleResult,
  RuleResultStatus,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";
import { createObjectEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";

interface ObjectIdentity {
  caption: DocumentCaption;
  kind: CaptionKind;
  number: string;
  occurrence: DocumentTableOccurrence | DocumentFigureOccurrence;
}

export class ObjectInTextReferenceValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertRule(rule);
    const expected = getExpected(rule.expected);
    const identities = getReliableObjectIdentities(document, expected.object);

    if (identities.length === 0) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadı",
        `${objectName(expected.object)} bulunmadığı veya güvenilir başlığı tespit edilemediği için metin içi atıf kontrolü uygulanmadı.`,
      );
    }

    const duplicateNumbers = findDuplicateNumbers(identities);

    if (duplicateNumbers.length > 0) {
      return createResult(
        rule,
        expected,
        "FAILED",
        `Belirsiz nesne numaraları: ${formatIdentities(expected.object, duplicateNumbers)}`,
        `${objectName(expected.object)} numaraları birden fazla nesnede kullanıldığı için metin içi atıf kapsamı güvenilir biçimde belirlenemedi: ${formatIdentities(expected.object, duplicateNumbers)}.`,
        identities
          .filter((identity) => duplicateNumbers.includes(identity.number))
          .slice(0, MAX_RULE_EVIDENCE_ITEMS)
          .map((identity) => createReferenceObjectEvidence(expected.object, identity, {
            actual: "Numara birden fazla nesnede kullanıldı",
            expected: "Benzersiz nesne numarası",
          })),
        identities.filter((identity) => duplicateNumbers.includes(identity.number)).length,
      );
    }

    const referencedNumbers = new Set(
      document.objectReferences.items
        .filter((reference) => reference.kind === expected.object)
        .map((reference) => reference.number),
    );
    const missing = identities.filter((identity) => !referencedNumbers.has(identity.number));

    if (missing.length > 0) {
      return createResult(
        rule,
        expected,
        "FAILED",
        `Atıf bulunamayanlar: ${formatIdentities(expected.object, missing.map((item) => item.number))}`,
        `Bazı ${expected.object === "table" ? "tablolar" : "şekiller"} için metin içi atıf bulunamadı: ${formatIdentities(expected.object, missing.map((item) => item.number))}.`,
        missing.slice(0, MAX_RULE_EVIDENCE_ITEMS).map((identity) =>
          createReferenceObjectEvidence(expected.object, identity, {
            actual: "Atıf tespit edilmedi",
            expected: "Metin içinde en az bir atıf",
          }),
        ),
        missing.length,
      );
    }

    return createResult(
      rule,
      expected,
      "PASSED",
      `${identities.length} nesnenin tamamı için atıf bulundu`,
      `Belgedeki tüm ${expected.object === "table" ? "tablolar" : "şekiller"} için metin içi atıf bulundu.`,
    );
  }
}

function getReliableObjectIdentities(
  document: Readonly<NormalizedDocument>,
  object: CaptionKind,
): ObjectIdentity[] {
  const captionsById = new Map(document.captions.items.map((caption) => [caption.id, caption]));
  const occurrences = object === "table"
    ? document.tables.items.filter((item) => !item.isNested && item.captionId !== null)
    : document.figures.items.filter(
        (item) => item.drawingType === "inline" && item.captionId !== null,
      );

  return occurrences.flatMap((occurrence) => {
    const caption = occurrence.captionId
      ? captionsById.get(occurrence.captionId)
      : undefined;

    return caption && caption.kind === object
      ? [toIdentity(caption, occurrence)]
      : [];
  });
}

function toIdentity(
  caption: DocumentCaption,
  occurrence: DocumentTableOccurrence | DocumentFigureOccurrence,
): ObjectIdentity {
  return { caption, kind: caption.kind, number: caption.number, occurrence };
}

function findDuplicateNumbers(identities: readonly ObjectIdentity[]): string[] {
  const counts = new Map<string, number>();

  for (const identity of identities) {
    counts.set(identity.number, (counts.get(identity.number) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([number]) => number);
}

function assertRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "OBJECT_IN_TEXT_REFERENCE" } {
  if (rule.type !== "OBJECT_IN_TEXT_REFERENCE") {
    throw new Error("ObjectInTextReferenceValidator yalnızca OBJECT_IN_TEXT_REFERENCE kurallarını çalıştırır.");
  }
}

function getExpected(expected: RuleDefinition["expected"]): ObjectInTextReferenceRuleExpected {
  if (
    typeof expected !== "object" ||
    expected === null ||
    !("object" in expected) ||
    (expected.object !== "table" && expected.object !== "figure")
  ) {
    throw new Error("OBJECT_IN_TEXT_REFERENCE kuralı geçerli bir object değeri içermelidir.");
  }

  return expected as ObjectInTextReferenceRuleExpected;
}

function createResult(
  rule: RuleDefinition,
  expected: ObjectInTextReferenceRuleExpected,
  status: RuleResultStatus,
  actual: string,
  message: string,
  evidence?: RuleEvidence[],
  evidenceTotal?: number,
): RuleResult {
  return {
    ruleId: rule.id,
    ruleName: rule.title,
    status,
    passed: status === "PASSED",
    severity: rule.severity,
    expected: `Her ${objectName(expected.object).toLocaleLowerCase("tr-TR")} için en az bir metin içi atıf`,
    actual,
    message,
    ...(evidence && evidence.length > 0 ? { evidence } : {}),
    ...(evidenceTotal !== undefined ? { evidenceTotal } : {}),
  };
}

function createReferenceObjectEvidence(
  object: CaptionKind,
  identity: Readonly<ObjectIdentity>,
  values: Readonly<{
    actual: string;
    expected: string;
  }>,
): RuleEvidence {
  return createObjectEvidence(object, identity.occurrence, {
    actual: values.actual,
    captionId: identity.caption.id,
    captionNumber: identity.caption.number,
    captionText: identity.caption.text,
    expected: values.expected,
    objectLabel: `${objectName(object)} ${identity.number}`,
  });
}

function formatIdentities(object: CaptionKind, numbers: readonly string[]): string {
  return numbers.map((number) => `${objectName(object)} ${number}`).join(", ");
}

function objectName(object: CaptionKind): "Tablo" | "Şekil" {
  return object === "table" ? "Tablo" : "Şekil";
}
