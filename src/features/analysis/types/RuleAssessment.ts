import type { RuleEvidence } from "./RuleResult";

export type AssessmentEvidence = readonly [RuleEvidence, ...RuleEvidence[]];

/** References existing semantic records; these do not establish new identities. */
export type AssessmentSubject =
  | { readonly kind: "document" }
  | { readonly kind: "page-section"; readonly sectionIndex: number }
  | { readonly kind: "paragraph"; readonly paragraphId: string }
  | { readonly kind: "academic-section"; readonly occurrenceId: string }
  | { readonly kind: "representation"; readonly representationId: string }
  | { readonly kind: "caption"; readonly captionId: string };

export type CertainAssessmentIdentity =
  | { readonly certainty: "confirmed"; readonly evidence: AssessmentEvidence }
  | { readonly certainty: "not-required" };

export type UncertainAssessmentIdentity = {
  readonly certainty: "ambiguous" | "unresolved";
  readonly reason: string;
};

export type AssessmentIdentity = CertainAssessmentIdentity | UncertainAssessmentIdentity;

export interface SufficientAssessmentEvidence {
  readonly certainty: "sufficient";
  readonly items: AssessmentEvidence;
}

export type UnavailableAssessmentEvidence =
  | { readonly certainty: "missing"; readonly reason: string }
  | {
      readonly certainty: "unsupported";
      readonly boundary: "static-docx" | "rendered-layout" | "physical-output";
      readonly reason: string;
    };

export interface ConfirmedAssessmentObservation {
  readonly state: "confirmed";
  readonly subject: AssessmentSubject;
  readonly identity: CertainAssessmentIdentity;
  readonly evidence: SufficientAssessmentEvidence;
  readonly finding: "compliant" | "violation";
}

/** A certain identity with sufficient evidence belongs in the confirmed branch. */
export type UndeterminedAssessmentObservation = {
  readonly state: "undetermined";
  readonly subject: AssessmentSubject;
  readonly finding?: never;
} & (
  | {
      readonly identity: UncertainAssessmentIdentity;
      readonly evidence: SufficientAssessmentEvidence | UnavailableAssessmentEvidence;
    }
  | {
      readonly identity: CertainAssessmentIdentity;
      readonly evidence: UnavailableAssessmentEvidence;
    }
);

export type AssessmentObservation =
  | ConfirmedAssessmentObservation
  | UndeterminedAssessmentObservation;

export interface AssessmentExclusion {
  readonly subject: AssessmentSubject;
  readonly reason: string;
  readonly evidence: AssessmentEvidence;
}

/**
 * Completeness is derived from population closure AND observations. Unknown
 * carriers remain references, never an invented relevant academic-object count.
 */
export type AssessmentCoverage = {
  readonly excludedSubjects: readonly AssessmentExclusion[];
} & (
  | { readonly population: "closed"; readonly unresolvedSubjects?: never }
  | {
      readonly population: "open";
      readonly reason: string;
      readonly unresolvedSubjects: readonly AssessmentSubject[];
    }
);

interface RuleAssessmentReference {
  readonly reference: {
    readonly kind: "rule" | "inventory";
    readonly id: string;
  };
}

/**
 * Opt-in, unscored evidence contract. Not a RuleResult or a scoring input.
 * Producers must justify source applicability and claim scope; evidence refs
 * alone cannot prove that the academic policy or semantic inference is correct.
 */
export type RuleAssessment = RuleAssessmentReference & (
  | {
      readonly applicability: {
        readonly state: "applicable";
        readonly evidence: AssessmentEvidence;
      };
      readonly coverage: AssessmentCoverage;
      readonly observations: readonly AssessmentObservation[];
    }
  | {
      readonly applicability: {
        readonly state: "undetermined";
        readonly reason: string;
      };
      readonly coverage: AssessmentCoverage;
      readonly observations: readonly UndeterminedAssessmentObservation[];
    }
  | {
      readonly applicability: {
        readonly state: "not-applicable";
        readonly reason: string;
        readonly evidence: AssessmentEvidence;
      };
      readonly coverage?: never;
      readonly observations?: never;
    }
);

/** Semantic decisions, deliberately separate from RuleResultStatus. */
export type RuleAssessmentDecision =
  | "compliant"
  | "violation"
  | "not-applicable"
  | "undetermined";
