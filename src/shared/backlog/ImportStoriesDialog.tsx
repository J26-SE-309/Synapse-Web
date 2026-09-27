"use client";

import { FileJsonIcon, FlaskConicalIcon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { describeError } from "@/shared/api/gateway";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
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
import { Field, FieldDescription, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Spinner } from "@/shared/ui/spinner";
import { Textarea } from "@/shared/ui/textarea";

import example from "../../../contracts/effort-estimation/examples/estimate-request.json";
import { useImportStories } from "./api";
import { totalPoints } from "./types";
import { formatPoints } from "./badges";
import { MAX_STORIES_PER_IMPORT, parseBacklogFile } from "./schema";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * Add a backlog from a JSON file: a list of stories, or a backlog with a sprint (the effort service's estimate
 * request works too). Checked here first; nothing is added unless every story is valid.
 */
export function ImportStoriesDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [planSprint, setPlanSprint] = useState(true);
  const [serverProblem, setServerProblem] = useState<string | null>(null);
  const importStories = useImportStories(projectId);
  const router = useRouter();
  const ids = useId();
  const parsed = useMemo(() => (text.trim() ? parseBacklogFile(text) : null), [text]);
  const backlog = parsed && "backlog" in parsed ? parsed.backlog : null;
  const problems = parsed && "problems" in parsed ? parsed.problems : [];

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setText("");
      setFileProblem(null);
      setServerProblem(null);
      setPlanSprint(true);
      importStories.reset();
    }
  }

  async function readFile(file: File | undefined) {
    setServerProblem(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setFileProblem("Choose a .json file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileProblem(`The file is larger than 2 MB. Import at most ${MAX_STORIES_PER_IMPORT} stories at a time.`);
      return;
    }
    setFileProblem(null);
    setText(await file.text());
  }

  function loadExample() {
    setServerProblem(null);
    setFileProblem(null);
    // The contract's example backlog, relabelled for this project and marked as made up.
    const stories = example.stories.map((story, index) => ({ ...story, story_id: undefined, title: story.title || `Story ${index + 1}` }));
    setText(JSON.stringify({ _synthetic: "Example backlog from the contracts", stories }, null, 2));
  }

  async function submit() {
    if (!backlog) return;
    setServerProblem(null);
    try {
      const result = await importStories.mutateAsync({
        stories: backlog.stories,
        synthetic: backlog.synthetic,
        sprint: backlog.sprint && planSprint ? backlog.sprint : null,
      });
      toast.success(`Imported ${result.stories.length} ${result.stories.length === 1 ? "story" : "stories"}`, {
        description: result.sprint ? `Planned ${result.sprint.name} (${result.sprint.sprint_id})` : "In the backlog",
      });
      reset(false);
      if (result.sprint) router.push(`/sprints/${encodeURIComponent(result.sprint.sprint_id)}`);
    } catch (error) {
      setServerProblem(describeError(error));
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileJsonIcon aria-hidden /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import stories</DialogTitle>
          <DialogDescription>
            Choose or paste a JSON backlog: a list of stories, or a backlog with a sprint id and capacity. Every story is
            checked first; nothing is added unless all of them are valid.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor={`${ids}-file`}>JSON file</FieldLabel>
            <Input id={`${ids}-file`} type="file" accept=".json,application/json" onChange={(event) => readFile(event.target.files?.[0])} />
            <FieldDescription>At most {MAX_STORIES_PER_IMPORT} stories and 2 MB.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${ids}-text`}>Or paste it here</FieldLabel>
            <Textarea
              id={`${ids}-text`}
              rows={8}
              className="font-mono text-xs"
              value={text}
              spellCheck={false}
              onChange={(event) => {
                setServerProblem(null);
                setText(event.target.value);
              }}
            />
          </Field>
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={loadExample}>
              <FlaskConicalIcon aria-hidden /> Use the example backlog
            </Button>
          </div>

          {fileProblem || problems.length > 0 || serverProblem ? (
            <Alert variant="destructive">
              <TriangleAlertIcon aria-hidden />
              <AlertTitle>{serverProblem ? "The stories were not imported" : "The backlog can't be imported yet"}</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-0.5 pl-4">
                  {[fileProblem, ...problems, serverProblem].filter(Boolean).map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          {backlog ? (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm" aria-live="polite">
              <p>
                <strong>{backlog.stories.length}</strong> {backlog.stories.length === 1 ? "story" : "stories"},{" "}
                {formatPoints(totalPoints(backlog.stories.map((story) => ({ story_points: story.story_points ?? null }))))}{" "}
                points in the team&apos;s estimates.
              </p>
              {backlog.synthetic ? (
                <p className="flex items-center gap-1.5">
                  <FlaskConicalIcon aria-hidden className="size-4" /> Marked as made up: the stories are labelled
                  Synthetic and are never used as evidence.
                </p>
              ) : null}
              {backlog.sprint ? (
                <Field orientation="horizontal">
                  <Checkbox id={`${ids}-sprint`} checked={planSprint} onCheckedChange={(checked) => setPlanSprint(checked === true)} />
                  <FieldLabel htmlFor={`${ids}-sprint`} className="font-normal">
                    Also plan sprint <span className="font-mono">{backlog.sprint.sprint_id}</span> with these stories (
                    {backlog.sprint.length_days} days
                    {backlog.sprint.capacity_points ? `, ${backlog.sprint.capacity_points} points of capacity` : ""})
                  </FieldLabel>
                </Field>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => reset(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!backlog || importStories.isPending} onClick={submit}>
            {importStories.isPending ? <Spinner aria-hidden /> : null}
            Import {backlog ? `${backlog.stories.length} ${backlog.stories.length === 1 ? "story" : "stories"}` : "stories"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
