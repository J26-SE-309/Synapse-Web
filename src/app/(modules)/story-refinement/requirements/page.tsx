import type { Metadata } from "next";

import { ValidatedRequirementsView } from "../_components/ValidatedRequirementsView";

export const metadata: Metadata = { title: "Validated Requirements · Story Refinement" };

export default function ValidatedRequirementsPage() {
  return <ValidatedRequirementsView />;
}