"use client";

import { DownloadIcon, UploadIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { describeError, GatewayError } from "@/shared/api/gateway";
import type { Project } from "@/shared/projects/api";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import { useImportHistory } from "../_lib/api";
import { checkCsv, checkFile, templateCsv } from "../_lib/csv";
import type { CsvProblems } from "../_lib/types";

function isCsvProblems(detail: unknown): detail is CsvProblems {
  return !!detail && typeof detail === "object" && Array.isArray((detail as CsvProblems).problems);
}

/**
 * Until the platform sends its sprints, a project's history arrives as a CSV (one row per story per sprint).
 * Importing replaces what the service holds for the project, so it asks first.
 */
export function HistoryImport({ project, storedSprints }: { project: Project; storedSprints: number }) {
  const upload = useImportHistory(project.id);
  const ids = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [rowProblems, setRowProblems] = useState<CsvProblems | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function choose(chosen: File | undefined) {
    setFile(null);
    setRowProblems(null);
    if (!chosen) return setProblems([]);
    const fileProblem = checkFile(chosen);
    if (fileProblem) return setProblems([fileProblem]);
    const text = await chosen.text();
    const found = checkCsv(text);
    setProblems(found);
    if (found.length === 0) setFile({ name: chosen.name, text });
  }

  async function send() {
    if (!file) return;
    setConfirming(false);
    try {
      const result = await upload.mutateAsync(file.text);
      toast.success(`Imported ${result.sprints} sprints`, { description: `${result.stories} stories from ${file.name}` });
      setFile(null);
      if (input.current) input.current.value = "";
    } catch (error) {
      if (error instanceof GatewayError && isCsvProblems(error.detail)) setRowProblems(error.detail);
      else setProblems([describeError(error)]);
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([templateCsv()], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "sprint-history-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Import sprint history</h2>
        </CardTitle>
        <CardDescription>
          One row per story per sprint, with dates in ISO 8601 (e.g. 2026-09-14T09:00:00Z). Importing replaces this
          project&apos;s history.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field className="sm:max-w-md" data-invalid={problems.length > 0}>
            <FieldLabel htmlFor={`${ids}-csv`}>CSV file</FieldLabel>
            <Input
              ref={input}
              id={`${ids}-csv`}
              type="file"
              accept=".csv,text/csv"
              aria-invalid={problems.length > 0}
              aria-describedby={`${ids}-help`}
              onChange={(event) => void choose(event.target.files?.[0])}
            />
            <FieldDescription id={`${ids}-help`}>At most 25 MB and 200,000 rows.</FieldDescription>
          </Field>
          <div className="flex gap-2 sm:pb-6">
            <Button onClick={() => setConfirming(true)} disabled={!file || upload.isPending}>
              <UploadIcon aria-hidden /> Import
            </Button>
            <Button variant="ghost" onClick={downloadTemplate}>
              <DownloadIcon aria-hidden /> Template
            </Button>
          </div>
        </div>

        {problems.length > 0 ? (
          <Alert variant="destructive">
            <AlertTitle>The file can&apos;t be imported</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        {rowProblems ? (
          <div className="space-y-2" role="alert">
            <p className="text-sm font-medium text-destructive">{rowProblems.message}</p>
            <div
              tabIndex={0}
              role="region"
              aria-label="Problems in the file"
              className="max-h-72 overflow-auto rounded-lg border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Column</TableHead>
                    <TableHead>Problem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowProblems.problems.map((problem, index) => (
                    <TableRow key={index}>
                      <TableCell className="tabular-nums">{problem.row ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{problem.column ?? "—"}</TableCell>
                      <TableCell className="whitespace-normal">{problem.problem}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </CardContent>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the sprint history of {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {storedSprints > 0
                ? `The ${storedSprints} sprints stored now are replaced by the ones in ${file?.name}.`
                : `The sprints in ${file?.name} become this project's history.`}{" "}
              Predictions already made are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void send()}>Replace history</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
