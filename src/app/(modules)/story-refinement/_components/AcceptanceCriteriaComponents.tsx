import { CheckIcon, PencilIcon, PlusIcon, RotateCwIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/shared/ui/alert-dialog";

import type { AcceptanceCriterion } from "../_lib/types";
import { StatusBadge } from "./StoryComponents";

export function AcceptanceCriteriaCard({
  criterion,
  status,
  actions,
  editing = false,
  onChange,
}: {
  criterion: AcceptanceCriterion;
  status?: "Draft" | "Optimized" | "Human Verified" | "Ready" | "Needs Improvement";
  actions?: React.ReactNode;
  editing?: boolean;
  onChange?: (field: keyof Omit<AcceptanceCriterion, "id">, value: string) => void;
}) {
  const testable = Boolean(criterion.given.trim() && criterion.when.trim() && criterion.then.trim());
  return (
    <Card>
      <CardHeader className="border-b bg-muted/15 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="font-mono text-xs text-primary">{criterion.id}</CardTitle>
            {editing ? (
              <Input aria-label={`Title ${criterion.id}`} value={criterion.title ?? ""} onChange={(event) => onChange?.("title", event.target.value)} placeholder="Short criterion title" className="h-8 max-w-sm text-sm" />
            ) : <p className="text-sm font-semibold">{criterion.title || "Untitled criterion"}</p>}
          </div>
          <div className="flex items-center gap-2">{status ? <StatusBadge status={status} /> : null}{actions}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-medium">
            Priority
            {editing ? (
              <select aria-label={`Priority ${criterion.id}`} value={criterion.priority ?? "Medium"} onChange={(event) => onChange?.("priority", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                {["High", "Medium", "Low"].map((priority) => <option key={priority}>{priority}</option>)}
              </select>
            ) : <span className="block text-sm">{criterion.priority ?? "Medium"}</span>}
          </label>
          <label className="space-y-1.5 text-xs font-medium">
            Category
            {editing ? (
              <select aria-label={`Category ${criterion.id}`} value={criterion.category ?? "Functional"} onChange={(event) => onChange?.("category", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                {["Functional", "Validation", "Security", "Error Handling", "Performance", "Accessibility", "Business Rule"].map((category) => <option key={category}>{category}</option>)}
              </select>
            ) : <span className="block text-sm">{criterion.category ?? "Functional"}</span>}
          </label>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`size-2 rounded-full ${testable ? "bg-success" : "bg-warning"}`} aria-hidden />
          <span className={testable ? "text-success" : "text-warning"}>{testable ? "Testable" : "Needs detail to be testable"}</span>
        </div>
        <details open={editing} className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">Given–When–Then details</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {(["given", "when", "then"] as const).map((field) => (
              <div key={field} className="space-y-1.5">
                <label htmlFor={`${criterion.id}-${field}`} className="text-xs font-semibold uppercase text-muted-foreground">{field}</label>
                {editing ? (
                  <Textarea id={`${criterion.id}-${field}`} value={criterion[field]} onChange={(event) => onChange?.(field, event.target.value)} rows={3} className="min-h-24 resize-y text-sm" />
                ) : <p id={`${criterion.id}-${field}`} className="min-h-14 text-sm leading-relaxed">{criterion[field] || <span className="italic text-muted-foreground">Not specified</span>}</p>}
              </div>
            ))}
          </div>
        </details>
        {criterion.decisionRequired ? (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
            <StatusBadge status="Needs Human Decision" />
            <p className="mt-1 text-sm">{criterion.decisionRequired}</p>
            {onChange && editing ? <label className="mt-3 block space-y-1 text-xs font-medium">Human decision or approved policy
              <Textarea aria-label={`Human decision ${criterion.id}`} value={criterion.decisionResolution ?? ""} onChange={(event) => onChange("decisionResolution", event.target.value)} rows={2} placeholder="Record the approved decision before saving and verifying this criterion." />
            </label> : criterion.decisionResolution ? <p className="mt-2 text-xs"><strong>Recorded decision:</strong> {criterion.decisionResolution}</p> : null}
          </div>
        ) : null}
        {!criterion.decisionRequired && criterion.decisionResolution ? (
          <div className="rounded-md border border-success/30 bg-success/5 p-3 text-sm">
            <StatusBadge status="Human Verified" />
            <p className="mt-1 text-xs"><strong>Recorded decision:</strong> {criterion.decisionResolution}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AcceptanceCriteriaEditor({
  criteria,
  onChange,
  onAdd,
  onDelete,
  showActions = false,
  onSave,
  onRegenerate,
  isRegeneratingId,
}: {
  criteria: AcceptanceCriterion[];
  onChange: (criterionId: string, field: keyof Omit<AcceptanceCriterion, "id">, value: string) => void;
  onAdd: () => void;
  onDelete: (criterionId: string) => void;
  showActions?: boolean;
  onSave?: (criterionId: string) => void;
  onRegenerate?: (criterionId: string) => void;
  isRegeneratingId?: string | null;
}) {
  const [editingIds, setEditingIds] = useState<Set<string>>(() => new Set());
  return (
    <div className="space-y-3">
      {criteria.map((criterion) => (
        <AcceptanceCriteriaCard
          key={criterion.id}
          criterion={criterion}
          editing={!showActions || editingIds.has(criterion.id)}
          status={criterion.status ?? "Draft"}
          onChange={(field, value) => onChange(criterion.id, field, value)}
          actions={showActions ? (
            <div className="flex flex-wrap justify-end gap-1">
              {editingIds.has(criterion.id) ? (
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  onSave?.(criterion.id);
                  setEditingIds((current) => {
                    const next = new Set(current);
                    next.delete(criterion.id);
                    return next;
                  });
                }} disabled={!(criterion.given.trim() && criterion.when.trim() && criterion.then.trim())}><CheckIcon aria-hidden /> Save</Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingIds((current) => new Set(current).add(criterion.id))}><PencilIcon aria-hidden /> Edit</Button>
              )}
              <Button type="button" variant="outline" size="sm" aria-label={`Regenerate ${criterion.id}`} onClick={() => onRegenerate?.(criterion.id)} disabled={isRegeneratingId === criterion.id}>
                {isRegeneratingId === criterion.id ? <RotateCwIcon aria-hidden className="animate-spin" /> : <RotateCwIcon aria-hidden />} Regenerate
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${criterion.id}`} onClick={() => onDelete(criterion.id)}><Trash2Icon aria-hidden /></Button>
            </div>
          ) : <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${criterion.id}`} onClick={() => onDelete(criterion.id)}><Trash2Icon aria-hidden /></Button>}
        />
      ))}
      {!criteria.length ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No acceptance criteria yet.</div> : null}
      <Button type="button" variant="outline" onClick={onAdd}><PlusIcon aria-hidden /> Add Criterion</Button>
    </div>
  );
}

export function AcceptanceCriteriaReviewCard({
  criterion,
  editing,
  onToggleEdit,
  onChange,
  onDelete,
  onVerify,
}: {
  criterion: AcceptanceCriterion;
  editing: boolean;
  onToggleEdit: () => void;
  onChange: (field: keyof Omit<AcceptanceCriterion, "id">, value: string) => void;
  onDelete: () => void;
  onVerify: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <>
      <AcceptanceCriteriaCard
        criterion={criterion}
        status={criterion.status ?? "Draft"}
        editing={editing}
        onChange={onChange}
        actions={
          <div className="flex flex-wrap justify-end gap-1">
            <Button type="button" variant="outline" size="sm" onClick={onToggleEdit}>{editing ? <CheckIcon aria-hidden /> : null}{editing ? "Save" : "Edit"}</Button>
            <Button type="button" variant="outline" size="sm" onClick={onVerify} disabled={criterion.status === "Human Verified" || Boolean(criterion.decisionRequired)}><CheckIcon aria-hidden />{criterion.status === "Human Verified" ? "Verified" : criterion.decisionRequired ? "Resolve decision first" : "Mark Verified"}</Button>
            <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${criterion.id}`} onClick={() => setDeleteOpen(true)}><Trash2Icon aria-hidden /></Button>
          </div>
        }
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {criterion.id}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the criterion from the current review draft. You can cancel to keep it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete criterion</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}