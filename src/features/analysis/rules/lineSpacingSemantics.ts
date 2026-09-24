import type { LineSpacingValue } from "../types";

const OOXML_UNITS_PER_LINE = 240;

export function toComparableLineMultiple(
  lineSpacing: Readonly<LineSpacingValue>,
): number | null {
  return lineSpacing.rule === "auto"
    ? lineSpacing.value / OOXML_UNITS_PER_LINE
    : null;
}

export function formatLineSpacingValue(
  lineSpacing: Readonly<LineSpacingValue> | null,
): string {
  if (lineSpacing === null) {
    return "Satır aralığı tespit edilemedi";
  }

  const comparable = toComparableLineMultiple(lineSpacing);

  return comparable === null
    ? `${lineSpacing.rule} ${lineSpacing.value} (statik olarak karşılaştırılamaz)`
    : `${comparable}`;
}

export function formatUnsupportedLineSpacingRules(
  values: readonly LineSpacingValue[],
): string {
  return Array.from(new Set(values.map((value) => value.rule))).join(", ");
}
