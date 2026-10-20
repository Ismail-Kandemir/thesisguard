import type {
  AssessmentEvidence,
  AssessmentIdentity,
  AssessmentObservation,
  RuleAssessment,
  RuleAssessmentDecision,
} from "../types/RuleAssessment";

/**
 * Pure, opt-in decision only: never calls validate, maps to RuleResult, or scores.
 * RuleEngine/ValidatorRegistry keep their existing validate path. A future
 * caller must explicitly request assess and handle absent capability as unknown,
 * not infer certainty from a legacy result. Report readiness is a later boundary.
 * This checks typed-contract invariants, not arbitrary untrusted JSON schemas.
 */
export function decideRuleAssessment(assessment: RuleAssessment): RuleAssessmentDecision {
  assertRuleAssessment(assessment);

  if (assessment.applicability.state === "not-applicable") return "not-applicable";
  if (assessment.applicability.state === "undetermined") return "undetermined";

  // Nested applicability does not narrow the parent union in TypeScript.
  const observations = assessment.observations ?? [];
  if (observations.some((item) => item.state === "confirmed" && item.finding === "violation")) {
    return "violation";
  }

  if (
    assessment.coverage?.population === "closed" &&
    observations.length > 0 &&
    observations.every((item) => item.state === "confirmed" && item.finding === "compliant")
  ) {
    return "compliant";
  }

  return "undetermined";
}

function assertRuleAssessment(assessment: RuleAssessment): void {
  requireContract(assessment.reference.id.trim().length > 0, "Assessment reference is required.");
  const applicability = assessment.applicability;

  if (applicability.state === "not-applicable") {
    requireReason(applicability.reason);
    requireEvidence(applicability.evidence);
    requireContract(
      assessment.observations === undefined && assessment.coverage === undefined,
      "Not-applicable assessments cannot contain observations or coverage.",
    );
    return;
  }

  requireContract(
    applicability.state === "applicable" || applicability.state === "undetermined",
    "Unknown applicability state.",
  );
  if (applicability.state === "applicable") requireEvidence(applicability.evidence);
  else requireReason(applicability.reason);

  const coverage = assessment.coverage;
  const observations = assessment.observations;
  requireContract(coverage !== undefined && observations !== undefined, "Assessment coverage is required.");
  if (!coverage || !observations) return;

  requireContract(coverage.population === "closed" || coverage.population === "open", "Unknown population state.");
  if (coverage.population === "open") requireReason(coverage.reason);
  else requireContract(coverage.unresolvedSubjects === undefined, "Closed populations cannot have unresolved carriers.");

  for (const exclusion of coverage.excludedSubjects) {
    requireReason(exclusion.reason);
    requireEvidence(exclusion.evidence);
  }

  for (const observation of observations) {
    requireObservation(observation);
    requireContract(
      applicability.state === "applicable" || observation.state === "undetermined",
      "Unresolved applicability cannot establish a confirmed finding.",
    );
  }
}

function requireObservation(observation: AssessmentObservation): void {
  const identity: AssessmentIdentity = observation.identity;
  const certainIdentity = identity.certainty === "confirmed" || identity.certainty === "not-required";
  requireContract(
    certainIdentity || identity.certainty === "ambiguous" || identity.certainty === "unresolved",
    "Unknown identity certainty.",
  );
  if (identity.certainty === "confirmed") requireEvidence(identity.evidence);
  if (identity.certainty === "ambiguous" || identity.certainty === "unresolved") requireReason(identity.reason);

  const evidence = observation.evidence;
  requireContract(
    evidence.certainty === "sufficient" || evidence.certainty === "missing" || evidence.certainty === "unsupported",
    "Unknown evidence certainty.",
  );
  if (evidence.certainty === "sufficient") requireEvidence(evidence.items);
  else requireReason(evidence.reason);
  if (evidence.certainty === "unsupported") {
    requireContract(
      ["static-docx", "rendered-layout", "physical-output"].includes(evidence.boundary),
      "Unsupported evidence requires an explicit boundary.",
    );
  }

  if (observation.state === "confirmed") {
    requireContract(certainIdentity && evidence.certainty === "sufficient", "Confirmed findings require certain identity and sufficient evidence.");
    requireContract(observation.finding === "compliant" || observation.finding === "violation", "Unknown finding.");
  } else {
    requireContract(observation.state === "undetermined", "Unknown observation state.");
    requireContract(observation.finding === undefined, "Undetermined observations cannot claim a finding.");
    requireContract(!certainIdentity || evidence.certainty !== "sufficient", "Certain, supported observations require an explicit finding.");
  }
}

function requireEvidence(evidence: AssessmentEvidence): void {
  requireContract(evidence.length > 0, "Proof must contain at least one evidence reference.");
}

function requireReason(reason: string): void {
  requireContract(reason.trim().length > 0, "Uncertainty or exclusion requires a reason.");
}

function requireContract(condition: boolean, message: string): void {
  if (!condition) throw new TypeError(`Invalid RuleAssessment: ${message}`);
}
