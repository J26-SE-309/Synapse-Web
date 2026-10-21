import { cn } from "@/shared/lib/utils";

import { CONFIDENCE_LABELS, interval, percent, points, RISK_LABELS } from "../_lib/format";
import type { ConfidenceLevel, RiskLevel } from "../_lib/types";

/**
 * The prediction's three numbers drawn: a gauge for the spillover chance, a ring for confidence and a bar for the
 * effort range. Each drawing has its numbers in words next to it (and as its accessible name), never colour alone.
 */

const TONE: Record<RiskLevel, string> = { low: "var(--success)", medium: "var(--warning)", high: "var(--danger)" };

function polar(fraction: number, radius: number, cx = 100, cy = 100) {
  const angle = Math.PI * (1 - fraction);
  return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) };
}

function arc(from: number, to: number, radius: number) {
  const start = polar(from, radius);
  const end = polar(to, radius);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** A half-circle gauge filled to the chance the story spills over, in its risk level's colour. */
export function RiskGauge({
  probability,
  level,
  caption = "chance to spill over",
  className,
}: {
  probability: number;
  level: RiskLevel;
  caption?: string;
  className?: string;
}) {
  const value = clamp(probability);
  const tip = polar(value, 78);
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg viewBox="0 0 200 116" role="img" aria-label={`${percent(value)} ${caption}: ${RISK_LABELS[level]} risk`} className="w-full max-w-56">
        <path d={arc(0, 1, 78)} stroke="var(--muted)" strokeWidth="16" strokeLinecap="round" fill="none" />
        {value > 0.005 ? <path d={arc(0, value, 78)} stroke={TONE[level]} strokeWidth="16" strokeLinecap="round" fill="none" /> : null}
        <circle cx={tip.x} cy={tip.y} r="10" fill="var(--card)" stroke={TONE[level]} strokeWidth="4" />
        <text x="100" y="92" textAnchor="middle" className="fill-foreground text-[2rem] font-semibold tabular-nums">
          {percent(value)}
        </text>
        <text x="100" y="112" textAnchor="middle" className="fill-muted-foreground text-[0.7rem]">
          {caption}
        </text>
      </svg>
    </div>
  );
}

/** A ring filled to the confidence score, with ticks where Medium (35%) and High (60%) begin. */
export function ConfidenceRing({ score, level, className }: { score: number; level?: ConfidenceLevel | string | null; className?: string }) {
  const value = clamp(score);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const known = level === "high" || level === "medium" || level === "low" ? level : "low";
  const tick = (at: number) => {
    const angle = 2 * Math.PI * at - Math.PI / 2;
    return { x1: 60 + (radius - 9) * Math.cos(angle), y1: 60 + (radius - 9) * Math.sin(angle), x2: 60 + (radius + 9) * Math.cos(angle), y2: 60 + (radius + 9) * Math.sin(angle) };
  };
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={`${CONFIDENCE_LABELS[known]} confidence, ${percent(value)}`} className={cn("size-32", className)}>
      <circle cx="60" cy="60" r={radius} stroke="var(--muted)" strokeWidth="12" fill="none" />
      <circle
        cx="60"
        cy="60"
        r={radius}
        stroke="var(--primary)"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference * value} ${circumference}`}
        transform="rotate(-90 60 60)"
      />
      {[0.35, 0.6].map((at) => (
        <line key={at} {...tick(at)} stroke="var(--card)" strokeWidth="2.5" />
      ))}
      <text x="60" y="64" textAnchor="middle" className="fill-foreground text-[1.4rem] font-semibold tabular-nums">
        {percent(value)}
      </text>
      <text x="60" y="80" textAnchor="middle" className="fill-muted-foreground text-[0.6rem]">
        {CONFIDENCE_LABELS[known]}
      </text>
    </svg>
  );
}

/** The points on a scale from 0: the likely range as a band, the estimate as a marker, the team's own as a tick. */
export function EffortRange({
  value,
  range,
  own,
  coverage = 0.8,
  className,
}: {
  value: number;
  range: { lower: number; upper: number };
  /** The team's own estimate, when it has one. */
  own?: number | null;
  coverage?: number;
  className?: string;
}) {
  const top = Math.max(1, Math.ceil(Math.max(range.upper, value, own ?? 0) * 1.15));
  const at = (points: number) => `${(Math.min(points, top) / top) * 100}%`;
  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="img"
        aria-label={`About ${points(value)} points; in ${percent(coverage)} of past stories the real points fell between ${interval(range)}${own != null ? `; the team's own estimate is ${points(own)}` : ""}`}
        className="relative h-3 rounded-full bg-muted"
      >
        <span
          className="absolute inset-y-0 rounded-full bg-primary/30"
          style={{ left: at(range.lower), width: `calc(${at(range.upper)} - ${at(range.lower)})` }}
        />
        {own != null ? (
          <span className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground/60" style={{ left: at(own) }} />
        ) : null}
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-primary shadow-sm"
          style={{ left: at(value) }}
        />
      </div>
      <div aria-hidden className="relative h-4 text-xs text-muted-foreground tabular-nums">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: at(range.lower) }}>
          {points(range.lower)}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: at(range.upper) }}>
          {points(range.upper)}
        </span>
      </div>
    </div>
  );
}

/** A labelled 0–100% bar, for the parts of the confidence score. */
export function ShareBar({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">{percent(value)}</span>
      </div>
      <div aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-chart-3" style={{ width: `${clamp(value) * 100}%` }} />
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
