"use client";

import { PlusIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { describeError } from "@/shared/api/gateway";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Spinner } from "@/shared/ui/spinner";

import { useUpdateStory } from "./api";
import { formatPoints, SyntheticBadge } from "./badges";
import { totalPoints, type Sprint, type Story } from "./types";

/** Choose backlog stories for a sprint. Added to an active sprint, they count as added mid-sprint. */
export function AddStoriesDialog({ projectId, sprint, backlog }: { projectId: string; sprint: Sprint; backlog: Story[] }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const update = useUpdateStory(projectId);
  const ids = useId();
  const picked = backlog.filter((story) => chosen.has(story.story_id));

  function reset(next: boolean) {
    setOpen(next);
    if (!next) setChosen(new Set());
  }

  function toggle(storyId: string, checked: boolean) {
    setChosen((current) => {
      const next = new Set(current);
      if (checked) next.add(storyId);
      else next.delete(storyId);
      return next;
    });
  }

  async function add() {
    setSaving(true);
    const failed: string[] = [];
    for (const story of picked) {
      try {
        await update.mutateAsync({ storyId: story.story_id, update: { sprint_id: sprint.sprint_id } });
      } catch (error) {
        failed.push(`${story.story_id}: ${describeError(error)}`);
      }
    }
    setSaving(false);
    const added = picked.length - failed.length;
    if (added > 0) toast.success(`Added ${added} ${added === 1 ? "story" : "stories"} to ${sprint.name}`);
    if (failed.length > 0) toast.error("Some stories were not added", { description: failed.join("; ") });
    reset(false);
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={backlog.length === 0}>
          <PlusIcon aria-hidden /> Add from backlog
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add stories to {sprint.name}</DialogTitle>
          <DialogDescription>
            {sprint.status === "active"
              ? "The sprint has started, so these count as added mid-sprint."
              : "Stories from the backlog that are not in a sprint yet."}
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-1">
          <legend className="sr-only">Backlog stories</legend>
          {backlog.map((story) => {
            const id = `${ids}-${story.story_id}`;
            return (
              <div key={story.story_id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                <Checkbox
                  id={id}
                  className="mt-0.5"
                  checked={chosen.has(story.story_id)}
                  onCheckedChange={(checked) => toggle(story.story_id, checked === true)}
                />
                <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-sm">
                  <span className="block font-medium">{story.title}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{story.story_id}</span>
                    <span>{story.issue_type ?? "No type"}</span>
                    <span>{story.story_points === null ? "No estimate" : `${story.story_points} points`}</span>
                    {story.synthetic ? <SyntheticBadge /> : null}
                  </span>
                </label>
              </div>
            );
          })}
        </fieldset>
        <DialogFooter className="items-center sm:justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {picked.length} chosen, {formatPoints(totalPoints(picked))} points
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => reset(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={picked.length === 0 || saving} onClick={add}>
              {saving ? <Spinner aria-hidden /> : null}
              Add {picked.length > 0 ? picked.length : ""} to the sprint
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
