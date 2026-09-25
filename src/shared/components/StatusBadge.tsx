export type Status = "up" | "down" | "unknown";

const STYLES: Record<Status, string> = {
  up: "bg-emerald-100 text-emerald-800",
  down: "bg-red-100 text-red-800",
  unknown: "bg-zinc-100 text-zinc-700",
};

// Status is always spelled out, never shown by colour alone (NFR11).
const LABELS: Record<Status, string> = {
  up: "Running",
  down: "Not reachable",
  unknown: "Checking…",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status]}
    </span>
  );
}
