/**
 * The four platform components, in pipeline order.
 * Each one owns src/app/(modules)/<slug>/ and contracts/<slug>/ in this repository
 * (see .github/ownership.json).
 */
export type ModuleSlug = "requirement-quality" | "story-refinement" | "traceability" | "effort-estimation";

export interface PlatformModule {
  slug: ModuleSlug;
  name: string;
  shortName: string;
  /** GitHub username of the developer who owns this module. */
  owner: string;
  description: string;
  /** Port of the component's own API service during local development. */
  apiPort: number;
}

export const MODULES: readonly PlatformModule[] = [
  {
    slug: "requirement-quality",
    name: "Requirement Quality and Ambiguity Analyzer",
    shortName: "Requirement Quality",
    owner: "AmaLiyanage",
    description: "Checks raw requirements for quality problems, ambiguity, vagueness and interpretation stability.",
    apiPort: 8001,
  },
  {
    slug: "story-refinement",
    name: "User Story Refinement and Acceptance Criteria Generator",
    shortName: "Story Refinement",
    owner: "lewkes",
    description: "Turns validated requirements into user stories with testable acceptance criteria.",
    apiPort: 8002,
  },
  {
    slug: "traceability",
    name: "Requirement Traceability Engine",
    shortName: "Traceability",
    owner: "dinuwa2500",
    description: "Links stories to the code and tests that implement them and reports coverage.",
    apiPort: 8003,
  },
  {
    slug: "effort-estimation",
    name: "Effort Estimation and Sprint Risk Predictor",
    shortName: "Effort & Sprint Risk",
    owner: "Nikeshala22",
    description: "Estimates story effort and sprint risk with calibrated confidence and planning recommendations.",
    apiPort: 8004,
  },
];

export function getModule(slug: ModuleSlug): PlatformModule {
  const found = MODULES.find((entry) => entry.slug === slug);
  if (!found) {
    throw new Error(`Unknown module: ${slug}`);
  }
  return found;
}
