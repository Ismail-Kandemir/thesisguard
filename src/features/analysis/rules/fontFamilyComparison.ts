export function fontFamiliesEqual(actual: string | null, expected: string): boolean {
  return actual !== null && normalizeFontFamily(actual) === normalizeFontFamily(expected);
}

function normalizeFontFamily(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}
