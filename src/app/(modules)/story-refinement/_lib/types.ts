
export interface UserStory {
  storyId: string;
  requirementId: string;
  text: string;
}

export type QualityEvaluation = QualityAssessment[];
export interface ValidatedRequirement {
  id: string;
  title: string;
  text: string;
  qualityScore?: number;
  validationStatus: "Validated" | "Validated with notes";
  source: string;
  validatedAt: string;
  actor: string;
  goal: string;
  benefit: string;
  precondition: string;
  trigger: string;
  outcome: string;
  alternateOutcome: string;
}

export interface AcceptanceCriterion {
  id: string;
  given: string;
  when: string;
  then: string;
  title?: string;
  status?: "Draft" | "Optimized" | "Human Verified";
  priority?: "High" | "Medium" | "Low";
  category?: "Functional" | "Validation" | "Security" | "Error Handling" | "Performance" | "Accessibility" | "Business Rule";
  decisionRequired?: string;
  decisionResolution?: string;
}

export type OptimizationFindingStatus = "Pass" | "Warning" | "Missing" | "Needs Human Decision";

export interface OptimizationFinding {
  id: string;
  area: string;
  status: OptimizationFindingStatus;
  summary: string;
  details: string;
}

export interface AcceptanceCriterionChange {
  criterionId: string;
  original: AcceptanceCriterion;
  optimized: AcceptanceCriterion | null;
  explanation: string;
}

export interface LocalOptimizationResult {
  findings: OptimizationFinding[];
  changes: AcceptanceCriterionChange[];
  originalCriteria: AcceptanceCriterion[];
  optimizedCriteria: AcceptanceCriterion[];
}

export type QualityDimensionKey = "clarity" | "completeness" | "consistency" | "testability" | "invest";

export interface QualityAssessment {
  key: QualityDimensionKey;
  label: string;
  score: number;
  rationale: string;
}

export interface InvestAssessment {
  name: string;
  status: "Pass" | "Warning" | "Fail" | "Not Assessed";
  met: boolean;
  rationale: string;
  recommendation: string;
}

export interface UnsupportedAssumption {
  assumption: string;
  why: string;
}

 export interface UserStoryCandidate {
  id: string;
  storyId: string;
  label: string;
  userStory: string;
  acceptanceCriteria: AcceptanceCriterion[];
  assessment: QualityEvaluation;
  invest: InvestAssessment[];
  unsupportedAssumptions: UnsupportedAssumption[];
}

export type StoryCandidate = UserStoryCandidate;

export interface StoryDraft {
  userStory: string;
  acceptanceCriteria: AcceptanceCriterion[];
}

export interface ApprovedArtifactPackage {
  requirementId: string;
  userStory: string;
  acceptanceCriteria: AcceptanceCriterion[];
  investAssessment: InvestAssessment[];
  approvalStatus: "Approved";
  reviewer: string;
  decisionNotes: string;
  approvedAt: string;
  persistence: "prototype";
}

export interface GenerationRecord {
  id: string;
  requirementId: string;
  requirementText: string;
  context: ProjectContext;
  projectId: string | null;
  createdAt: string;
  candidates: StoryCandidate[];
  selectedCandidateId: string;
  draft: StoryDraft;
  status?: ReviewStatus;
  approvedAt?: string;
  approvedDraft?: StoryDraft;
  approvedPackage?: ApprovedArtifactPackage;
  reviewMetadata?: {
    reviewer: string;
    decision: ReviewDecision;
    decidedAt: string;
    persistence: "prototype";
    decisionNotes?: string;
  };
  sprintIntegration?: {
    projectId: string;
    storyId: string;
    integratedAt: string;
    sprintId?: string;
  };
}

export type GenerationResult = GenerationRecord;
export type ReviewStatus = "Draft" | "Approved" | "Rejected";
export type ReviewDecision = ReviewStatus | "Changes Requested";

export interface ProjectContext {
  actor: string;
  featureModule: string;
  businessGoal: string;
  relatedRequirements: string;
  existingSystemContext: string;
  additionalConstraints: string;
}

export interface GenerateRequest {
  requirement: ValidatedRequirement;
  context: ProjectContext;
  projectId: string | null;
}