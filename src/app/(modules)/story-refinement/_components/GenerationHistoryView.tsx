"use client";

import {
  ArrowLeftIcon,
  GitCompareArrowsIcon,
  HistoryIcon,
  MoreHorizontalIcon,
  RotateCwIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";

import { PageHeader } from "@/shared/components/PageHeader";
import { PageContainer } from "@/shared/components/PageContainer";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import {
  getServerGenerationHistory,
  readGenerationHistory,
  saveGeneration,
  subscribeToGenerationHistory,
} from "../_lib/mock-service";
import type { GenerationRecord, ReviewStatus } from "../_lib/types";
import { StatusBadge } from "./StoryComponents";

type StatusFilter = "all" | ReviewStatus;
type QualityFilter = "all" | "high" | "moderate" | "low";

function recordStatus(record: GenerationRecord): Exclude<StatusFilter, "all"> {
  if (record.status) return record.status;
  return record.approvedAt ? "Approved" : "Draft";
}

function score(record: GenerationRecord): number {
  const candidate = record.candidates.find((item) => item.id === record.selectedCandidateId);
  if (!candidate || candidate.assessment.length === 0) return 0;
  return Math.round(candidate.assessment.reduce((total, item) => total + item.score, 0) / candidate.assessment.length * 100);
}

function selectedStoryId(record: GenerationRecord): string {
  return record.candidates.find((item) => item.id === record.selectedCandidateId)?.storyId ?? record.requirementId;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function reviewUrl(record: GenerationRecord): string {
  return `/story-refinement/review?requirementId=${encodeURIComponent(record.requirementId)}&candidateId=${encodeURIComponent(selectedStoryId(record))}&resumeId=${encodeURIComponent(record.id)}`;
}

function evaluationUrl(record: GenerationRecord): string {
  return `/story-refinement/evaluation?requirementId=${encodeURIComponent(record.requirementId)}&candidateId=${encodeURIComponent(selectedStoryId(record))}`;
}

function criteriaUrl(record: GenerationRecord): string {
  return `/story-refinement/acceptance-criteria?requirementId=${encodeURIComponent(record.requirementId)}&candidateId=${encodeURIComponent(selectedStoryId(record))}&resumeId=${encodeURIComponent(record.id)}`;
}

function qualityMatches(value: number, filter: QualityFilter): boolean {
  if (filter === "high") return value >= 90;
  if (filter === "moderate") return value >= 80 && value < 90;
  if (filter === "low") return value < 80;
  return true;
}

export function GenerationHistoryView() {
  const router = useRouter();
  const history = useSyncExternalStore(subscribeToGenerationHistory, readGenerationHistory, getServerGenerationHistory);
  const [requirementId, setRequirementId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [quality, setQuality] = useState<QualityFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);

  const requirementOptions = [...new Set(history.map((record) => record.requirementId))].sort();
  const filtered = useMemo(() => history.filter((record) => {
    const generatedDate = record.createdAt.slice(0, 10);
    return (requirementId === "all" || record.requirementId === requirementId)
      && (status === "all" || recordStatus(record) === status)
      && (!dateFrom || generatedDate >= dateFrom)
      && (!dateTo || generatedDate <= dateTo)
      && qualityMatches(score(record), quality);
  }), [history, requirementId, status, dateFrom, dateTo, quality]);

  const compared = comparisonIds.map((id) => history.find((record) => record.id === id)).filter((item): item is GenerationRecord => !!item);

  function selectForComparison(record: GenerationRecord) {
    setComparisonIds((selected) => {
      if (selected.includes(record.id)) return selected.filter((id) => id !== record.id);
      if (selected.length < 2) return [...selected, record.id];
      return [selected[1], record.id];
    });
  }

  function restore(record: GenerationRecord) {
    const restored: GenerationRecord = {
      ...record,
      id: `restore-${Date.now()}`,
      status: "Draft",
      createdAt: new Date().toISOString(),
      approvedAt: undefined,
      approvedDraft: undefined,
    };
    saveGeneration(restored);
    router.push(reviewUrl(restored));
  }

  function clearFilters() {
    setRequirementId("all");
    setStatus("all");
    setQuality("all");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <PageContainer>
      <PageHeader
        title="Generation History"
        description="Review previous story refinement attempts, compare versions, and restore a draft for further work."
        actions={
          <Button asChild variant="outline">
            <Link href="/story-refinement"><ArrowLeftIcon aria-hidden /> Refine User Story</Link>
          </Button>
        }
      >
        <p className="pt-1 text-xs text-muted-foreground">Saved in this browser only · {history.length} of the most recent generations</p>
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><HistoryIcon aria-hidden className="size-4 text-primary" /> Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <label htmlFor="history-requirement" className="text-xs font-medium">Requirement ID</label>
            <select id="history-requirement" value={requirementId} onChange={(event) => setRequirementId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
              <option value="all">All requirements</option>
              {requirementOptions.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="history-status" className="text-xs font-medium">Status</label>
            <select id="history-status" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
              <option value="all">All statuses</option><option value="Draft">Draft</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="history-quality" className="text-xs font-medium">Quality score</label>
            <select id="history-quality" value={quality} onChange={(event) => setQuality(event.target.value as QualityFilter)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
              <option value="all">All scores</option><option value="high">High · 90%+</option><option value="moderate">Moderate · 80–89%</option><option value="low">Below 80%</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="history-from" className="text-xs font-medium">Generated from</label>
            <input id="history-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="history-to" className="text-xs font-medium">Generated to</label>
            <input id="history-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
          </div>
          <div className="flex items-end justify-between gap-2 sm:col-span-2 lg:col-span-5">
            <p className="text-xs text-muted-foreground" aria-live="polite">Showing {filtered.length} of {history.length} generations</p>
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} disabled={requirementId === "all" && status === "all" && quality === "all" && !dateFrom && !dateTo}>Clear filters</Button>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
          <caption className="sr-only">Previous user story refinement generations</caption>
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-3 font-medium">Generation ID</th>
              <th scope="col" className="px-3 py-3 font-medium">Requirement ID</th>
              <th scope="col" className="px-3 py-3 font-medium">User Story Version</th>
              <th scope="col" className="px-3 py-3 font-medium">Quality Score</th>
              <th scope="col" className="px-3 py-3 font-medium">Acceptance Criteria Count</th>
              <th scope="col" className="px-3 py-3 font-medium">Generated Date</th>
              <th scope="col" className="px-3 py-3 font-medium">Status</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((record) => {
              const selectedCandidate = record.candidates.find((candidate) => candidate.id === record.selectedCandidateId);
              const rowStatus = recordStatus(record);
              const comparing = comparisonIds.includes(record.id);
              return (
                <tr key={record.id} className={`align-top ${comparing ? "bg-primary/5" : "hover:bg-muted/20"}`}>
                  <th scope="row" className="max-w-44 truncate px-3 py-4 font-mono text-xs font-medium" title={record.id}>{record.id}</th>
                  <td className="whitespace-nowrap px-3 py-4 font-mono text-xs">{record.requirementId}</td>
                  <td className="max-w-xs px-3 py-4">
                    <p className="font-mono text-xs text-muted-foreground">{selectedCandidate?.storyId ?? record.requirementId}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed">{record.draft.userStory}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 font-mono tabular-nums">{score(record)}%</td>
                  <td className="whitespace-nowrap px-3 py-4 tabular-nums">{record.draft.acceptanceCriteria.length}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-xs text-muted-foreground">{formatDate(record.createdAt)}</td>
                  <td className="whitespace-nowrap px-3 py-4">
                    <StatusBadge status={rowStatus} />
                    {record.reviewMetadata ? (
                      <p className="mt-1 max-w-44 whitespace-normal text-[11px] text-muted-foreground">
                        Prototype decision: {record.reviewMetadata.decision}
                        {record.reviewMetadata.reviewer ? ` · ${record.reviewMetadata.reviewer}` : ""}
                        {" · "}{formatDate(record.reviewMetadata.decidedAt)}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Actions for ${record.id}`}><MoreHorizontalIcon aria-hidden /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem asChild><Link href={reviewUrl(record)}>View</Link></DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => selectForComparison(record)}>
                          <GitCompareArrowsIcon aria-hidden /> {comparing ? "Remove from comparison" : comparisonIds.length ? "Compare with selected" : "Compare versions"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => restore(record)}><RotateCwIcon aria-hidden /> Restore version</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild><Link href={evaluationUrl(record)}>View evaluation</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild><Link href={criteriaUrl(record)}>View acceptance criteria</Link></DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
            {!filtered.length ? (
              <tr><td colSpan={8} className="px-4 py-14 text-center">
                <HistoryIcon aria-hidden className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">{history.length ? "No generations match these filters" : "No generation history yet"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{history.length ? "Adjust or clear filters to see other attempts." : "Generated stories and approved versions will appear here when saved."}</p>
              </td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {compared.length === 2 ? (
        <section aria-labelledby="compare-versions-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-primary">Version comparison</p>
              <h2 id="compare-versions-heading" className="mt-1 text-lg font-semibold">Compare saved versions</h2>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setComparisonIds([])}><XIcon aria-hidden /> Clear comparison</Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {compared.map((record, index) => (
              <Card key={record.id}>
                <CardHeader>
                  <CardTitle className="text-sm">Version {index + 1} · {record.requirementId} · {selectedStoryId(record)}</CardTitle>
                  <p className="text-xs text-muted-foreground">{formatDate(record.createdAt)} · {recordStatus(record)} · {score(record)}%</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="border-l-2 border-primary/50 pl-3 text-sm leading-relaxed">{record.draft.userStory}</p>
                  <p className="text-xs text-muted-foreground">{record.draft.acceptanceCriteria.length} acceptance criteria</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : comparisonIds.length === 1 ? (
        <p role="status" className="text-sm text-muted-foreground">Select a second generation with Compare with selected to compare versions.</p>
      ) : null}
    </PageContainer>
  );
}