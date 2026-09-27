import type {
  Department,
  Faculty,
  Institute,
  Program,
  RuleDefinition,
  RuleExpectedValue,
  RuleSetMetadata,
  StudyType,
  ThesisType,
  University,
  UniversityRuleSet,
} from "../types";

type DiscoveredRuleSetModules = Record<string, unknown>;

interface LegacyRuleFile {
  metadata: {
    university: string;
    programLevel: string;
    version: string;
  };
  rules: RuleDefinition[];
}

export class RuleSetLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleSetLoadError";
  }
}

const discoveredRuleSetModules = import.meta.glob(
  "../../../data/universities/**/*.json",
  { eager: true, import: "default" },
) as DiscoveredRuleSetModules;

export function loadRules(): RuleDefinition[] {
  const legacyRuleSet = loadAvailableRuleSets().find(
    (ruleSet) => ruleSet.id === "comu.bachelor",
  );

  if (!legacyRuleSet) {
    throw new RuleSetLoadError("Legacy COMU bachelor rule set bulunamadı.");
  }

  return cloneRules(legacyRuleSet.rules);
}

export function loadRuleSets(
  ruleSets: readonly UniversityRuleSet[] = [
    requireRuleSet(loadAvailableRuleSets(), "comu.bachelor"),
  ],
): UniversityRuleSet[] {
  return ruleSets.map(cloneRuleSet);
}

export function loadFoodTechnologyBachelorRuleSets(): UniversityRuleSet[] {
  return loadAvailableRuleSets();
}

export function loadAvailableRuleSets(): UniversityRuleSet[] {
  return loadDiscoveredRuleSets(discoveredRuleSetModules);
}

export function loadDiscoveredRuleSets(
  modules: Readonly<DiscoveredRuleSetModules>,
): UniversityRuleSet[] {
  const ruleSets = Object.entries(modules)
    .filter(([, moduleValue]) => isRuleSetCandidate(moduleValue))
    .map(([path, moduleValue]) => normalizeDiscoveredRuleSet(path, moduleValue))
    .sort((first, second) => first.id.localeCompare(second.id));

  assertUniqueRuleSetIds(ruleSets);
  assertUniqueRuleSetSelections(ruleSets);

  return ruleSets.map(cloneRuleSet);
}

function normalizeDiscoveredRuleSet(
  path: string,
  value: unknown,
): UniversityRuleSet {
  if (!isRecord(value)) {
    throw new RuleSetLoadError(`${path}: rule set JSON object olmalıdır.`);
  }

  if (isLegacyRuleFile(value)) {
    return adaptLegacyRuleSet(path, value);
  }

  assertUniversityRuleSet(path, value);

  return value;
}

function adaptLegacyRuleSet(
  path: string,
  ruleFile: LegacyRuleFile,
): UniversityRuleSet {
  const { metadata, rules } = ruleFile;

  return {
    id: `${metadata.university}.${metadata.programLevel}`,
    metadata: {
      university: {
        id: metadata.university,
        name: metadata.university === "comu"
          ? "Çanakkale Onsekiz Mart Üniversitesi"
          : metadata.university,
        slug: metadata.university,
      },
      thesisType: {
        id: metadata.programLevel,
        name: metadata.programLevel === "bachelor"
          ? "Lisans"
          : metadata.programLevel,
        slug: metadata.programLevel,
      },
      version: metadata.version,
    },
    rules: validateRules(path, rules),
  };
}

function assertUniversityRuleSet(
  path: string,
  value: Record<string, unknown>,
): asserts value is UniversityRuleSet {
  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    throw new RuleSetLoadError(`${path}: rule set id eksik veya geçersiz.`);
  }

  if (!isRecord(value.metadata)) {
    throw new RuleSetLoadError(`${path}: metadata eksik veya geçersiz.`);
  }

  assertRuleSetMetadata(path, value.metadata);

  if (value.extends !== undefined && !isRuleSetReferences(value.extends)) {
    throw new RuleSetLoadError(`${path}: extends geçersiz.`);
  }

  validateRules(path, value.rules);
}

function assertRuleSetMetadata(
  path: string,
  metadata: Record<string, unknown>,
): asserts metadata is RuleSetMetadata {
  assertNamedEntity(path, metadata.university, "metadata.university");
  assertNamedEntity(path, metadata.thesisType, "metadata.thesisType");

  if (typeof metadata.version !== "string" || metadata.version.trim() === "") {
    throw new RuleSetLoadError(`${path}: metadata.version eksik veya geçersiz.`);
  }

  assertOptionalNamedEntity(path, metadata.studyType, "metadata.studyType");
  assertOptionalNamedEntity(path, metadata.faculty, "metadata.faculty");
  assertOptionalNamedEntity(path, metadata.institute, "metadata.institute");
  assertOptionalNamedEntity(path, metadata.department, "metadata.department");
  assertOptionalNamedEntity(path, metadata.program, "metadata.program");

  if (metadata.faculty && metadata.institute) {
    throw new RuleSetLoadError(`${path}: metadata faculty ve institute aynı anda içeremez.`);
  }

  if (metadata.department && metadata.program) {
    throw new RuleSetLoadError(`${path}: metadata department ve program aynı anda içeremez.`);
  }

  if (metadata.guide !== undefined) {
    if (
      !isRecord(metadata.guide) ||
      typeof metadata.guide.title !== "string" ||
      metadata.guide.title.trim() === ""
    ) {
      throw new RuleSetLoadError(`${path}: metadata.guide geçersiz.`);
    }
  }
}

function isLegacyRuleFile(value: Record<string, unknown>): value is LegacyRuleFile {
  if (!isRecord(value.metadata)) {
    return false;
  }

  return (
    typeof value.metadata.university === "string" &&
    typeof value.metadata.programLevel === "string" &&
    typeof value.metadata.version === "string" &&
    Array.isArray(value.rules)
  );
}

function isRuleSetCandidate(value: unknown): boolean {
  if (!isRecord(value)) {
    return true;
  }

  return "id" in value || "metadata" in value || "rules" in value;
}

function assertNamedEntity(
  path: string,
  value: unknown,
  fieldName: string,
): asserts value is University | ThesisType | Faculty | Institute | Department | Program | StudyType {
  if (!isNamedEntity(value)) {
    throw new RuleSetLoadError(`${path}: ${fieldName} eksik veya geçersiz.`);
  }
}

function assertOptionalNamedEntity(
  path: string,
  value: unknown,
  fieldName: string,
): void {
  if (value !== undefined && !isNamedEntity(value)) {
    throw new RuleSetLoadError(`${path}: ${fieldName} geçersiz.`);
  }
}

function isNamedEntity(value: unknown): value is University {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.trim() !== "" &&
    typeof value.name === "string" &&
    value.name.trim() !== "" &&
    typeof value.slug === "string" &&
    value.slug.trim() !== ""
  );
}

function isRuleSetReferences(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (reference) =>
        isRecord(reference) &&
        typeof reference.id === "string" &&
        reference.id.trim() !== "" &&
        typeof reference.scopeLevel === "string" &&
        (reference.version === undefined ||
          typeof reference.version === "string"),
    )
  );
}

function validateRules(path: string, rules: unknown): RuleDefinition[] {
  if (!Array.isArray(rules)) {
    throw new RuleSetLoadError(`${path}: rules array olmalıdır.`);
  }

  for (const [index, rule] of rules.entries()) {
    if (!isRecord(rule)) {
      throw new RuleSetLoadError(`${path}: rules[${index}] object olmalıdır.`);
    }

    for (const field of [
      "id",
      "title",
      "description",
      "category",
      "severity",
      "message",
      "solution",
      "version",
    ]) {
      if (typeof rule[field] !== "string" || rule[field].trim() === "") {
        throw new RuleSetLoadError(`${path}: rules[${index}].${field} geçersiz.`);
      }
    }

    if (!("expected" in rule)) {
      throw new RuleSetLoadError(`${path}: rules[${index}].expected eksik.`);
    }

    if (typeof rule.score !== "number" || !Number.isFinite(rule.score)) {
      throw new RuleSetLoadError(`${path}: rules[${index}].score geçersiz.`);
    }

    if (typeof rule.enabled !== "boolean") {
      throw new RuleSetLoadError(`${path}: rules[${index}].enabled geçersiz.`);
    }
  }

  return rules as RuleDefinition[];
}

function assertUniqueRuleSetIds(ruleSets: readonly UniversityRuleSet[]): void {
  const seen = new Set<string>();

  for (const ruleSet of ruleSets) {
    if (seen.has(ruleSet.id)) {
      throw new RuleSetLoadError(
        `Aynı rule set ID birden fazla kez discover edildi: ${ruleSet.id}.`,
      );
    }

    seen.add(ruleSet.id);
  }
}

function assertUniqueRuleSetSelections(ruleSets: readonly UniversityRuleSet[]): void {
  const seen = new Map<string, string>();

  for (const ruleSet of ruleSets) {
    const key = createSelectionKey(ruleSet.metadata);
    const previousId = seen.get(key);

    if (previousId) {
      throw new RuleSetLoadError(
        `Aynı academic selection birden fazla rule set ile temsil ediliyor: ${previousId}, ${ruleSet.id}.`,
      );
    }

    seen.set(key, ruleSet.id);
  }
}

function createSelectionKey(metadata: Readonly<RuleSetMetadata>): string {
  return [
    metadata.university.id,
    metadata.faculty ? `faculty:${metadata.faculty.id}` : "",
    metadata.institute ? `institute:${metadata.institute.id}` : "",
    metadata.department ? `department:${metadata.department.id}` : "",
    metadata.program ? `program:${metadata.program.id}` : "",
    metadata.thesisType.id,
    metadata.studyType?.id ?? "",
  ].join("|");
}

function requireRuleSet(
  ruleSets: readonly UniversityRuleSet[],
  ruleSetId: string,
): UniversityRuleSet {
  const ruleSet = ruleSets.find((candidate) => candidate.id === ruleSetId);

  if (!ruleSet) {
    throw new RuleSetLoadError(`${ruleSetId} rule set bulunamadı.`);
  }

  return ruleSet;
}

function cloneRuleSet(ruleSet: UniversityRuleSet): UniversityRuleSet {
  return {
    ...ruleSet,
    metadata: {
      ...ruleSet.metadata,
      university: { ...ruleSet.metadata.university },
      thesisType: { ...ruleSet.metadata.thesisType },
      studyType: ruleSet.metadata.studyType
        ? { ...ruleSet.metadata.studyType }
        : undefined,
      guide: ruleSet.metadata.guide
        ? { ...ruleSet.metadata.guide }
        : undefined,
      faculty: ruleSet.metadata.faculty
        ? { ...ruleSet.metadata.faculty }
        : undefined,
      institute: ruleSet.metadata.institute
        ? { ...ruleSet.metadata.institute }
        : undefined,
      department: ruleSet.metadata.department
        ? { ...ruleSet.metadata.department }
        : undefined,
      program: ruleSet.metadata.program
        ? { ...ruleSet.metadata.program }
        : undefined,
    },
    extends: ruleSet.extends?.map((reference) => ({ ...reference })),
    rules: cloneRules(ruleSet.rules),
  };
}

function cloneRules(rules: readonly RuleDefinition[]): RuleDefinition[] {
  return rules.map((rule) => ({
    ...rule,
    expected: cloneExpected(rule.expected),
    scope: rule.scope ? { ...rule.scope } : undefined,
    overrides: rule.overrides?.map((override) => ({ ...override })),
    validationEvidence: rule.validationEvidence
      ? { ...rule.validationEvidence }
      : undefined,
  }));
}

function cloneExpected(expected: RuleExpectedValue): RuleExpectedValue {
  return typeof expected === "object" ? { ...expected } : expected;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
