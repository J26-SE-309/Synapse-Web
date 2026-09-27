"use client";

import { ChevronDownIcon } from "lucide-react";
import { Fragment, useState } from "react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import { percent } from "../_lib/format";
import type { Prediction } from "../_lib/types";
import { FeedbackControls } from "./FeedbackControls";
import { ConfidenceIndicator, EffortValue, RiskBadge } from "./indicators";
import { PredictionDetails } from "./PredictionDetails";

/** One row per story: effort, risk, confidence, the main factor, and the product owner's decision (FR19). */
export function StoryResults({
  projectId,
  predictions,
  titles,
}: {
  projectId: string;
  predictions: Prediction[];
  titles: Record<string, string>;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <span className="sr-only">Details</span>
            </TableHead>
            <TableHead>Story</TableHead>
            <TableHead>Effort</TableHead>
            <TableHead>Sprint risk</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead className="hidden xl:table-cell">Main factor</TableHead>
            <TableHead>Your decision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {predictions.map((prediction) => {
            const expanded = open.has(prediction.story_id);
            const title = titles[prediction.story_id] ?? prediction.story_id;
            const detailsId = `details-${prediction.story_id}`;
            const top = prediction.key_risk_reasons[0];
            return (
              <Fragment key={prediction.story_id}>
                <TableRow data-state={expanded ? "selected" : undefined} className="align-top">
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-expanded={expanded}
                      aria-controls={expanded ? detailsId : undefined}
                      aria-label={`${expanded ? "Hide" : "Show"} why for ${title}`}
                      onClick={() => toggle(prediction.story_id)}
                    >
                      <ChevronDownIcon aria-hidden className={cn("transition-transform", expanded && "rotate-180")} />
                    </Button>
                  </TableCell>
                  <TableCell className="max-w-80 min-w-48 whitespace-normal">
                    <p className="font-medium">{title}</p>
                    <p className="font-mono text-xs text-muted-foreground">{prediction.story_id}</p>
                  </TableCell>
                  <TableCell>
                    <EffortValue
                      value={prediction.predicted_story_points}
                      range={prediction.prediction_interval}
                      category={prediction.effort_category}
                      coverage={prediction.interval_coverage}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <RiskBadge level={prediction.sprint_risk_level} />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {percent(prediction.spillover_probability)} chance to spill over
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ConfidenceIndicator level={prediction.confidence_level} score={prediction.confidence_score} />
                  </TableCell>
                  <TableCell className="hidden max-w-56 whitespace-normal xl:table-cell">
                    {top ? (
                      <span className="text-sm">
                        {top.factor}{" "}
                        <span className="text-muted-foreground">
                          ({top.direction === "increases" ? "raises" : "lowers"} the risk)
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <FeedbackControls
                      projectId={projectId}
                      predictionId={prediction.prediction_id}
                      storyTitle={title}
                      predicted={prediction.predicted_story_points}
                    />
                  </TableCell>
                </TableRow>
                {expanded ? (
                  <TableRow id={detailsId} className="bg-muted/30 hover:bg-muted/30">
                    <TableCell />
                    <TableCell colSpan={6} className="py-4 whitespace-normal">
                      <PredictionDetails prediction={prediction} />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
