import type { Metadata } from "next";

import { BacklogView } from "@/shared/backlog/BacklogView";

export const metadata: Metadata = { title: "Backlog" };

export default function BacklogPage() {
  return <BacklogView />;
}
