import type { ComponentType } from "react";

import { SprintEstimates } from "@/app/(modules)/effort-estimation/_components/SprintEstimates";
import type { Sprint, Story } from "@/shared/backlog/types";
import type { ModuleSlug } from "@/shared/modules";
import type { Project } from "@/shared/projects/api";

export interface SprintPanelProps {
  project: Project;
  sprint: Sprint;
  /** The stories in the sprint now (for a closed sprint: every story it ended with). */
  stories: Story[];
}

/**
 * What each component shows on a sprint's page, below the sprint backlog. A module builds its panel in its own
 * folder (src/app/(modules)/<slug>/_components/) and registers it here once, like its pages in navigation.ts.
 */
export const SPRINT_PANELS: { slug: ModuleSlug; Component: ComponentType<SprintPanelProps> }[] = [
  { slug: "effort-estimation", Component: SprintEstimates },
];
