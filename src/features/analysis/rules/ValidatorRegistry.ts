import type { RuleDefinition, RuleExpectedValue, RuleType } from "../types";
import type { RuleValidator } from "./validators/RuleValidator";
import { AbbreviationListConsistencyValidator } from "./validators/AbbreviationListConsistencyValidator";
import { AlignmentValidator } from "./validators/AlignmentValidator";
import { BibliographyReferencesValidator } from "./validators/BibliographyReferencesValidator";
import { ConditionalRequiredSectionValidator } from "./validators/ConditionalRequiredSectionValidator";
import { FontFamilyValidator } from "./validators/FontFamilyValidator";
import { FontSizeValidator } from "./validators/FontSizeValidator";
import { HeadingAlignmentValidator } from "./validators/HeadingAlignmentValidator";
import { HeadingLevelFormatValidator } from "./validators/HeadingLevelFormatValidator";
import { HeadingNumberingValidator } from "./validators/HeadingNumberingValidator";
import { HeadingValidator } from "./validators/HeadingValidator";
import { LineSpacingValidator } from "./validators/LineSpacingValidator";
import { MarginValidator } from "./validators/MarginValidator";
import { ObjectAlignmentValidator } from "./validators/ObjectAlignmentValidator";
import { ObjectCaptionFormatValidator } from "./validators/ObjectCaptionFormatValidator";
import { ObjectCaptionPlacementValidator } from "./validators/ObjectCaptionPlacementValidator";
import { ObjectInTextReferenceValidator } from "./validators/ObjectInTextReferenceValidator";
import { PageNumberSequenceValidator } from "./validators/PageNumberSequenceValidator";
import { PageNumberValidator } from "./validators/PageNumberValidator";
import { ParagraphIndentationValidator } from "./validators/ParagraphIndentationValidator";
import { RequiredSectionValidator } from "./validators/RequiredSectionValidator";
import { SectionKeywordsValidator } from "./validators/SectionKeywordsValidator";
import { SectionOrderValidator } from "./validators/SectionOrderValidator";
import { SectionWordCountValidator } from "./validators/SectionWordCountValidator";

const BIBLIOGRAPHY_SECTION_NAME = "kaynaklar";

const DEFAULT_VALIDATOR_ENTRIES = [
  ["ABBREVIATION_LIST_CONSISTENCY", new AbbreviationListConsistencyValidator()],
  ["ALIGNMENT", new AlignmentValidator()],
  ["CONDITIONAL_REQUIRED_SECTION", new ConditionalRequiredSectionValidator()],
  ["FONT_FAMILY", new FontFamilyValidator()],
  ["FONT_SIZE", new FontSizeValidator()],
  ["HEADING", new HeadingValidator()],
  ["HEADING_ALIGNMENT", new HeadingAlignmentValidator()],
  ["HEADING_LEVEL_FORMAT", new HeadingLevelFormatValidator()],
  ["HEADING_NUMBERING", new HeadingNumberingValidator()],
  ["LINE_SPACING", new LineSpacingValidator()],
  ["MARGIN_BOTTOM", new MarginValidator("bottom")],
  ["MARGIN_LEFT", new MarginValidator("left")],
  ["MARGIN_RIGHT", new MarginValidator("right")],
  ["MARGIN_TOP", new MarginValidator("top")],
  ["OBJECT_ALIGNMENT", new ObjectAlignmentValidator()],
  ["OBJECT_CAPTION_FORMAT", new ObjectCaptionFormatValidator()],
  ["OBJECT_CAPTION_PLACEMENT", new ObjectCaptionPlacementValidator()],
  ["OBJECT_IN_TEXT_REFERENCE", new ObjectInTextReferenceValidator()],
  ["PAGE_NUMBER", new PageNumberValidator()],
  ["PAGE_NUMBER_SEQUENCE", new PageNumberSequenceValidator()],
  ["PARAGRAPH_INDENTATION", new ParagraphIndentationValidator()],
  ["REQUIRED_SECTION", new RequiredSectionValidator()],
  ["SECTION_KEYWORDS", new SectionKeywordsValidator()],
  ["SECTION_ORDER", new SectionOrderValidator()],
  ["SECTION_WORD_COUNT", new SectionWordCountValidator()],
] as const satisfies readonly (readonly [RuleType, RuleValidator])[];

const SUPPORTED_RULE_TYPES = new Set<RuleType>(
  DEFAULT_VALIDATOR_ENTRIES.map(([ruleType]) => ruleType),
);

export class ValidatorRegistry {
  private readonly validators = new Map<RuleType, RuleValidator>();
  private readonly bibliographyReferencesValidator =
    new BibliographyReferencesValidator();

  constructor(
    entries: readonly (readonly [RuleType, RuleValidator])[] =
      DEFAULT_VALIDATOR_ENTRIES,
  ) {
    for (const [ruleType, validator] of entries) {
      this.register(ruleType, validator);
    }
  }

  register(ruleType: RuleType, validator: RuleValidator): void {
    if (!isSupportedRuleType(ruleType)) {
      throw new Error(`Unsupported rule type registration: ${ruleType}.`);
    }

    if (this.validators.has(ruleType)) {
      throw new Error(`Duplicate validator registration: ${ruleType}.`);
    }

    this.validators.set(ruleType, validator);
  }

  getValidator(rule: RuleDefinition): RuleValidator | undefined {
    const ruleType = resolveRuleType(rule);

    if (!ruleType) {
      return undefined;
    }

    if (
      ruleType === "REQUIRED_SECTION" &&
      isBibliographyReferencesRule(rule)
    ) {
      return this.bibliographyReferencesValidator;
    }

    return this.validators.get(ruleType);
  }

  getRegisteredRuleTypeCount(): number {
    return this.validators.size;
  }
}

function resolveRuleType(rule: Readonly<RuleDefinition>): RuleType | null {
  if (rule.type) {
    return isSupportedRuleType(rule.type) ? rule.type : null;
  }

  return resolveLegacyRuleType(rule);
}

function resolveLegacyRuleType(rule: Readonly<RuleDefinition>): RuleType | null {
  if (rule.category === "typography") {
    if (isPointExpected(rule.expected)) {
      return "FONT_SIZE";
    }

    return "FONT_FAMILY";
  }

  if (rule.category === "spacing") {
    return "LINE_SPACING";
  }

  if (rule.category === "format" && isAlignmentExpected(rule.expected)) {
    return "ALIGNMENT";
  }

  if (rule.category === "margin") {
    return resolveLegacyMarginRuleType(rule.id);
  }

  return null;
}

function resolveLegacyMarginRuleType(ruleId: string): RuleType | null {
  if (ruleId.endsWith(".margin.left")) {
    return "MARGIN_LEFT";
  }

  if (ruleId.endsWith(".margin.right")) {
    return "MARGIN_RIGHT";
  }

  if (ruleId.endsWith(".margin.top")) {
    return "MARGIN_TOP";
  }

  if (ruleId.endsWith(".margin.bottom")) {
    return "MARGIN_BOTTOM";
  }

  return null;
}

function isSupportedRuleType(ruleType: string): ruleType is RuleType {
  return SUPPORTED_RULE_TYPES.has(ruleType as RuleType);
}

function isPointExpected(expected: RuleExpectedValue): boolean {
  return (
    typeof expected === "object" &&
    "unit" in expected &&
    expected.unit === "pt"
  );
}

function isAlignmentExpected(expected: RuleExpectedValue): boolean {
  const value =
    typeof expected === "object" && "value" in expected
      ? expected.value
      : expected;

  return (
    value === "left" ||
    value === "right" ||
    value === "center" ||
    value === "justify"
  );
}

function isBibliographyReferencesRule(rule: Readonly<RuleDefinition>): boolean {
  const expected = rule.expected;

  return (
    typeof expected === "object" &&
    "section" in expected &&
    typeof expected.section === "string" &&
    expected.section.toLocaleLowerCase("tr-TR") === BIBLIOGRAPHY_SECTION_NAME
  );
}
