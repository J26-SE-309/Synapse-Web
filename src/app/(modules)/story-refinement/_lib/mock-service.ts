import type {
  AcceptanceCriterion,
  GenerateRequest,
  GenerationResult,
  GenerationRecord,
  InvestAssessment,
  LocalOptimizationResult,
  OptimizationFinding,
  ProjectContext,
  QualityAssessment,
  StoryCandidate,
  StoryDraft,
  ValidatedRequirement,
} from "./types";

const HISTORY_KEY = "synapse.story-refinement.history.v1";
const HISTORY_EVENT = "synapse:story-refinement-history-change";
const SERVER_HISTORY: GenerationRecord[] = [];
let previousHistoryJson: string | null | undefined;
let historySnapshot: GenerationRecord[] = [];

export const MOCK_REQUIREMENTS: ValidatedRequirement[] = [
  {
    id: "REQ-104",
    title: "Book a tutoring session",
    text: "A student can book an available tutoring session by selecting a tutor, date and time.",
    qualityScore: 0.92,
    validationStatus: "Validated",
    source: "Component 1 · Import batch 18",
    validatedAt: "2026-09-28",
    actor: "a student",
    goal: "book an available tutoring session",
    benefit: "I can attend a lesson at a suitable time",
    precondition: "the student is viewing a tutor with an available time slot",
    trigger: "they select a date and time and confirm the booking",
    outcome: "the session is reserved and a confirmation is shown",
    alternateOutcome: "the selected time is no longer available and the student is asked to choose another slot",
  },
  {
    id: "REQ-117",
    title: "Review upcoming sessions",
    text: "A student can view their upcoming tutoring sessions with the tutor name, date, time and session status.",
    qualityScore: 0.88,
    validationStatus: "Validated with notes",
    source: "Component 1 · Manual review",
    validatedAt: "2026-09-27",
    actor: "a student",
    goal: "review my upcoming tutoring sessions",
    benefit: "I know when and where I need to join",
    precondition: "the student has at least one scheduled tutoring session",
    trigger: "they open their upcoming sessions",
    outcome: "each session shows its tutor, date, time and current status",
    alternateOutcome: "no upcoming sessions are available and an empty state is shown",
  },
  {
    id: "REQ-129",
    title: "Manage tutor availability",
    text: "A tutor can add or remove available dates and time slots so students can book sessions that fit their schedule.",
    qualityScore: 0.95,
    validationStatus: "Validated",
    source: "Component 1 · Import batch 18",
    validatedAt: "2026-09-26",
    actor: "a tutor",
    goal: "manage the dates and time slots I can teach",
    benefit: "students can book sessions that fit my schedule",
    precondition: "the tutor is signed in and viewing availability settings",
    trigger: "they add or remove a date and time slot and save the changes",
    outcome: "the updated availability is shown to students",
    alternateOutcome: "a slot with an existing booking cannot be removed without resolving that booking",
  },
  {
    id: "REQ-132",
    title: "Cancel a tutoring session",
    text: "A student can cancel a booked tutoring session before its scheduled start time.",
    qualityScore: 0.91,
    validationStatus: "Validated",
    source: "Component 1 · Import batch 18",
    validatedAt: "2026-09-25",
    actor: "a student",
    goal: "cancel a booked tutoring session before it starts",
    benefit: "I can manage changes to my schedule",
    precondition: "the student has a booked session that has not started",
    trigger: "they confirm the cancellation",
    outcome: "the session status changes to cancelled",
    alternateOutcome: "the session has already started and cannot be cancelled",
  },
  {
    id: "REQ-141",
    title: "Find tutors by subject",
    text: "A student can filter the tutor list by subject to find tutors who teach a selected subject.",
    qualityScore: 0.86,
    validationStatus: "Validated with notes",
    source: "Component 1 · Manual review",
    validatedAt: "2026-09-24",
    actor: "a student",
    goal: "find tutors who teach a selected subject",
    benefit: "I can choose someone who can help with my coursework",
    precondition: "the student is viewing the tutor list",
    trigger: "they select a subject filter",
    outcome: "only tutors who teach that subject are shown",
    alternateOutcome: "no tutors match and an empty result message is shown",
  },
  {
    id: "REQ-155",
    title: "Share learning resources",
    text: "A tutor can share a learning resource with a student enrolled in one of their tutoring sessions.",
    qualityScore: 0.93,
    validationStatus: "Validated",
    source: "Component 1 · Import batch 19",
    validatedAt: "2026-09-23",
    actor: "a tutor",
    goal: "share a learning resource with an enrolled student",
    benefit: "the student can prepare for or follow up on a session",
    precondition: "the tutor and student share a scheduled session",
    trigger: "the tutor selects a resource and shares it",
    outcome: "the student can view the shared resource",
    alternateOutcome: "the resource is unavailable and the tutor is told it was not shared",
  },
  {
    id: "REQ-161",
    title: "Rate a completed session",
    text: "A student can submit a rating for a tutoring session after the session is completed.",
    qualityScore: 0.89,
    validationStatus: "Validated",
    source: "Component 1 · Import batch 19",
    validatedAt: "2026-09-22",
    actor: "a student",
    goal: "rate a completed tutoring session",
    benefit: "I can share feedback about my learning experience",
    precondition: "the student has a completed session without a submitted rating",
    trigger: "they submit a rating",
    outcome: "the rating is recorded against the session",
    alternateOutcome: "the session is not complete and the rating cannot be submitted",
  },
  {
    id: "REQ-173",
    title: "View tutor availability",
    text: "A student can view a tutor's available session dates and times before booking.",
    qualityScore: 0.94,
    validationStatus: "Validated",
    source: "Component 1 · Import batch 19",
    validatedAt: "2026-09-21",
    actor: "a student",
    goal: "view a tutor's available session times",
    benefit: "I can choose a time before I book",
    precondition: "the student is viewing a tutor profile",
    trigger: "they open the tutor's availability",
    outcome: "available dates and times are displayed",
    alternateOutcome: "the tutor has no available slots and that is shown to the student",
  },
  {
    id: "REQ-BANK-001",
    title: "Transfer money between bank accounts",
    text: "An authenticated customer can transfer money from their bank account to another valid account, provided the account has sufficient available funds and the transfer complies with the bank's rules.",
    validationStatus: "Validated",
    source: "Component 1 · Banking domain example",
    validatedAt: "2026-10-12",
    actor: "a banking customer",
    goal: "transfer money to another bank account",
    benefit: "I can make payments conveniently and securely",
    precondition: "the customer is authenticated, the source account is active, the destination account is valid, and the customer has sufficient available funds",
    trigger: "the customer submits a valid transfer request",
    outcome: "the system processes the transfer according to the bank's approved transfer rules and displays the transaction result and reference number",
    alternateOutcome: "the system rejects a transfer that does not satisfy the bank's approved rules without processing it",
  },
];

export const EMPTY_PROJECT_CONTEXT: ProjectContext = {
  actor: "",
  featureModule: "",
  businessGoal: "",
  relatedRequirements: "",
  existingSystemContext: "",
  additionalConstraints: "",
};

const INVEST_NAMES = ["I — Independent", "N — Negotiable", "V — Valuable", "E — Estimable", "S — Small", "T — Testable"];

function qualityAssessments(candidateIndex: number): QualityAssessment[] {
  const values = [
    [
      [0.94, "Uses one actor, one action and one outcome; the wording is direct."],
      [0.88, "Captures the primary user goal and benefit from the validated requirement."],
      [0.96, "The story and criteria stay within the stated requirement."],
      [0.92, "Each criterion describes an observable result that can be checked."],
      [0.83, "Meets most INVEST checks; splitting availability conflict handling may improve independence."],
    ],
    [
      [0.82, "The goal is understandable, though the booking confirmation outcome could be more explicit."],
      [0.76, "Focuses on the core booking path and leaves alternate outcomes to the criteria."],
      [0.91, "No new business rules are added beyond the source requirement."],
      [0.84, "The main flow is verifiable; the shorter phrasing leaves some detail to the criteria."],
      [0.78, "The scope is small and valuable; more detail would help estimation."],
    ],
    [
      [0.88, "Names the user and goal clearly, with a concise benefit statement."],
      [0.91, "Includes both successful booking and an unavailable-slot response."],
      [0.89, "Criteria reflect the source requirement, but availability handling should be confirmed with the Product Owner."],
      [0.95, "The alternate path is observable and can be tested independently."],
      [0.88, "The story is valuable and testable; confirm the alternate path is in scope before planning."],
    ],
  ];
  const labels = ["Clarity", "Completeness", "Consistency", "Testability", "INVEST"] as const;
  const keys = ["clarity", "completeness", "consistency", "testability", "invest"] as const;
  return values[candidateIndex].map(([score, rationale], index) => ({
    key: keys[index],
    label: labels[index],
    score: score as number,
    rationale: rationale as string,
  }));
}

export function evaluateInvestLocally(
  userStory: string,
  criteria: AcceptanceCriterion[] = [],
): InvestAssessment[] {
  const story = userStory.trim();
  const hasRole = /^As\s+.+?,\s*I\s+(?:want|need)\s+/i.test(story);
  const hasBenefit = /\bso that\b/i.test(story) && story.split(/\bso that\b/i)[1]?.trim().length > 4;
  const dependsOnOtherWork = /\b(depends on|after (?:the )?other|blocked by|requires another story)\b/i.test(story);
  const implementationLocked = /\b(must use|implemented with|using (?:the )?(?:database|framework|library|service))\b/i.test(story);
  const criteriaTestable = criteria.length > 0 && criteria.every((criterion) =>
    criterion.given.trim() && criterion.when.trim() && criterion.then.trim(),
  );
  const overlyBroad = /\b(and|as well as)\b/i.test(story.split(/\bso that\b/i)[0] ?? "");

  const results: Array<Omit<InvestAssessment, "met">> = [
    {
      name: INVEST_NAMES[0],
      status: !hasRole ? "Fail" : dependsOnOtherWork ? "Warning" : "Pass",
      rationale: !hasRole ? "The story does not identify a clear user role and goal." : dependsOnOtherWork ? "The story refers to dependency on other work." : "The story expresses one role and goal without stating a dependency.",
      recommendation: !hasRole ? "Use one clear user role and goal from the validated requirement." : dependsOnOtherWork ? "Confirm and document dependencies with the team." : "Confirm sequencing and dependencies with the team during refinement.",
    },
    {
      name: INVEST_NAMES[1],
      status: implementationLocked ? "Fail" : "Warning",
      rationale: implementationLocked ? "The story prescribes a technical implementation." : "Negotiability depends on discussion with the Product Owner and delivery team.",
      recommendation: implementationLocked ? "Describe the user outcome and move implementation constraints to approved technical notes." : "Have the Product Owner and team confirm implementation choices remain open.",
    },
    {
      name: INVEST_NAMES[2],
      status: hasBenefit ? "Pass" : "Fail",
      rationale: hasBenefit ? "The story states a user benefit after “so that”." : "The story does not state a clear user benefit.",
      recommendation: hasBenefit ? "Confirm the stated benefit matches the validated requirement." : "Add a benefit supported by the validated requirement.",
    },
    {
      name: INVEST_NAMES[3],
      status: "Not Assessed",
      rationale: "Effort estimation requires the delivery team's shared understanding and is not inferred by this prototype.",
      recommendation: "Discuss scope and unresolved questions with the team before estimating.",
    },
    {
      name: INVEST_NAMES[4],
      status: overlyBroad ? "Warning" : "Not Assessed",
      rationale: overlyBroad ? "The story contains multiple goals that may need splitting." : "Story size depends on team capacity, architecture, and delivery context.",
      recommendation: overlyBroad ? "Consider splitting distinct user outcomes into independently valuable stories." : "Ask the team to confirm this can be completed within one iteration.",
    },
    {
      name: INVEST_NAMES[5],
      status: criteriaTestable ? "Pass" : "Fail",
      rationale: criteriaTestable ? "Every current acceptance criterion has non-empty Given, When, and Then steps." : "The current criteria are missing or have incomplete Given–When–Then steps.",
      recommendation: criteriaTestable ? "Review that each expected outcome is observable and independently verifiable." : "Add complete, observable Given–When–Then criteria.",
    },
  ];

  return results.map((item) => ({ ...item, met: item.status === "Pass" }));
}

export function optimizeUserStoryLocally(userStory: string, requirement: ValidatedRequirement): {
  optimizedStory: string;
  changed: boolean;
  explanation: string;
} {
  const normalized = userStory.trim().replace(/\s+/g, " ").replace(/[.!?]*$/, "");
  const hasStoryFormat = /^As\s+.+?,\s*I\s+(?:want|need)\s+.+?\s+so that\s+.+$/i.test(normalized);
  const optimizedStory = hasStoryFormat
    ? `${normalized}.`
    : requirement.actor.trim() && requirement.goal.trim() && requirement.benefit.trim()
      ? `As ${requirement.actor.trim()}, I want to ${requirement.goal.trim()}, so that ${requirement.benefit.trim().replace(/^I\s+/i, "I ")}.`
      : userStory.trim();
  const changed = optimizedStory !== userStory;
  return {
    optimizedStory,
    changed,
    explanation: changed
      ? hasStoryFormat
        ? "Normalized spacing and punctuation without changing the story's meaning."
        : "Restored the user-story format using only the validated requirement's role, goal, and benefit."
      : "No safe formatting improvement was identified. Review the story wording manually.",
  };
}

function makeCriteria(requirement: ValidatedRequirement): AcceptanceCriterion[] {
  return createDetailedAcceptanceCriteria(requirement);
}

type CriterionScenario = Pick<AcceptanceCriterion, "title" | "given" | "when" | "then" | "priority" | "category">;

function createDetailedAcceptanceCriteria(requirement: ValidatedRequirement): AcceptanceCriterion[] {
  let scenarios: CriterionScenario[];
  switch (requirement.id) {
    case "REQ-BANK-001":
      scenarios = [
        { title: "Successful transfer", given: "the customer is authenticated, the source account is active, the destination account is valid, and the customer has sufficient available funds", when: "the customer submits a valid transfer request", then: "the system processes the transfer according to the bank's approved transfer rules and displays the transaction result and reference number", priority: "High", category: "Functional" },
        { title: "Require authentication", given: "the customer is not authenticated", when: "the customer attempts to initiate a transfer", then: "the request is rejected and authentication is required without disclosing sensitive account information", priority: "High", category: "Security" },
        { title: "Validate transfer amount", given: "the customer is authenticated", when: "the customer enters a missing, non-numeric, zero, or negative transfer amount", then: "the request is rejected with an appropriate validation message and no transfer is processed", priority: "High", category: "Validation" },
        { title: "Reject insufficient funds", given: "the source account does not have sufficient available funds", when: "the customer submits the transfer", then: "the transfer is rejected and both account balances remain unchanged", priority: "High", category: "Business Rule" },
        { title: "Reject an invalid destination", given: "the destination account is invalid or ineligible for the requested transfer", when: "the customer submits the transfer", then: "the request is rejected with an appropriate error and the transaction is not processed", priority: "High", category: "Validation" },
      ];
      break;
    case "REQ-104":
      scenarios = [
        { title: "Book an available session", given: "the student is viewing a tutor with an available time slot", when: "the student selects the tutor, date, and time and confirms the booking", then: "the session is reserved and a booking confirmation is shown", priority: "High", category: "Functional" },
        { title: "Handle a slot that is no longer available", given: "the selected time slot has been booked by someone else", when: "the student confirms the booking", then: "the session is not double-booked and the student is asked to choose another available slot", priority: "High", category: "Error Handling" },
      ];
      break;
    case "REQ-117":
      scenarios = [
        { title: "Show upcoming session details", given: "the student has upcoming tutoring sessions", when: "the student opens upcoming sessions", then: "each upcoming session shows its tutor name, date, time, and status", priority: "High", category: "Functional" },
        { title: "Show an empty state when no sessions are scheduled", given: "the student has no upcoming tutoring sessions", when: "the student opens upcoming sessions", then: "an empty state explains that there are no upcoming sessions", priority: "Medium", category: "Error Handling" },
      ];
      break;
    case "REQ-129":
      scenarios = [
        { title: "Add an available time slot", given: "the tutor is signed in and viewing availability settings", when: "the tutor adds a date and time slot and saves", then: "the new time slot is saved and shown as available to students", priority: "High", category: "Functional" },
        { title: "Remove an unbooked time slot", given: "the tutor is signed in and the time slot has no booking", when: "the tutor removes the slot and saves", then: "the slot is removed from availability shown to students", priority: "Medium", category: "Functional" },
        { title: "Protect a slot with an existing booking", given: "the time slot has an existing student booking", when: "the tutor attempts to remove the slot", then: "the slot is not removed and the tutor is prompted to resolve the existing booking", priority: "High", category: "Business Rule" },
      ];
      break;
    case "REQ-132":
      scenarios = [
        { title: "Cancel a session before it starts", given: "the student has a booked session whose start time is in the future", when: "the student confirms cancellation", then: "the session status changes to cancelled", priority: "High", category: "Functional" },
        { title: "Prevent cancellation after a session starts", given: "the booked session has already started", when: "the student attempts to cancel it", then: "the session remains unchanged and cancellation is unavailable", priority: "High", category: "Business Rule" },
      ];
      break;
    case "REQ-141":
      scenarios = [
        { title: "Filter tutors by the selected subject", given: "the student is viewing the tutor list and tutors teach different subjects", when: "the student selects a subject filter", then: "only tutors who teach the selected subject are shown", priority: "High", category: "Functional" },
        { title: "Show when no tutors match a subject", given: "no tutor teaches the selected subject", when: "the student applies the subject filter", then: "an empty result message is shown and no non-matching tutor is listed", priority: "Medium", category: "Error Handling" },
      ];
      break;
    case "REQ-155":
      scenarios = [
        { title: "Share a resource with an enrolled student", given: "the tutor and student share a scheduled session and the resource is available", when: "the tutor selects the resource and shares it", then: "the student can view the shared resource", priority: "High", category: "Functional" },
        { title: "Handle an unavailable resource", given: "the tutor and student share a scheduled session but the selected resource is unavailable", when: "the tutor attempts to share it", then: "the resource is not shared and the tutor is told it was unavailable", priority: "Medium", category: "Error Handling" },
      ];
      break;
    case "REQ-161":
      scenarios = [
        { title: "Record a rating for a completed session", given: "the student has a completed session without a submitted rating", when: "the student submits a rating", then: "the rating is recorded against that session", priority: "High", category: "Functional" },
        { title: "Prevent rating an incomplete session", given: "the tutoring session is not complete", when: "the student attempts to submit a rating", then: "the rating is not recorded and the student is informed that the session must be completed first", priority: "Medium", category: "Business Rule" },
      ];
      break;
    case "REQ-173":
      scenarios = [
        { title: "Display available dates and times", given: "the student is viewing a tutor profile with available session slots", when: "the student opens the tutor's availability", then: "the available session dates and times are displayed before booking", priority: "High", category: "Functional" },
        { title: "Show when no slots are available", given: "the tutor has no available session slots", when: "the student opens the tutor's availability", then: "the student is informed that no slots are currently available", priority: "Medium", category: "Error Handling" },
      ];
      break;
    default:
      scenarios = [
        { title: "Complete the requested outcome", given: requirement.precondition, when: requirement.trigger, then: requirement.outcome, priority: "High", category: "Functional" },
        { title: "Handle the stated alternate outcome", given: requirement.precondition, when: "the stated alternate condition occurs", then: requirement.alternateOutcome, priority: "Medium", category: "Error Handling" },
      ];
  }

  const normalized = scenarios.map((scenario) => ({
    ...scenario,
    given: scenario.given.trim(),
    when: scenario.when.trim(),
    then: scenario.then.trim(),
  })).filter((scenario) => scenario.given && scenario.when && scenario.then);
  const unique = normalized.filter((scenario, index) => normalized.findIndex((candidate) =>
    candidate.given.toLowerCase() === scenario.given.toLowerCase()
    && candidate.when.toLowerCase() === scenario.when.toLowerCase()
    && candidate.then.toLowerCase() === scenario.then.toLowerCase(),
  ) === index);

  return unique.map((scenario, index) => ({
    id: `AC${index + 1}`,
    ...scenario,
    status: "Draft",
    ...(requirement.id === "REQ-BANK-001" && index === 2
      ? { decisionRequired: "Confirm accepted amount format, minimum, precision, and boundary rules with the bank." }
      : requirement.id === "REQ-BANK-001" && index === 4
        ? { decisionRequired: "Confirm which destination-account types are valid or eligible under approved bank rules." }
        : {}),
  }));
}

function makeCandidate(requirement: ValidatedRequirement, index: number, generationId: string): StoryCandidate {
  const storyForms = [
    `As ${requirement.actor}, I want to ${requirement.goal}, so that ${requirement.benefit.replace(/^I /, "I ")}.`,
    `As ${requirement.actor}, I need to ${requirement.goal} so I can achieve the intended outcome.`,
    `As ${requirement.actor}, I want to ${requirement.goal} with a clear response when the requested option is unavailable, so that ${requirement.benefit.replace(/^I /, "I ")}.`,
  ];
  const labels = ["Balanced option", "Minimal option", "Edge-case option"];
  const unsupported: StoryCandidate["unsupportedAssumptions"][] = [
    [],
    [{ assumption: "Students already have an account.", why: "The requirement does not specify whether account creation or guest booking is in scope." }],
    [{ assumption: "Unavailable selections must be handled in this story.", why: "The source requirement does not state whether conflict handling belongs in this scope." }],
  ];
  return {
    id: `${generationId}-candidate-${index + 1}`,
    storyId: `${requirement.id}-S${index + 1}`,
    label: labels[index],
    userStory: storyForms[index],
    acceptanceCriteria: makeCriteria(requirement),
    assessment: qualityAssessments(index),
    invest: evaluateInvestLocally(storyForms[index], makeCriteria(requirement)),
    unsupportedAssumptions: unsupported[index],
  };
}

export function createDemoGeneration(requirement: ValidatedRequirement): GenerationRecord {
  const id = `demo-${requirement.id}`;
  const candidates = [0, 1, 2].map((index) => makeCandidate(requirement, index, id));
  return {
    id,
    requirementId: requirement.id,
    requirementText: requirement.text,
    context: { ...EMPTY_PROJECT_CONTEXT },
    projectId: null,
    createdAt: new Date().toISOString(),
    candidates,
    selectedCandidateId: candidates[0].id,
    draft: draftFromCandidate(candidates[0]),
  };
}

export function draftFromCandidate(candidate: StoryCandidate): StoryDraft {
  return {
    userStory: candidate.userStory,
    acceptanceCriteria: candidate.acceptanceCriteria.map((criterion) => ({ ...criterion })),
  };
}

export function getMockImprovementRecommendations(candidate: StoryCandidate, context?: ProjectContext): string[] {
  const recommendations: string[] = [];
  const completeness = candidate.assessment.find((item) => item.key === "completeness")?.score ?? 1;
  const clarity = candidate.assessment.find((item) => item.key === "clarity")?.score ?? 1;

  if (candidate.storyId.startsWith("REQ-104")) recommendations.push("Define what happens when no session is available.");
  if (candidate.storyId.startsWith("REQ-132")) recommendations.push("Specify which user role is allowed to cancel the booking.");
  if (completeness < 0.9) recommendations.push("State the expected result and any important alternate outcomes.");
  if (clarity < 0.9) recommendations.push("Name the user's goal and intended benefit in direct language.");
  if (candidate.unsupportedAssumptions.length) recommendations.push("Confirm or remove details that are not stated in the validated requirement.");
  if (context?.businessGoal.trim()) recommendations.push(`Check that the story supports the project goal: ${context.businessGoal.trim()}`);
  if (context?.featureModule.trim()) recommendations.push(`Confirm the story belongs in the ${context.featureModule.trim()} module without expanding the validated scope.`);
  if (context?.relatedRequirements.trim()) recommendations.push(`Check dependencies against related requirements: ${context.relatedRequirements.trim()}`);
  if (context?.existingSystemContext.trim()) recommendations.push("Verify the story and criteria match the existing system workflow and roles.");
  if (context?.additionalConstraints.trim()) recommendations.push(`Validate the criteria against this project constraint: ${context.additionalConstraints.trim()}`);

  return [...new Set(recommendations)];
}

export async function generateCandidates(request: GenerateRequest): Promise<GenerationResult> {
  await new Promise((resolve) => window.setTimeout(resolve, 550));
  const id = `generation-${Date.now()}`;
  const contextualRequirement = request.context.actor.trim()
    ? { ...request.requirement, actor: request.context.actor.trim() }
    : request.requirement;
  const candidates = [0, 1, 2].map((index) => makeCandidate(contextualRequirement, index, id));
  return {
    id,
    requirementId: request.requirement.id,
    requirementText: request.requirement.text,
    context: request.context,
    projectId: request.projectId,
    createdAt: new Date().toISOString(),
    candidates,
    selectedCandidateId: candidates[0].id,
    draft: draftFromCandidate(candidates[0]),
  };
}

export async function generateAcceptanceCriteria(candidate: StoryCandidate): Promise<AcceptanceCriterion[]> {
  await new Promise((resolve) => window.setTimeout(resolve, 350));
  return candidate.acceptanceCriteria.map((criterion) => ({ ...criterion }));
}

export function createMockAcceptanceCriteria(requirement: ValidatedRequirement): AcceptanceCriterion[] {
  return createDetailedAcceptanceCriteria(requirement).map((criterion) => ({ ...criterion }));
}

export async function generateMockAcceptanceCriteria(
  requirement: ValidatedRequirement,
): Promise<AcceptanceCriterion[]> {
  await new Promise((resolve) => window.setTimeout(resolve, 450));
  return createMockAcceptanceCriteria(requirement);
}

function optimizationFinding(
  id: string,
  area: string,
  status: OptimizationFinding["status"],
  summary: string,
  details: string,
): OptimizationFinding {
  return { id, area, status, summary, details };
}

function hasTerms(criteria: AcceptanceCriterion[], terms: string[]): boolean {
  const text = criteria.map((criterion) => `${criterion.title ?? ""} ${criterion.given} ${criterion.when} ${criterion.then}`).join(" ").toLowerCase();
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function criterionFingerprint(criterion: AcceptanceCriterion): string {
  return [criterion.given, criterion.when, criterion.then]
    .map((value) => value.trim().replace(/\s+/g, " ").toLowerCase())
    .join("|");
}

export function analyzeAcceptanceCriteriaLocally(
  requirement: ValidatedRequirement,
  context: ProjectContext,
  criteria: AcceptanceCriterion[],
  userFeedback = "",
): OptimizationFinding[] {
  const findings: OptimizationFinding[] = [];
  const isBanking = requirement.id === "REQ-BANK-001";
  const related = context.relatedRequirements.trim();
  const constraints = context.additionalConstraints.trim();
  const domainContext = context.featureModule.trim() || context.existingSystemContext.trim();
  const feedback = userFeedback.trim();

  findings.push(optimizationFinding(
    "context",
    "Context analysis",
    isBanking ? "Needs Human Decision" : related || constraints || domainContext ? "Pass" : "Warning",
    "Roles, rules, constraints, and related context",
    isBanking
      ? `Role: ${requirement.actor}. Stated rules: active source account, valid destination, sufficient available funds, and compliance with bank rules. ${related ? `Related requirements: ${related}.` : "No related requirements supplied."} ${constraints ? `Provided constraints (approval status must be confirmed): ${constraints}.` : "No bank-specific constraints or policy details supplied; clarify them before approval."} ${feedback ? `Reviewer feedback to assess: ${feedback}` : "No reviewer feedback supplied."}`
      : `Role in requirement: ${requirement.actor}. Stated business rules: ${requirement.alternateOutcome}. ${related ? `Related requirements: ${related}.` : "No related requirements supplied."} ${constraints ? `Constraints: ${constraints}.` : "No additional constraints supplied."} ${domainContext ? `Domain context: ${domainContext}.` : "No project domain context supplied."} ${feedback ? `Reviewer feedback to assess: ${feedback}` : "No reviewer feedback supplied."}`,
  ));

  if (isBanking) {
    const required = [
      ["authentication", ["authenticated", "authentication"]],
      ["available funds", ["sufficient available funds", "insufficient available funds"]],
      ["destination account validity", ["destination account is valid", "destination account is invalid"]],
      ["approved bank rules", ["bank's approved transfer rules", "bank has configured transfer limits"]],
    ];
    const missing = required.filter(([, terms]) => !hasTerms(criteria, terms as string[])).map(([label]) => label);
    findings.push(optimizationFinding(
      "coverage",
      "Coverage analysis",
      missing.length ? "Missing" : "Pass",
      missing.length ? "Important requirement behaviours are not covered" : "Key requirement behaviours are covered",
      missing.length ? `Add or clarify criteria for: ${missing.join(", ")}.` : "Criteria address authentication, available funds, destination validity, and bank-rule compliance.",
    ));
    const securityChecks = [
      ["authentication", ["authentication"]],
      ["source-account authorization", ["authorized to access the source account"]],
      ["input validation", ["validation message"]],
      ["transaction integrity", ["transaction remains consistent"]],
      ["sensitive data protection", ["excludes passwords"]],
    ];
    const missingSecurity = securityChecks.filter(([, terms]) => !hasTerms(criteria, terms as string[])).map(([label]) => label);
    findings.push(optimizationFinding(
      "security",
      "Security and validation",
      missingSecurity.length ? "Missing" : "Pass",
      missingSecurity.length ? "Security or validation coverage needs attention" : "Authentication, authorization, validation, integrity, and sensitive-data checks are represented",
      missingSecurity.length ? `Review coverage for: ${missingSecurity.join(", ")}. Do not infer bank-specific controls.` : "These checks are present in the criteria; implementation and policy compliance still require verification.",
    ));
    findings.push(optimizationFinding(
      "bank-policy",
      "Unsupported assumptions",
      "Needs Human Decision",
      "Confirm bank-specific policies before adding policy-specific criteria",
      "The source requirement does not define idempotency rules, failure/rollback semantics, source-account authorization, audit-field allowlists, transfer thresholds, or additional authorization. These are flagged for product/security review rather than added as acceptance criteria.",
    ));
  } else {
    const terms = [requirement.goal.split(/\s+/).slice(0, 2).join(" "), requirement.outcome.split(/\s+/).slice(0, 3).join(" ")].filter(Boolean);
    const covered = terms.every((term) => hasTerms(criteria, [term]));
    findings.push(optimizationFinding(
      "coverage",
      "Coverage analysis",
      covered ? "Pass" : "Warning",
      covered ? "Core outcome appears in acceptance criteria" : "Check criteria against the requirement's stated outcome",
      covered ? "The selected requirement's goal and outcome are represented by the current criteria." : "The local prototype could not match every key phrase; review the requirement and fill any actual coverage gaps.",
    ));
    findings.push(optimizationFinding(
      "security",
      "Security and validation",
      "Needs Human Decision",
      "Confirm whether security or validation criteria apply",
      "No approved security, authentication, authorization, or input-validation rules were supplied for this requirement; do not invent them.",
    ));
  }

  const incomplete = criteria.filter((criterion) => !criterion.title?.trim() || !criterion.given.trim() || !criterion.when.trim() || !criterion.then.trim());
  const noObservableOutcome = criteria.filter((criterion) => !criterion.then.trim() || /\b(appropriate|properly|as expected)\b/i.test(criterion.then));
  const vagueSteps = criteria.filter((criterion) => /\b(something|somehow|as needed|relevant)\b/i.test(`${criterion.given} ${criterion.when} ${criterion.then}`));
  findings.push(optimizationFinding("quality-completeness", "Quality · Completeness", incomplete.length ? "Warning" : "Pass", incomplete.length ? "Some criteria have a missing title or Given–When–Then step" : "Every criterion has a title and all three steps", `${incomplete.length} incomplete criterion(s).`));
  findings.push(optimizationFinding("quality-clarity", "Quality · Clarity and specificity", noObservableOutcome.length || vagueSteps.length ? "Warning" : "Pass", noObservableOutcome.length || vagueSteps.length ? "Review vague language and observable outcomes" : "Outcomes are stated without the prototype's known vague phrases", `${noObservableOutcome.length} possibly unobservable outcome(s); ${vagueSteps.length} step(s) contain broad wording. These are phrase checks, not semantic analysis.`));
  findings.push(optimizationFinding("quality-consistency", "Quality · Consistency", "Needs Human Decision", "Confirm criteria agree with one another and the approved domain rules", "The prototype does not infer semantic contradictions or access authoritative policy; compare the criteria and approved context manually."));
  findings.push(optimizationFinding("quality-testability", "Quality · Testability", incomplete.length || noObservableOutcome.length ? "Warning" : "Pass", incomplete.length || noObservableOutcome.length ? "Some Given–When–Then steps need completion" : "Each criterion has non-empty Given–When–Then steps", "This only checks that the steps are present and screens for a few vague phrases. It does not run tests."));

  const duplicateCount = criteria.filter((criterion) => criterion.given.trim() && criterion.when.trim() && criterion.then.trim())
    .reduce((total, criterion, index, completeCriteria) => total + (completeCriteria.findIndex((candidate) =>
      criterionFingerprint(candidate) === criterionFingerprint(criterion),
    ) < index ? 1 : 0), 0);
  findings.push(optimizationFinding(
    "duplicates",
    "Duplicate detection",
    duplicateCount ? "Warning" : "Pass",
    duplicateCount ? `${duplicateCount} exact duplicate criterion(s) found` : "No exact duplicate criteria found",
    duplicateCount ? "Matching Given–When–Then text can be consolidated; review partial overlap manually." : "No criteria have identical normalized Given–When–Then steps. Similar intent still needs human review.",
  ));

  const humanDecisions = criteria.filter((criterion) => criterion.decisionRequired);
  const decisionDetails = [
    ...humanDecisions.map((criterion) => `${criterion.id}: ${criterion.decisionRequired}`),
    ...(feedback ? [`Reviewer feedback: ${feedback}`] : []),
  ];
  findings.push(optimizationFinding(
    "assumptions",
    "Unsupported-assumption detection",
    decisionDetails.length ? "Needs Human Decision" : "Pass",
    humanDecisions.length ? `${humanDecisions.length} criterion(s) depend on unconfirmed policy` : feedback ? "Reviewer feedback must be assessed before it is treated as approved context" : "No explicitly flagged unsupported assumptions",
    decisionDetails.length
      ? `${decisionDetails.join(" ")} The prototype does not assume reviewer feedback is an approved business rule.`
      : "No additional unsupported policy assumptions were detected by these prototype checks.",
  ));

  return findings;
}

export function optimizeAcceptanceCriteriaLocally(
  requirement: ValidatedRequirement,
  context: ProjectContext,
  criteria: AcceptanceCriterion[],
  userFeedback = "",
): LocalOptimizationResult {
  const findings = analyzeAcceptanceCriteriaLocally(requirement, context, criteria, userFeedback);
  const seen = new Set<string>();
  const optimizedCriteria: AcceptanceCriterion[] = [];
  const changes: LocalOptimizationResult["changes"] = [];

  for (const criterion of criteria) {
    const normalized: AcceptanceCriterion = {
      ...criterion,
      title: criterion.title?.trim().replace(/\s+/g, " "),
      given: criterion.given.trim().replace(/\s+/g, " "),
      when: criterion.when.trim().replace(/\s+/g, " "),
      then: criterion.then.trim().replace(/\s+/g, " "),
    };
    const complete = Boolean(normalized.given && normalized.when && normalized.then);
    const fingerprint = criterionFingerprint(normalized);
    if (complete && seen.has(fingerprint)) {
      changes.push({
        criterionId: criterion.id,
        original: criterion,
        optimized: null,
        explanation: "Removed as an exact duplicate of an earlier Given–When–Then criterion.",
      });
      continue;
    }
    if (complete) seen.add(fingerprint);
    const changed = normalized.title !== criterion.title
      || normalized.given !== criterion.given
      || normalized.when !== criterion.when
      || normalized.then !== criterion.then;
    if (changed) {
      normalized.status = "Optimized";
      changes.push({
        criterionId: criterion.id,
        original: criterion,
        optimized: normalized,
        explanation: "Trimmed surrounding whitespace and normalized repeated spaces without changing the criterion's meaning.",
      });
    }
    optimizedCriteria.push(normalized);
  }

  findings.push(optimizationFinding(
    "optimization",
    "Local optimization",
    changes.length ? "Warning" : "Pass",
    changes.length ? `${changes.length} wording or duplicate change(s) proposed` : "No safe wording cleanup or exact duplicate removal was needed",
    changes.length ? "Only deterministic whitespace cleanup and exact duplicate removal were applied. Missing behaviours and policy questions remain for human review." : "The prototype did not change any criteria. Review findings manually before treating them as complete.",
  ));

  return {
    findings,
    changes,
    originalCriteria: criteria.map((criterion) => ({ ...criterion })),
    optimizedCriteria,
  };
}

export function readGenerationHistory(): GenerationRecord[] {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(HISTORY_KEY);
  } catch {
    return [];
  }
  if (stored === previousHistoryJson) return historySnapshot;
  previousHistoryJson = stored;
  try {
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    historySnapshot = Array.isArray(parsed) ? (parsed as GenerationRecord[]) : [];
  } catch {
    historySnapshot = [];
  }
  return historySnapshot;
}

export function subscribeToGenerationHistory(onChange: () => void): () => void {
  const invalidate = () => {
    previousHistoryJson = undefined;
    onChange();
  };
  window.addEventListener("storage", invalidate);
  window.addEventListener(HISTORY_EVENT, invalidate);
  return () => {
    window.removeEventListener("storage", invalidate);
    window.removeEventListener(HISTORY_EVENT, invalidate);
  };
}

export function getServerGenerationHistory(): GenerationRecord[] {
  return SERVER_HISTORY;
}

export function saveGeneration(record: GenerationRecord): GenerationRecord[] {
  const history = readGenerationHistory().filter((entry) => entry.id !== record.id);
  const next = [record, ...history].slice(0, 20);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  previousHistoryJson = undefined;
  window.dispatchEvent(new Event(HISTORY_EVENT));
  return next;
}

export function approveGeneration(
  record: GenerationRecord,
  draft: StoryDraft,
  reviewer: string,
  decisionNotes: string,
  investAssessment: InvestAssessment[],
): GenerationRecord[] {
  const approvedAt = new Date().toISOString();
  const approvedDraft = {
    userStory: draft.userStory.trim(),
    acceptanceCriteria: draft.acceptanceCriteria.map((criterion) => ({ ...criterion })),
  };
  const approvedPackage = {
    requirementId: record.requirementId,
    userStory: approvedDraft.userStory,
    acceptanceCriteria: approvedDraft.acceptanceCriteria,
    investAssessment: investAssessment.map((item) => ({ ...item })),
    approvalStatus: "Approved" as const,
    reviewer: reviewer.trim(),
    decisionNotes: decisionNotes.trim(),
    approvedAt,
    persistence: "prototype" as const,
  };
  return saveGeneration({
    ...record,
    draft: approvedDraft,
    status: "Approved",
    approvedDraft,
    approvedAt,
    approvedPackage,
    reviewMetadata: { reviewer: reviewer.trim(), decision: "Approved", decidedAt: approvedAt, persistence: "prototype", decisionNotes: decisionNotes.trim() },
  });
}

export function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}