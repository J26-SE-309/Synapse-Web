"use client";

import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, ListFilterIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/shared/components/PageHeader";
import { PageContainer } from "@/shared/components/PageContainer";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

import { MOCK_REQUIREMENTS } from "../_lib/mock-service";
import type { ValidatedRequirement } from "../_lib/types";
import { WorkflowIndicator } from "./WorkflowComponents";

const PAGE_SIZE = 5;
type StatusFilter = "all" | ValidatedRequirement["validationStatus"];
type QualityFilter = "all" | "high" | "moderate" | "low";

function matchesQuality(score: number | undefined, filter: QualityFilter): boolean {
  if (score === undefined) return filter === "all";
  if (filter === "high") return score >= 0.9;
  if (filter === "moderate") return score >= 0.8 && score < 0.9;
  if (filter === "low") return score < 0.8;
  return true;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function ValidatedRequirementsView() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [quality, setQuality] = useState<QualityFilter>("all");
  const [page, setPage] = useState(1);

  const filteredRequirements = useMemo(() => {
    const query = search.trim().toLowerCase();
    return MOCK_REQUIREMENTS.filter((requirement) => {
      const matchesSearch = !query || `${requirement.id} ${requirement.text}`.toLowerCase().includes(query);
      const matchesStatus = status === "all" || requirement.validationStatus === status;
      return matchesSearch && matchesStatus && matchesQuality(requirement.qualityScore, quality);
    });
  }, [search, status, quality]);

  const pageCount = Math.max(1, Math.ceil(filteredRequirements.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRequirements = filteredRequirements.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstRow = filteredRequirements.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = Math.min(currentPage * PAGE_SIZE, filteredRequirements.length);

  function updateFilters(update: () => void) {
    update();
    setPage(1);
  }

  return (
    <PageContainer>
      <PageHeader
        title="Validated requirements"
        description="Requirements already reviewed by Component 1, ready to continue into user story refinement."
        actions={
          <Button asChild variant="outline">
            <Link href="/story-refinement"><ArrowLeftIcon aria-hidden /> Story refinement</Link>
          </Button>
        }
      >
        <p className="pt-1 text-xs text-muted-foreground">Component 1 owns requirement quality and ambiguity analysis. This page displays its validation results without repeating that analysis.</p>
      </PageHeader>

      <WorkflowIndicator currentStep="Validated requirement" />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-sm border border-success/30 bg-success-soft px-2.5 py-1.5 font-medium text-success">
          <CheckCircle2Icon aria-hidden className="size-3.5" /> Component 1 validated
        </span>
        <span className="text-muted-foreground">{MOCK_REQUIREMENTS.length} sample requirements · Mock research data</span>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-1.5">
              <label htmlFor="requirement-search" className="text-xs font-medium">Search requirements</label>
              <div className="relative">
                <SearchIcon aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="requirement-search"
                  value={search}
                  onChange={(event) => updateFilters(() => setSearch(event.target.value))}
                  placeholder="Search by ID or requirement text"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full space-y-1.5 sm:w-52">
              <label htmlFor="status-filter" className="text-xs font-medium">Validation status</label>
              <select
                id="status-filter"
                value={status}
                onChange={(event) => updateFilters(() => setStatus(event.target.value as StatusFilter))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All statuses</option>
                <option value="Validated">Validated</option>
                <option value="Validated with notes">Validated with notes</option>
              </select>
            </div>
            <div className="w-full space-y-1.5 sm:w-48">
              <label htmlFor="quality-filter" className="text-xs font-medium">Quality score</label>
              <select
                id="quality-filter"
                value={quality}
                onChange={(event) => updateFilters(() => setQuality(event.target.value as QualityFilter))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All scores</option>
                <option value="high">High · 90% and above</option>
                <option value="moderate">Moderate · 80–89%</option>
                <option value="low">Below 80%</option>
              </select>
            </div>
            <span className="inline-flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
              <ListFilterIcon aria-hidden className="size-3.5" /> {filteredRequirements.length} results
            </span>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
              <caption className="sr-only">Component 1 validated requirements and refinement actions</caption>
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-3 font-medium">Requirement ID</th>
                  <th scope="col" className="px-3 py-3 font-medium">Requirement text</th>
                  <th scope="col" className="px-3 py-3 font-medium">Quality score</th>
                  <th scope="col" className="px-3 py-3 font-medium">Validation status</th>
                  <th scope="col" className="px-3 py-3 font-medium">Source</th>
                  <th scope="col" className="px-3 py-3 font-medium">Date</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleRequirements.map((requirement) => (
                  <tr key={requirement.id} className="align-top transition-colors hover:bg-muted/25">
                    <th scope="row" className="whitespace-nowrap px-3 py-4 font-mono text-xs font-semibold">{requirement.id}</th>
                    <td className="max-w-md px-3 py-4 leading-relaxed">{requirement.text}</td>
                    <td className="whitespace-nowrap px-3 py-4 font-mono text-sm tabular-nums">{requirement.qualityScore === undefined ? "Not supplied" : `${Math.round(requirement.qualityScore * 100)}%`}</td>
                    <td className="whitespace-nowrap px-3 py-4">
                      <Badge variant={requirement.validationStatus === "Validated" ? "secondary" : "outline"}>{requirement.validationStatus}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-xs text-muted-foreground">{requirement.source}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-xs text-muted-foreground">{formatDate(requirement.validatedAt)}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-right">
                      <Button asChild size="sm">
                        <Link href={`/story-refinement/refine?requirementId=${encodeURIComponent(requirement.id)}`}>
                          Refine User Story <ArrowRightIcon aria-hidden />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {!visibleRequirements.length ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No validated requirements match these filters.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Showing {firstRow}–{lastRow} of {filteredRequirements.length} requirements
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} aria-label="Previous page">
                <ArrowLeftIcon aria-hidden /> Previous
              </Button>
              <span className="min-w-20 text-center text-xs tabular-nums text-muted-foreground">Page {currentPage} of {pageCount}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage >= pageCount} aria-label="Next page">
                Next <ArrowRightIcon aria-hidden />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}