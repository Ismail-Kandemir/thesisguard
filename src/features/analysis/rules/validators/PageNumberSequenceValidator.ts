import type {
  AcademicSectionOccurrence,
  NormalizedDocument,
  PageNumberFormat,
  PageNumberFirstPageExpected,
  PageNumberPlacementExpected,
  PageNumberSection,
  PageNumberSequenceRuleExpected,
  RuleDefinition,
  RuleEvidence,
  RuleResult,
  RuleResultStatus,
} from "../../types";
import { findAcademicSectionOccurrencesByNames } from "../academicSectionLookup";
import {
  createAcademicSectionEvidence,
  createDocumentFormatEvidence,
  MAX_RULE_EVIDENCE_ITEMS,
} from "../ruleEvidence";
import type { RuleValidator } from "./RuleValidator";

export class PageNumberSequenceValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertPageNumberSequenceRule(rule);
    const expected = getExpected(rule.expected);
    const names = [expected.transitionSection, ...(expected.aliases ?? [])];
    const occurrences = findAcademicSectionOccurrencesByNames(
      document,
      [rule],
      names,
    ).filter((occurrence) => occurrence.status === "declared");

    if (occurrences.length === 0) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadı",
        `${expected.transitionSection} bölümü bulunmadığı için sayfa numarası geçişi kontrol edilmedi.`,
      );
    }

    if (occurrences.length > 1) {
      return createResult(
        rule,
        expected,
        "FAILED",
        "Geçiş bölümü birden fazla kez bulundu",
        `${expected.transitionSection} bölümü birden fazla kez bulunduğu için sayfa numarası geçişi güvenle belirlenemedi.`,
        occurrences.slice(0, MAX_RULE_EVIDENCE_ITEMS).map((occurrence) =>
          createAcademicSectionEvidence(occurrence, {
            actual: "Birden fazla geçiş bölümü bulundu",
            expected: "Tek geçiş bölümü",
            sectionName: occurrence.displayHeadingText,
          }),
        ),
        occurrences.length,
      );
    }

    const sections = resolveEffectiveFormats(document.pageNumbering.sections);

    if (sections.length === 0) {
      return createResult(
        rule,
        expected,
        "FAILED",
        "Bölüm sayfa numarası bilgisi tespit edilemedi",
        "DOCX bölüm özelliklerinde sayfa numarası biçimi tespit edilemedi.",
        [
          createDocumentFormatEvidence("Sayfa numarası bölüm yapılandırması", {
            actual: "Tespit edilmedi",
            expected: "DOCX bölüm sayfa numarası yapılandırması",
          }),
        ],
        1,
      );
    }

    const transitionIndex = findContainingSectionIndex(sections, occurrences[0]);

    if (transitionIndex === -1) {
      return createResult(
        rule,
        expected,
        "FAILED",
        formatActual(sections),
        `${expected.transitionSection} bölümünün sayfa numarası bölümü belirlenemedi.`,
        [
          createDocumentFormatEvidence("Geçiş bölümü sayfa numarası yapılandırması", {
            actual: "Tespit edilemedi",
            expected: `${expected.transitionSection} bölümünü içeren belge bölümü`,
          }),
        ],
        1,
      );
    }

    const beforeStartIndexResult = findBoundarySectionIndex(
      document,
      rule,
      sections,
      expected.beforeStartSection,
      expected.beforeStartAliases,
      "ön faz başlangıcı",
    );

    if (beforeStartIndexResult.status === "failed") {
      return createResult(
        rule,
        expected,
        "FAILED",
        formatActual(sections),
        beforeStartIndexResult.message,
        beforeStartIndexResult.evidence,
        beforeStartIndexResult.evidence.length,
      );
    }

    const beforeStartIndex = beforeStartIndexResult.sectionIndex ?? 0;

    if (beforeStartIndex >= transitionIndex) {
      return createResult(
        rule,
        expected,
        "FAILED",
        formatActual(sections),
        `${expected.beforeStartSection} bölümü ${expected.transitionSection} geçişinden önce bulunmadığı için sayfa numarası fazı güvenle belirlenemedi.`,
        [
          createDocumentFormatEvidence("Sayfa numarası ön faz sınırı", {
            actual: "Geçiş sırası uygun değil",
            expected: `${expected.beforeStartSection} önce, ${expected.transitionSection} sonra`,
          }),
        ],
        1,
      );
    }

    const untilIndexResult = findBoundarySectionIndex(
      document,
      rule,
      sections,
      expected.untilSection,
      expected.untilAliases,
      "faz sınırı",
    );

    if (untilIndexResult.status === "failed") {
      return createResult(
        rule,
        expected,
        "FAILED",
        formatActual(sections),
        untilIndexResult.message,
        untilIndexResult.evidence,
        untilIndexResult.evidence.length,
      );
    }

    const fromEndIndex = untilIndexResult.sectionIndex ?? sections.length;
    const before = sections.slice(beforeStartIndex, transitionIndex);
    const from = sections.slice(transitionIndex, fromEndIndex);
    const transition = from[0];
    const beforeMatches =
      before.length > 0 && before.every((section) => section.effectiveFormat === expected.beforeFormat);
    const fromMatches =
      from.length > 0 && from.every((section) => section.effectiveFormat === expected.fromFormat);
    const restartMatches =
      expected.restartAt === undefined ||
      (hasExplicitStart(transition) &&
        transition.start === expected.restartAt);
    const beforePageNumberCheck = checkPhasePageNumber(
      before,
      expected.beforePageNumber,
      `${expected.transitionSection} öncesi`,
    );
    const fromPageNumberCheck = checkPhasePageNumber(
      from,
      expected.fromPageNumber,
      expected.untilSection
        ? `${expected.transitionSection} - ${expected.untilSection} arası`
        : `${expected.transitionSection} ve sonrası`,
    );
    const beforeFirstPageCheck = checkPhaseFirstPage(
      before,
      expected.beforeFirstPage,
      `${expected.transitionSection} öncesi ilk sayfa`,
    );
    const fromFirstPageCheck = checkPhaseFirstPage(
      from,
      expected.fromFirstPage,
      `${expected.transitionSection} fazı ilk sayfa`,
    );
    const passed =
      beforeMatches &&
      fromMatches &&
      restartMatches &&
      beforePageNumberCheck.passed &&
      fromPageNumberCheck.passed &&
      beforeFirstPageCheck.passed &&
      fromFirstPageCheck.passed;
    const evidence = passed
      ? []
      : createSequenceEvidence(
          expected,
          sections,
          transitionIndex,
          fromEndIndex,
          beforeMatches,
          fromMatches,
          restartMatches,
          [
            ...beforePageNumberCheck.evidence,
            ...fromPageNumberCheck.evidence,
            ...beforeFirstPageCheck.evidence,
            ...fromFirstPageCheck.evidence,
          ],
        );

    return createResult(
      rule,
      expected,
      passed ? "PASSED" : "FAILED",
      formatActual(sections),
      passed
        ? `${rule.title} kuralı başarılı.`
        : createFailureMessage(
            expected,
            beforeMatches,
            fromMatches,
            restartMatches,
            beforePageNumberCheck.passed,
            fromPageNumberCheck.passed,
            beforeFirstPageCheck.passed,
            fromFirstPageCheck.passed,
          ),
      passed ? undefined : evidence.slice(0, MAX_RULE_EVIDENCE_ITEMS),
      passed ? undefined : evidence.length,
    );
  }
}

interface EffectivePageNumberSection extends PageNumberSection {
  effectiveFormat: string | null;
}

function resolveEffectiveFormats(
  sections: readonly PageNumberSection[],
): EffectivePageNumberSection[] {
  let inheritedFormat: string | null = null;

  return sections.map((section) => {
    const effectiveFormat = section.format ?? inheritedFormat;

    if (effectiveFormat !== null) {
      inheritedFormat = effectiveFormat;
    }

    return { ...section, effectiveFormat };
  });
}

function findContainingSectionIndex(
  sections: readonly EffectivePageNumberSection[],
  transitionSection: Readonly<AcademicSectionOccurrence>,
): number {
  return sections.findIndex(
    (section) => section.endParagraphIndex >= transitionSection.headingParagraphIndex,
  );
}

function hasExplicitStart(section: Readonly<PageNumberSection>): boolean {
  return section.startSemantics === "explicit-start" ||
    (section.startSemantics === undefined && section.start !== null);
}

function assertPageNumberSequenceRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "PAGE_NUMBER_SEQUENCE" } {
  if (rule.type !== "PAGE_NUMBER_SEQUENCE") {
    throw new Error(
      "PageNumberSequenceValidator yalnızca PAGE_NUMBER_SEQUENCE tipindeki kuralları çalıştırır.",
    );
  }
}

function getExpected(expected: RuleDefinition["expected"]): PageNumberSequenceRuleExpected {
  if (
    typeof expected !== "object" ||
    expected === null ||
    !("transitionSection" in expected) ||
    typeof expected.transitionSection !== "string" ||
    expected.transitionSection.trim().length === 0 ||
    ("beforeStartSection" in expected &&
      expected.beforeStartSection !== undefined &&
      (typeof expected.beforeStartSection !== "string" ||
        expected.beforeStartSection.trim().length === 0)) ||
    ("untilSection" in expected &&
      expected.untilSection !== undefined &&
      (typeof expected.untilSection !== "string" ||
        expected.untilSection.trim().length === 0)) ||
    !("beforeFormat" in expected) ||
    !isSupportedFormat(expected.beforeFormat) ||
    !("fromFormat" in expected) ||
    !isSupportedFormat(expected.fromFormat) ||
    ("aliases" in expected &&
      (expected.aliases === undefined ||
        !Array.isArray(expected.aliases) ||
        !expected.aliases.every((alias) => typeof alias === "string" && alias.trim().length > 0))) ||
    ("beforeStartAliases" in expected &&
      (expected.beforeStartAliases === undefined ||
        !Array.isArray(expected.beforeStartAliases) ||
        !expected.beforeStartAliases.every((alias) => typeof alias === "string" && alias.trim().length > 0))) ||
    ("untilAliases" in expected &&
      (expected.untilAliases === undefined ||
        !Array.isArray(expected.untilAliases) ||
        !expected.untilAliases.every((alias) => typeof alias === "string" && alias.trim().length > 0))) ||
    ("restartAt" in expected &&
      expected.restartAt !== undefined &&
      (!Number.isInteger(expected.restartAt) || expected.restartAt < 1)) ||
    ("beforePageNumber" in expected &&
      expected.beforePageNumber !== undefined &&
      !isPageNumberPlacementExpected(expected.beforePageNumber)) ||
    ("fromPageNumber" in expected &&
      expected.fromPageNumber !== undefined &&
      !isPageNumberPlacementExpected(expected.fromPageNumber)) ||
    ("beforeFirstPage" in expected &&
      expected.beforeFirstPage !== undefined &&
      !isPageNumberFirstPageExpected(expected.beforeFirstPage)) ||
    ("fromFirstPage" in expected &&
      expected.fromFirstPage !== undefined &&
      !isPageNumberFirstPageExpected(expected.fromFirstPage)) ||
    ("definesMainContentBoundary" in expected &&
      expected.definesMainContentBoundary !== undefined &&
      typeof expected.definesMainContentBoundary !== "boolean")
  ) {
    throw new Error(
      "PAGE_NUMBER_SEQUENCE kuralı geçerli transitionSection, biçimler ve optional restartAt içermelidir.",
    );
  }

  return expected as PageNumberSequenceRuleExpected;
}

function isSupportedFormat(value: unknown): value is PageNumberFormat {
  return value === "decimal" || value === "lowerRoman" || value === "upperRoman";
}

function isPageNumberPlacementExpected(
  value: unknown,
): value is PageNumberPlacementExpected {
  return (
    typeof value === "object" &&
    value !== null &&
    (!("location" in value) ||
      value.location === undefined ||
      value.location === "header" ||
      value.location === "footer") &&
    (!("alignment" in value) ||
      value.alignment === undefined ||
      value.alignment === "left" ||
      value.alignment === "center" ||
      value.alignment === "right")
  );
}

function isPageNumberFirstPageExpected(
  value: unknown,
): value is PageNumberFirstPageExpected {
  return (
    typeof value === "object" &&
    value !== null &&
    "hidden" in value &&
    typeof value.hidden === "boolean"
  );
}

function findBoundarySectionIndex(
  document: Readonly<NormalizedDocument>,
  rule: Readonly<RuleDefinition>,
  sections: readonly EffectivePageNumberSection[],
  sectionName: string | undefined,
  aliases: readonly string[] | undefined,
  label: string,
): { status: "ok"; sectionIndex: number | null } | {
  status: "failed";
  message: string;
  evidence: RuleEvidence[];
} {
  if (!sectionName) {
    return { status: "ok", sectionIndex: null };
  }

  const occurrences = findAcademicSectionOccurrencesByNames(
    document,
    [rule],
    [sectionName, ...(aliases ?? [])],
  ).filter((occurrence) => occurrence.status === "declared");

  if (occurrences.length === 0) {
    return {
      status: "failed",
      message: `${sectionName} bölümü bulunmadığı için sayfa numarası ${label} güvenle belirlenemedi.`,
      evidence: [
        createDocumentFormatEvidence(`Sayfa numarası ${label}`, {
          actual: "Tespit edilmedi",
          expected: sectionName,
        }),
      ],
    };
  }

  if (occurrences.length > 1) {
    return {
      status: "failed",
      message: `${sectionName} bölümü birden fazla kez bulunduğu için sayfa numarası ${label} güvenle belirlenemedi.`,
      evidence: occurrences.slice(0, MAX_RULE_EVIDENCE_ITEMS).map((occurrence) =>
        createAcademicSectionEvidence(occurrence, {
          actual: `Birden fazla ${label} bulundu`,
          expected: `Tek ${label}`,
          sectionName: occurrence.displayHeadingText,
        }),
      ),
    };
  }

  const untilIndex = findContainingSectionIndex(sections, occurrences[0]);

  if (untilIndex === -1) {
    return {
      status: "failed",
      message: `${sectionName} bölümünün sayfa numarası bölümü belirlenemedi.`,
      evidence: [
        createDocumentFormatEvidence(`Sayfa numarası ${label}`, {
          actual: "Tespit edilemedi",
          expected: sectionName,
        }),
      ],
    };
  }

  return { status: "ok", sectionIndex: untilIndex };
}

function createSequenceEvidence(
  expected: PageNumberSequenceRuleExpected,
  sections: readonly EffectivePageNumberSection[],
  transitionIndex: number,
  fromEndIndex: number,
  beforeMatches: boolean,
  fromMatches: boolean,
  restartMatches: boolean,
  phaseEvidence: readonly RuleEvidence[],
): RuleEvidence[] {
  const evidence: RuleEvidence[] = [];

  if (!beforeMatches) {
    const before = sections.slice(0, transitionIndex);

    if (before.length === 0) {
      evidence.push(
        createDocumentFormatEvidence(`${expected.transitionSection} öncesi sayfa numarası biçimi`, {
          actual: "Tespit edilmedi",
          expected: formatName(expected.beforeFormat),
        }),
      );
    } else {
      evidence.push(
        ...before.flatMap((section, index) =>
          section.effectiveFormat === expected.beforeFormat
            ? []
            : [
                createDocumentFormatEvidence("Sayfa numarası biçimi", {
                  actual: formatNullableFormat(section.effectiveFormat),
                  expected: formatName(expected.beforeFormat),
                  sectionIndex: index,
                }),
              ],
        ),
      );
    }
  }

  if (!fromMatches) {
    evidence.push(
      ...sections.slice(transitionIndex, fromEndIndex).flatMap((section, offset) =>
        section.effectiveFormat === expected.fromFormat
          ? []
          : [
              createDocumentFormatEvidence("Sayfa numarası biçimi", {
                actual: formatNullableFormat(section.effectiveFormat),
                expected: formatName(expected.fromFormat),
                sectionIndex: transitionIndex + offset,
              }),
            ],
      ),
    );
  }

  if (!restartMatches && expected.restartAt !== undefined) {
    evidence.push(
      createDocumentFormatEvidence("Sayfa numarası başlangıcı", {
        actual: sections[transitionIndex].start ?? "Tespit edilmedi",
        expected: expected.restartAt,
        sectionIndex: transitionIndex,
      }),
    );
  }

  evidence.push(...phaseEvidence);

  return evidence;
}

interface PhaseCheck {
  passed: boolean;
  evidence: RuleEvidence[];
}

function checkPhasePageNumber(
  sections: readonly EffectivePageNumberSection[],
  expected: Readonly<PageNumberPlacementExpected> | undefined,
  label: string,
): PhaseCheck {
  if (!expected) {
    return { passed: true, evidence: [] };
  }

  if (sections.length === 0) {
    return {
      passed: false,
      evidence: [
        createDocumentFormatEvidence(`${label} sayfa numarası`, {
          actual: "Tespit edilmedi",
          expected: formatPageNumberPlacement(expected),
        }),
      ],
    };
  }

  const evidence = sections.flatMap((section, index) =>
    sectionMatchesPageNumberPlacement(section, expected)
      ? []
      : [
          createDocumentFormatEvidence(`${label} sayfa numarası`, {
            actual: formatSectionPageNumberPlacement(section),
            expected: formatPageNumberPlacement(expected),
            sectionIndex: section.index ?? index,
          }),
        ],
  );

  return { passed: evidence.length === 0, evidence };
}

function sectionMatchesPageNumberPlacement(
  section: Readonly<EffectivePageNumberSection>,
  expected: Readonly<PageNumberPlacementExpected>,
): boolean {
  const references = (section.headerFooterReferences ?? []).filter((reference) =>
    reference.hasPageField &&
    (expected.location === undefined || reference.location === expected.location),
  );

  if (references.length === 0) {
    return false;
  }

  if (!expected.alignment) {
    return true;
  }

  return references.some((reference) =>
    reference.alignments.includes(expected.alignment),
  );
}

function checkPhaseFirstPage(
  sections: readonly EffectivePageNumberSection[],
  expected: Readonly<PageNumberFirstPageExpected> | undefined,
  label: string,
): PhaseCheck {
  if (!expected) {
    return { passed: true, evidence: [] };
  }

  const firstSection = sections[0];

  if (!firstSection) {
    return {
      passed: false,
      evidence: [
        createDocumentFormatEvidence(label, {
          actual: "Tespit edilmedi",
          expected: formatFirstPageExpectation(expected),
        }),
      ],
    };
  }

  const firstPageReferences = (firstSection.headerFooterReferences ?? []).filter(
    (reference) => reference.type === "first",
  );
  const hasFirstPageNumber = firstPageReferences.some((reference) =>
    reference.hasPageField,
  );
  const hidden = firstSection.differentFirstPage === true && !hasFirstPageNumber;
  const passed = expected.hidden ? hidden : !hidden;

  return {
    passed,
    evidence: passed
      ? []
      : [
          createDocumentFormatEvidence(label, {
            actual: hidden ? "İlk sayfa numarası gizli" : "İlk sayfa numarası gizli değil veya kanıtlanamadı",
            expected: formatFirstPageExpectation(expected),
            sectionIndex: firstSection.index,
          }),
        ],
  };
}

function createResult(
  rule: RuleDefinition,
  expected: PageNumberSequenceRuleExpected,
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
    expected: formatExpected(expected),
    actual,
    message,
    ...(evidence && evidence.length > 0 ? { evidence } : {}),
    ...(evidenceTotal !== undefined ? { evidenceTotal } : {}),
  };
}

function formatExpected(expected: PageNumberSequenceRuleExpected): string {
  const until = expected.untilSection ? ` - ${expected.untilSection}` : "";
  const restart = expected.restartAt === undefined ? "" : `, başlangıç ${expected.restartAt}`;
  const placement = [
    expected.beforePageNumber
      ? `ön faz ${formatPageNumberPlacement(expected.beforePageNumber)}`
      : "",
    expected.fromPageNumber
      ? `geçiş fazı ${formatPageNumberPlacement(expected.fromPageNumber)}`
      : "",
    expected.beforeFirstPage
      ? `ön faz ilk sayfa ${formatFirstPageExpectation(expected.beforeFirstPage)}`
      : "",
    expected.fromFirstPage
      ? `geçiş fazı ilk sayfa ${formatFirstPageExpectation(expected.fromFirstPage)}`
      : "",
  ].filter(Boolean).join(", ");

  return `${formatName(expected.beforeFormat)} → ${expected.transitionSection}${until}: ${formatName(expected.fromFormat)}${restart}${placement ? `, ${placement}` : ""}`;
}

function formatActual(sections: readonly EffectivePageNumberSection[]): string {
  return sections
    .map(
      (section, index) =>
        `Bölüm ${index + 1}: ${section.effectiveFormat ? formatName(section.effectiveFormat) : "Tespit edilemedi"}${section.start === null ? "" : `, başlangıç ${section.start}`}`,
    )
    .join("; ");
}

function formatName(format: string): string {
  switch (format) {
    case "lowerRoman":
      return "Küçük Romen";
    case "upperRoman":
      return "Büyük Romen";
    case "decimal":
      return "Arap rakamı";
    default:
      return format;
  }
}

function formatNullableFormat(format: string | null): string {
  return format === null ? "Tespit edilemedi" : formatName(format);
}

function createFailureMessage(
  expected: PageNumberSequenceRuleExpected,
  beforeMatches: boolean,
  fromMatches: boolean,
  restartMatches: boolean,
  beforePageNumberMatches: boolean,
  fromPageNumberMatches: boolean,
  beforeFirstPageMatches: boolean,
  fromFirstPageMatches: boolean,
): string {
  const problems: string[] = [];

  if (!beforeMatches) {
    problems.push(`${expected.transitionSection} öncesi ${formatName(expected.beforeFormat)} olmalı`);
  }

  if (!fromMatches) {
    problems.push(`${expected.transitionSection} ve sonrası ${formatName(expected.fromFormat)} olmalı`);
  }

  if (!restartMatches && expected.restartAt !== undefined) {
    problems.push(`${expected.transitionSection} ${expected.restartAt} ile başlamalı`);
  }

  if (!beforePageNumberMatches && expected.beforePageNumber) {
    problems.push(`${expected.transitionSection} öncesi sayfa numarası ${formatPageNumberPlacement(expected.beforePageNumber)} olmalı`);
  }

  if (!fromPageNumberMatches && expected.fromPageNumber) {
    const phaseName = expected.untilSection
      ? `${expected.transitionSection} - ${expected.untilSection} arası`
      : `${expected.transitionSection} ve sonrası`;
    problems.push(`${phaseName} sayfa numarası ${formatPageNumberPlacement(expected.fromPageNumber)} olmalı`);
  }

  if (!beforeFirstPageMatches && expected.beforeFirstPage) {
    problems.push(`${expected.transitionSection} öncesi ilk sayfa ${formatFirstPageExpectation(expected.beforeFirstPage)} olmalı`);
  }

  if (!fromFirstPageMatches && expected.fromFirstPage) {
    problems.push(`${expected.transitionSection} fazı ilk sayfa ${formatFirstPageExpectation(expected.fromFirstPage)} olmalı`);
  }

  return `Sayfa numarası sırası uygun değil: ${problems.join("; ")}.`;
}

function formatPageNumberPlacement(expected: Readonly<PageNumberPlacementExpected>): string {
  const values: string[] = [];

  if (expected.location) {
    values.push(formatLocation(expected.location));
  }

  if (expected.alignment) {
    values.push(formatAlignment(expected.alignment));
  }

  return values.length > 0 ? values.join(" / ") : "PAGE alanı";
}

function formatSectionPageNumberPlacement(
  section: Readonly<EffectivePageNumberSection>,
): string {
  const references = section.headerFooterReferences ?? [];
  const pageReferences = references.filter((reference) => reference.hasPageField);

  if (pageReferences.length === 0) {
    return "PAGE alanı tespit edilmedi";
  }

  return pageReferences.map((reference) => {
    const alignments = reference.alignments.length > 0
      ? reference.alignments.map(formatAlignment).join(", ")
      : "Hizalama tespit edilemedi";

    return `${formatLocation(reference.location)} / ${alignments}`;
  }).join("; ");
}

function formatLocation(location: "header" | "footer"): string {
  return location === "header" ? "Üst bilgi" : "Alt bilgi";
}

function formatAlignment(alignment: "left" | "center" | "right"): string {
  switch (alignment) {
    case "left":
      return "Sol";
    case "center":
      return "Orta";
    case "right":
      return "Sağ";
  }
}

function formatFirstPageExpectation(
  expected: Readonly<PageNumberFirstPageExpected>,
): string {
  return expected.hidden
    ? "numara görünmez"
    : "numara görünür";
}
