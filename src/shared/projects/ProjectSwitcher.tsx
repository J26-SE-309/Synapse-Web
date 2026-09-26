"use client";

import { CheckIcon, ChevronsUpDownIcon, FolderKanbanIcon, PlusIcon, RotateCwIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { describeError } from "@/shared/api/gateway";
import { cn } from "@/shared/lib/utils";
import { isDevelopmentData, SOURCE_LABELS, type Project } from "@/shared/projects/api";
import { NewProjectDialog } from "@/shared/projects/NewProjectDialog";
import { useProject } from "@/shared/projects/ProjectProvider";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/shared/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

/** Development data is labelled wherever a project is shown (ML guide 7.2: never mistaken for real results). */
export function SourceBadge({ project, className }: { project: Pick<Project, "data_source">; className?: string }) {
  if (!isDevelopmentData(project)) return null;
  return (
    <Badge variant="outline" className={cn("font-normal text-muted-foreground", className)}>
      {SOURCE_LABELS[project.data_source as keyof typeof SOURCE_LABELS]}
    </Badge>
  );
}

export function ProjectSwitcher({ className }: { className?: string }) {
  const { projectId, project, projects, selectProject } = useProject();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const list = useMemo(() => projects.data ?? [], [projects.data]);
  const ids = useMemo(() => list.map((entry) => entry.id), [list]);
  const groups = [
    { heading: "Projects", entries: list.filter((entry) => !isDevelopmentData(entry)) },
    { heading: "Development data", entries: list.filter(isDevelopmentData) },
  ].filter((group) => group.entries.length > 0);

  const label = project?.name ?? projectId ?? "Choose a project";

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={`Project: ${label}. Change project`}
            className={cn("max-w-64 min-w-0 justify-between gap-2", className)}
          >
            <FolderKanbanIcon aria-hidden className="text-muted-foreground" />
            <span className="truncate">{label}</span>
            <ChevronsUpDownIcon aria-hidden className="ml-auto text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <Command>
            <CommandInput placeholder="Search projects…" aria-label="Search projects" />
            <CommandList>
              {projects.isPending ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading projects…</p>
              ) : projects.isError ? (
                <div className="space-y-2 px-3 py-4 text-sm">
                  <p className="text-destructive">{describeError(projects.error)}</p>
                  <Button size="sm" variant="outline" onClick={() => projects.refetch()}>
                    <RotateCwIcon aria-hidden /> Try again
                  </Button>
                </div>
              ) : (
                <CommandEmpty>No project matches.</CommandEmpty>
              )}
              {groups.map((group) => (
                <CommandGroup key={group.heading} heading={group.heading}>
                  {group.entries.map((entry) => (
                    <CommandItem
                      key={entry.id}
                      value={entry.id}
                      keywords={[entry.name]}
                      onSelect={() => {
                        selectProject(entry.id);
                        setOpen(false);
                      }}
                    >
                      <CheckIcon aria-hidden className={cn(entry.id === projectId ? "opacity-100" : "opacity-0")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{entry.name}</span>
                        <span className="block truncate font-mono text-xs text-muted-foreground">{entry.id}</span>
                      </span>
                      <SourceBadge project={entry} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="__new-project"
                  onSelect={() => {
                    setOpen(false);
                    setCreating(true);
                  }}
                >
                  <PlusIcon aria-hidden />
                  New project…
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <NewProjectDialog
        open={creating}
        onOpenChange={setCreating}
        existingIds={ids}
        onCreated={(created) => selectProject(created.id)}
      />
    </>
  );
}
