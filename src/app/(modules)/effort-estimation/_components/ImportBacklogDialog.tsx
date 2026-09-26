"use client";

import { FileJsonIcon } from "lucide-react";
import { useId, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
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
import { Textarea } from "@/shared/ui/textarea";

import { parseBacklog, type ImportedBacklog } from "../_lib/backlog";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * Load a backlog as JSON: an estimate request (contracts/effort-estimation/estimate-request.json) or just its
 * stories, pasted or from a file. It is checked here first, so problems show before anything is sent.
 */
export function ImportBacklogDialog({ onImport }: { onImport: (backlog: ImportedBacklog) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const ids = useId();

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setText("");
      setProblems([]);
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setProblems(["Choose a .json file."]);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setProblems(["The file is larger than 2 MB. A backlog has at most 200 stories."]);
      return;
    }
    setText(await file.text());
    setProblems([]);
  }

  function load() {
    const result = parseBacklog(text);
    if ("problems" in result) {
      setProblems(result.problems);
      return;
    }
    onImport(result.backlog);
    reset(false);
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileJsonIcon aria-hidden /> Import backlog
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import a backlog</DialogTitle>
          <DialogDescription>
            Paste or choose a JSON backlog: an estimate request, or a list of stories. It replaces the stories in the form.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor={`${ids}-file`}>JSON file</FieldLabel>
          <Input
            id={`${ids}-file`}
            type="file"
            accept=".json,application/json"
            onChange={(event) => void readFile(event.target.files?.[0])}
          />
        </Field>
        <Field data-invalid={problems.length > 0}>
          <FieldLabel htmlFor={`${ids}-text`}>Or paste it</FieldLabel>
          <Textarea
            id={`${ids}-text`}
            rows={10}
            className="max-h-72 font-mono text-xs"
            spellCheck={false}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={problems.length > 0}
            aria-describedby={`${ids}-help`}
            placeholder={'{ "stories": [ { "story_id": "TUTOR-1", "title": "As a student I want …" } ] }'}
          />
          <FieldDescription id={`${ids}-help`}>
            Each story needs a story_id and a title; everything else is optional.
          </FieldDescription>
        </Field>

        {problems.length > 0 ? (
          <Alert variant="destructive">
            <AlertTitle>The backlog was not loaded</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-0.5 pl-4">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => reset(false)}>
            Cancel
          </Button>
          <Button onClick={load} disabled={text.trim() === ""}>
            Load backlog
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
