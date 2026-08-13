import type { RuleValidator } from "./validators/RuleValidator";
import { AlignmentValidator } from "./validators/AlignmentValidator";
import { HeadingValidator } from "./validators/HeadingValidator";
import { MarginValidator } from "./validators/MarginValidator";
import { PageNumberValidator } from "./validators/PageNumberValidator";
import { TableOfContentsValidator } from "./validators/TableOfContentsValidator";

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
      new TableOfContentsValidator(),
    ],
  ]);

  register(ruleId: string, validator: RuleValidator): void {
    this.validators.set(ruleId, validator);
  }

  getValidator(ruleId: string): RuleValidator | undefined {
    return this.validators.get(ruleId);
  }
}
