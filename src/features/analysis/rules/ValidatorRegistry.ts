import type { RuleValidator } from "./validators/RuleValidator";
import { AlignmentValidator } from "./validators/AlignmentValidator";
import { HeadingValidator } from "./validators/HeadingValidator";
import { MarginValidator } from "./validators/MarginValidator";
import { PageNumberValidator } from "./validators/PageNumberValidator";
import { RequiredSectionValidator } from "./validators/RequiredSectionValidator";
import { SectionOrderValidator } from "./validators/SectionOrderValidator";
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
const FOOD_TECHNOLOGY_ACKNOWLEDGEMENTS_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.acknowledgements";
const FOOD_TECHNOLOGY_INTRODUCTION_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.introduction";
const FOOD_TECHNOLOGY_CONCLUSION_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.conclusion";
const FOOD_TECHNOLOGY_CV_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.cv";
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
const FOOD_TECHNOLOGY_SUMMARY_TR_WORD_COUNT_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.summary-tr-word-count";
const FOOD_TECHNOLOGY_SUMMARY_EN_WORD_COUNT_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.summary-en-word-count";

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
    [FOOD_TECHNOLOGY_PAGE_NUMBER_RULE_ID, new PageNumberValidator()],
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
    [FOOD_TECHNOLOGY_ACKNOWLEDGEMENTS_RULE_ID, new RequiredSectionValidator()],
    [FOOD_TECHNOLOGY_INTRODUCTION_RULE_ID, new RequiredSectionValidator()],
    [FOOD_TECHNOLOGY_CONCLUSION_RULE_ID, new RequiredSectionValidator()],
    [FOOD_TECHNOLOGY_CV_RULE_ID, new RequiredSectionValidator()],
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
      FOOD_TECHNOLOGY_SUMMARY_TR_WORD_COUNT_RULE_ID,
      new SectionWordCountValidator(),
    ],
    [
      FOOD_TECHNOLOGY_SUMMARY_EN_WORD_COUNT_RULE_ID,
      new SectionWordCountValidator(),
    ],
  ]);

  register(ruleId: string, validator: RuleValidator): void {
    this.validators.set(ruleId, validator);
  }

  getValidator(ruleId: string): RuleValidator | undefined {
    return this.validators.get(ruleId);
  }
}
