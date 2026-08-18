import type { DocumentSection } from "../types";
import { normalizeSectionName } from "./documentSectionsParser";

const MANUAL_NUMBER_PREFIX_PATTERN = /^\s*((?:\d+\.){1,3})\s+(.+?)\s*$/u;

export interface ManualNumberPrefix {
  label: string;
  level: number;
  remainder: string;
}

export function parseManualNumberPrefix(value: string): ManualNumberPrefix | null {
  const match = MANUAL_NUMBER_PREFIX_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const label = match[1];

  return {
    label,
    level: label.split(".").filter(Boolean).length - 1,
    remainder: match[2],
  };
}

export function sectionMatchesAnyExpectedName(
  section: Readonly<DocumentSection>,
  expectedNames: readonly string[],
): boolean {
  return expectedNames.some((expectedName) => sectionMatchesExpectedName(section, expectedName));
}

export function sectionMatchesExpectedName(
  section: Readonly<DocumentSection>,
  expectedName: string,
): boolean {
  const normalizedExpected = normalizeSectionName(expectedName);

  if (section.normalizedName === normalizedExpected) {
    return true;
  }

  const manualPrefix = parseManualNumberPrefix(section.displayName);

  return manualPrefix !== null && normalizeSectionName(manualPrefix.remainder) === normalizedExpected;
}
