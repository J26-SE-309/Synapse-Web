import { CheckIcon, CircleHelpIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";
import type { UserStoryCandidate } from "../_lib/types";
import { AssumptionList, QualityEvaluation, QualityScore, UserStoryCard } from "./StoryComponents";

export function CandidateCard({
  candidate,
  selected,
  onSelect,
}: {
  candidate: UserStoryCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const overall = candidate.assessment.reduce((total, dimension) => total + dimension.score, 0) / candidate.assessment.length;
  return (
    <Card className={selected ? "border-primary ring-1 ring-primary/30" : undefined}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-sm bg-muted font-mono text-xs">{candidate.storyId.slice(-1)}</span>
            <div>
              <p className="text-xs text-muted-foreground">{candidate.storyId}</p>
              <CardTitle className="mt-0.5 text-sm">{candidate.label}</CardTitle>
            </div>
          </div>
          <QualityScore label="Mean score" score={overall} overall />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <UserStoryCard story={{ storyId: candidate.storyId, requirementId: candidate.storyId.split("-S")[0], text: candidate.userStory }} title="Generated User Story" />
        <QualityEvaluation scores={candidate.assessment} />
        <AssumptionList assumptions={candidate.unsupportedAssumptions} />
      </CardContent>
      <CardFooter>
        <Button type="button" variant={selected ? "secondary" : "outline"} size="sm" onClick={onSelect} aria-pressed={selected} className="w-full">
          {selected ? <CheckIcon aria-hidden /> : <CircleHelpIcon aria-hidden />}
          {selected ? "Selected for review" : "Review this candidate"}
        </Button>
      </CardFooter>
    </Card>
  );
}