import type {
  RuleDefinition,
  RuleValidationCoverageStatus,
  RuleValidationMetadata,
  RuleValidationTrustStatus,
} from "../types";

const CONSERVATIVE_VALIDATION_METADATA: RuleValidationMetadata = {
  coverage: "MISSING",
  trust: "LOW",
};

export function getRuleValidationMetadata(
  rule: Readonly<RuleDefinition>,
): RuleValidationMetadata {
  const metadata = rule.validationEvidence;

  if (!metadata) {
    return { ...CONSERVATIVE_VALIDATION_METADATA };
  }

  if (
    !isAllowedRuleValidationCoverageStatus(metadata.coverage) ||
    !isAllowedRuleValidationTrustStatus(metadata.trust)
  ) {
    return { ...CONSERVATIVE_VALIDATION_METADATA };
  }

  return {
    coverage: metadata.coverage,
    trust: metadata.trust,
  };
}

export function getAllowedRuleValidationCoverageStatuses():
  RuleValidationCoverageStatus[] {
  return ["COMPLETE", "PARTIAL", "SHALLOW", "MISSING"];
}

export function getAllowedRuleValidationTrustStatuses():
  RuleValidationTrustStatus[] {
  return ["HIGH", "MEDIUM", "LOW"];
}

function isAllowedRuleValidationCoverageStatus(
  value: unknown,
): value is RuleValidationCoverageStatus {
  return getAllowedRuleValidationCoverageStatuses().includes(
    value as RuleValidationCoverageStatus,
  );
}

function isAllowedRuleValidationTrustStatus(
  value: unknown,
): value is RuleValidationTrustStatus {
  return getAllowedRuleValidationTrustStatuses().includes(
    value as RuleValidationTrustStatus,
  );
}
