import type { RuleValidator } from "./validators/RuleValidator";
import { AlignmentValidator } from "./validators/AlignmentValidator";
import { ConditionalRequiredSectionValidator } from "./validators/ConditionalRequiredSectionValidator";
import { HeadingValidator } from "./validators/HeadingValidator";
import { HeadingLevelFormatValidator } from "./validators/HeadingLevelFormatValidator";
import { HeadingNumberingValidator } from "./validators/HeadingNumberingValidator";
import { MarginValidator } from "./validators/MarginValidator";
import { PageNumberValidator } from "./validators/PageNumberValidator";
import { PageNumberSequenceValidator } from "./validators/PageNumberSequenceValidator";
import { ObjectAlignmentValidator } from "./validators/ObjectAlignmentValidator";
import { ObjectCaptionPlacementValidator } from "./validators/ObjectCaptionPlacementValidator";
import { ObjectCaptionFormatValidator } from "./validators/ObjectCaptionFormatValidator";
import { ObjectInTextReferenceValidator } from "./validators/ObjectInTextReferenceValidator";
import { RequiredSectionValidator } from "./validators/RequiredSectionValidator";
import { SectionOrderValidator } from "./validators/SectionOrderValidator";
import { SectionKeywordsValidator } from "./validators/SectionKeywordsValidator";
import { SectionWordCountValidator } from "./validators/SectionWordCountValidator";

const ALIGNMENT_RULE_ID = "comu.bachelor.format.alignment";
const HEADING_1_RULE_ID = "comu.bachelor.heading.heading1";
const HEADING_2_RULE_ID = "comu.bachelor.heading.heading2";
const HEADING_3_RULE_ID = "comu.bachelor.heading.heading3";
const LEFT_MARGIN_RULE_ID = "comu.bachelor.margin.left";
const RIGHT_MARGIN_RULE_ID = "comu.bachelor.margin.right";
const TOP_MARGIN_RULE_ID = "comu.bachelor.margin.top";
const BOTTOM_MARGIN_RULE_ID = "comu.bachelor.margin.bottom";
const PAGE_NUMBER_RULE_ID = "comu.bachelor.page-number";
const FOOD_TECHNOLOGY_PAGE_NUMBER_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.page-number";
const FOOD_TECHNOLOGY_PAGE_NUMBER_SEQUENCE_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.page-number-sequence";
const FOOD_TECHNOLOGY_TABLE_CAPTION_PLACEMENT_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.table-caption-placement";
const FOOD_TECHNOLOGY_FIGURE_CAPTION_PLACEMENT_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.figure-caption-placement";
const FOOD_TECHNOLOGY_TABLE_OBJECT_ALIGNMENT_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.table-object-alignment";
const FOOD_TECHNOLOGY_FIGURE_OBJECT_ALIGNMENT_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.figure-object-alignment";
const FOOD_TECHNOLOGY_TABLE_CAPTION_FORMAT_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.table-caption-format";
const FOOD_TECHNOLOGY_FIGURE_CAPTION_FORMAT_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.figure-caption-format";
const FOOD_TECHNOLOGY_TABLE_IN_TEXT_REFERENCE_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.table-in-text-reference";
const FOOD_TECHNOLOGY_FIGURE_IN_TEXT_REFERENCE_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.figure-in-text-reference";
const FOOD_TECHNOLOGY_TOP_MARGIN_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.margin.top";
const FOOD_TECHNOLOGY_HEADING_1_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.heading.heading1";
const FOOD_TECHNOLOGY_BODY_LEVEL_0_HEADING_FORMAT_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.body-level-0-heading-format";
const FOOD_TECHNOLOGY_TABLE_OF_CONTENTS_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.table-of-contents";
const FOOD_TECHNOLOGY_REFERENCES_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.references";
const FOOD_TECHNOLOGY_SUMMARY_TR_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.summary-tr";
const FOOD_TECHNOLOGY_SUMMARY_EN_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.summary-en";
const FOOD_TECHNOLOGY_PLAGIARISM_DECLARATION_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.plagiarism-declaration";
const FOOD_TECHNOLOGY_ACCEPTANCE_APPROVAL_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.acceptance-approval";
const FOOD_TECHNOLOGY_ACKNOWLEDGEMENTS_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.acknowledgements";
const FOOD_TECHNOLOGY_INTRODUCTION_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.introduction";
const FOOD_TECHNOLOGY_CONCLUSION_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.conclusion";
const FOOD_TECHNOLOGY_CV_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.cv";
const FOOD_TECHNOLOGY_LIST_OF_TABLES_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.list-of-tables";
const FOOD_TECHNOLOGY_LIST_OF_FIGURES_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.list-of-figures";
const FOOD_TECHNOLOGY_LIST_OF_ABBREVIATIONS_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.list-of-abbreviations";
const FOOD_TECHNOLOGY_EXPERIMENTAL_GENERAL_INFORMATION_LITERATURE_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.experimental.general-information-literature";
const FOOD_TECHNOLOGY_EXPERIMENTAL_MATERIAL_METHOD_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.experimental.material-method";
const FOOD_TECHNOLOGY_EXPERIMENTAL_FINDINGS_DISCUSSION_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.experimental.findings-discussion";
const FOOD_TECHNOLOGY_SOURCE_RESEARCH_GENERAL_INFORMATION_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.source-research.general-information";
const FOOD_TECHNOLOGY_EXPERIMENTAL_SECTION_ORDER_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.experimental.section-order";
const FOOD_TECHNOLOGY_SOURCE_RESEARCH_SECTION_ORDER_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.source-research.section-order";
const FOOD_TECHNOLOGY_EXPERIMENTAL_HEADING_NUMBERING_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.experimental.heading-numbering";
const FOOD_TECHNOLOGY_SOURCE_RESEARCH_HEADING_NUMBERING_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.source-research.heading-numbering";
const FOOD_TECHNOLOGY_SUMMARY_TR_WORD_COUNT_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.summary-tr-word-count";
const FOOD_TECHNOLOGY_SUMMARY_EN_WORD_COUNT_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.summary-en-word-count";
const FOOD_TECHNOLOGY_SUMMARY_TR_KEYWORDS_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.summary-tr-keywords";
const FOOD_TECHNOLOGY_SUMMARY_EN_KEYWORDS_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.summary-en-keywords";

export class ValidatorRegistry {
  private readonly validators = new Map<string, RuleValidator>([
    [ALIGNMENT_RULE_ID, new AlignmentValidator()],
    [HEADING_1_RULE_ID, new HeadingValidator()],
    [HEADING_2_RULE_ID, new HeadingValidator()],
    [HEADING_3_RULE_ID, new HeadingValidator()],
    [LEFT_MARGIN_RULE_ID, new MarginValidator("left")],
    [RIGHT_MARGIN_RULE_ID, new MarginValidator("right")],
    [TOP_MARGIN_RULE_ID, new MarginValidator("top")],
    [BOTTOM_MARGIN_RULE_ID, new MarginValidator("bottom")],
    [PAGE_NUMBER_RULE_ID, new PageNumberValidator()],
    [FOOD_TECHNOLOGY_TOP_MARGIN_RULE_ID, new MarginValidator("top")],
    [FOOD_TECHNOLOGY_HEADING_1_RULE_ID, new HeadingValidator()],
    [
      FOOD_TECHNOLOGY_BODY_LEVEL_0_HEADING_FORMAT_RULE_ID,
      new HeadingLevelFormatValidator(),
    ],
    [FOOD_TECHNOLOGY_PAGE_NUMBER_RULE_ID, new PageNumberValidator()],
    [FOOD_TECHNOLOGY_PAGE_NUMBER_SEQUENCE_RULE_ID, new PageNumberSequenceValidator()],
    [FOOD_TECHNOLOGY_TABLE_OBJECT_ALIGNMENT_RULE_ID, new ObjectAlignmentValidator()],
    [FOOD_TECHNOLOGY_FIGURE_OBJECT_ALIGNMENT_RULE_ID, new ObjectAlignmentValidator()],
    [FOOD_TECHNOLOGY_TABLE_CAPTION_PLACEMENT_RULE_ID, new ObjectCaptionPlacementValidator()],
    [FOOD_TECHNOLOGY_FIGURE_CAPTION_PLACEMENT_RULE_ID, new ObjectCaptionPlacementValidator()],
    [FOOD_TECHNOLOGY_TABLE_CAPTION_FORMAT_RULE_ID, new ObjectCaptionFormatValidator()],
    [FOOD_TECHNOLOGY_FIGURE_CAPTION_FORMAT_RULE_ID, new ObjectCaptionFormatValidator()],
    [FOOD_TECHNOLOGY_TABLE_IN_TEXT_REFERENCE_RULE_ID, new ObjectInTextReferenceValidator()],
    [FOOD_TECHNOLOGY_FIGURE_IN_TEXT_REFERENCE_RULE_ID, new ObjectInTextReferenceValidator()],
    [
      FOOD_TECHNOLOGY_TABLE_OF_CONTENTS_RULE_ID,
      new RequiredSectionValidator(),
    ],
    [FOOD_TECHNOLOGY_REFERENCES_RULE_ID, new RequiredSectionValidator()],
    [FOOD_TECHNOLOGY_SUMMARY_TR_RULE_ID, new RequiredSectionValidator()],
    [FOOD_TECHNOLOGY_SUMMARY_EN_RULE_ID, new RequiredSectionValidator()],
    [
      FOOD_TECHNOLOGY_PLAGIARISM_DECLARATION_RULE_ID,
      new RequiredSectionValidator(),
    ],
    [
      FOOD_TECHNOLOGY_ACCEPTANCE_APPROVAL_RULE_ID,
      new RequiredSectionValidator(),
    ],
    [FOOD_TECHNOLOGY_ACKNOWLEDGEMENTS_RULE_ID, new RequiredSectionValidator()],
    [FOOD_TECHNOLOGY_INTRODUCTION_RULE_ID, new RequiredSectionValidator()],
    [FOOD_TECHNOLOGY_CONCLUSION_RULE_ID, new RequiredSectionValidator()],
    [FOOD_TECHNOLOGY_CV_RULE_ID, new RequiredSectionValidator()],
    [
      FOOD_TECHNOLOGY_LIST_OF_TABLES_RULE_ID,
      new ConditionalRequiredSectionValidator(),
    ],
    [
      FOOD_TECHNOLOGY_LIST_OF_FIGURES_RULE_ID,
      new ConditionalRequiredSectionValidator(),
    ],
    [
      FOOD_TECHNOLOGY_LIST_OF_ABBREVIATIONS_RULE_ID,
      new ConditionalRequiredSectionValidator(),
    ],
    [
      FOOD_TECHNOLOGY_EXPERIMENTAL_GENERAL_INFORMATION_LITERATURE_RULE_ID,
      new RequiredSectionValidator(),
    ],
    [
      FOOD_TECHNOLOGY_EXPERIMENTAL_MATERIAL_METHOD_RULE_ID,
      new RequiredSectionValidator(),
    ],
    [
      FOOD_TECHNOLOGY_EXPERIMENTAL_FINDINGS_DISCUSSION_RULE_ID,
      new RequiredSectionValidator(),
    ],
    [
      FOOD_TECHNOLOGY_SOURCE_RESEARCH_GENERAL_INFORMATION_RULE_ID,
      new RequiredSectionValidator(),
    ],
    [
      FOOD_TECHNOLOGY_EXPERIMENTAL_SECTION_ORDER_RULE_ID,
      new SectionOrderValidator(),
    ],
    [
      FOOD_TECHNOLOGY_SOURCE_RESEARCH_SECTION_ORDER_RULE_ID,
      new SectionOrderValidator(),
    ],
    [
      FOOD_TECHNOLOGY_EXPERIMENTAL_HEADING_NUMBERING_RULE_ID,
      new HeadingNumberingValidator(),
    ],
    [
      FOOD_TECHNOLOGY_SOURCE_RESEARCH_HEADING_NUMBERING_RULE_ID,
      new HeadingNumberingValidator(),
    ],
    [
      FOOD_TECHNOLOGY_SUMMARY_TR_WORD_COUNT_RULE_ID,
      new SectionWordCountValidator(),
    ],
    [
      FOOD_TECHNOLOGY_SUMMARY_EN_WORD_COUNT_RULE_ID,
      new SectionWordCountValidator(),
    ],
    [
      FOOD_TECHNOLOGY_SUMMARY_TR_KEYWORDS_RULE_ID,
      new SectionKeywordsValidator(),
    ],
    [
      FOOD_TECHNOLOGY_SUMMARY_EN_KEYWORDS_RULE_ID,
      new SectionKeywordsValidator(),
    ],
  ]);

  register(ruleId: string, validator: RuleValidator): void {
    this.validators.set(ruleId, validator);
  }

  getValidator(ruleId: string): RuleValidator | undefined {
    return this.validators.get(ruleId);
  }
}
