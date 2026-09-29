import type { ComponentType } from "react";

import { SprintEstimates } from "@/app/(modules)/effort-estimation/_components/SprintEstimates";
import { StoryEstimate, StoryRiskBadge } from "@/app/(modules)/effort-estimation/_components/StoryInsights";
import type { Sprint, Story } from "@/shared/backlog/types";
import type { ModuleSlug } from "@/shared/modules";
import type { Project } from "@/shared/projects/api";

/**
 * Where the components show their part of the platform's pages. A module builds each piece in its own folder
 * (src/app/(modules)/<slug>/_components/) and registers it here once, like its pages in navigation.ts.
 */

export interface SprintPanelProps {
  project: Project;
  sprint: Sprint;
  /** The stories in the sprint now (for a closed sprint: every story it ended with). */
  stories: Story[];
}

export interface StoryInsightProps {
  project: Project;
  story: Story;
}

interface Slot<Props> {
  slug: ModuleSlug;
  Component: ComponentType<Props>;
}

/** A panel below a sprint's backlog on the sprint's page. */
export const SPRINT_PANELS: Slot<SprintPanelProps>[] = [{ slug: "effort-estimation", Component: SprintEstimates }];

/** A small badge on a story's card and row (keep it to one word or number). */
export const STORY_BADGES: Slot<StoryInsightProps>[] = [{ slug: "effort-estimation", Component: StoryRiskBadge }];

/** A section in a story's details panel. */
export const STORY_PANELS: Slot<StoryInsightProps>[] = [{ slug: "effort-estimation", Component: StoryEstimate }];
