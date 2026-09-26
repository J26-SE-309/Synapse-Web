import type { Metadata } from "next";

import { HistoryView } from "../_components/HistoryView";

export const metadata: Metadata = { title: "Team history · Effort & Sprint Risk" };

export default function TeamHistoryPage() {
  return <HistoryView />;
}
