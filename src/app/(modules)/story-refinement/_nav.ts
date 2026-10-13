import {
  CheckSquare2Icon,
  ClipboardCheckIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  PencilRulerIcon,
  SparklesIcon,
  UserRoundCheckIcon,
} from "lucide-react";

import type { NavPage } from "@/shared/navigation";

export const STORY_REFINEMENT_PAGES: NavPage[] = [
  { href: "/story-refinement", title: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/story-refinement/requirements", title: "Validated Requirements", icon: CheckSquare2Icon },
  { href: "/story-refinement/candidates", title: "Story Generation", icon: SparklesIcon },
  { href: "/story-refinement/acceptance-criteria", title: "Acceptance Criteria", icon: ClipboardCheckIcon },
  { href: "/story-refinement/acceptance-criteria#local-optimization-heading", title: "Optimization", icon: PencilRulerIcon },
  { href: "/story-refinement/review", title: "Human Review", icon: UserRoundCheckIcon },
  { href: "/story-refinement/history", title: "History", icon: HistoryIcon },
];
