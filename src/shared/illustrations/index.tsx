import { useId, type SVGProps } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * Drawings for empty states, the welcome page and first steps. They are decorative (hidden from screen readers;
 * the text next to them says everything) and drawn with the theme's colours, so they follow light and dark mode.
 */
type IllustrationProps = Omit<SVGProps<SVGSVGElement>, "children"> & { className?: string };

function Frame({ className, viewBox, children, ...props }: IllustrationProps & { viewBox: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
      className={cn("h-auto w-full select-none", className)}
      {...props}
    >
      {children}
    </svg>
  );
}

/** A soft glow and a story card: an icon tile and two lines of "text". */
function StoryCard({ x, y, width = 132, tone = "var(--chart-1)", lines = [0.7, 0.45], lifted = false }: {
  x: number;
  y: number;
  width?: number;
  tone?: string;
  lines?: [number, number];
  lifted?: boolean;
}) {
  const inner = width - 52;
  return (
    <g transform={`translate(${x} ${y})`}>
      {lifted ? <rect x="2" y="6" width={width} height="36" rx="9" fill="var(--primary)" opacity="0.18" /> : null}
      <rect width={width} height="36" rx="9" fill="var(--card)" stroke={lifted ? "var(--primary)" : "var(--border)"} strokeWidth={lifted ? 1.5 : 1} />
      <rect x="10" y="9" width="18" height="18" rx="5" fill={tone} opacity="0.2" />
      <rect x="15" y="14" width="8" height="8" rx="2" fill={tone} />
      <rect x="36" y="11" width={inner * lines[0]} height="5" rx="2.5" fill="var(--foreground)" opacity="0.55" />
      <rect x="36" y="21" width={inner * lines[1]} height="4" rx="2" fill="var(--muted-foreground)" opacity="0.4" />
      <circle cx={width - 13} cy="18" r="6" fill="var(--muted)" />
    </g>
  );
}

function Sparkle({ x, y, size = 8, color = "var(--primary)" }: { x: number; y: number; size?: number; color?: string }) {
  const s = size;
  return (
    <path
      d={`M${x} ${y - s}C${x + s * 0.18} ${y - s * 0.18} ${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y}C${x + s * 0.18} ${y + s * 0.18} ${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s}C${x - s * 0.18} ${y + s * 0.18} ${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y}C${x - s * 0.18} ${y - s * 0.18} ${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z`}
      fill={color}
    />
  );
}

function Glow({ id, cx, cy, r, color = "var(--primary)", opacity = 0.16 }: { id: string; cx: number; cy: number; r: number; color?: string; opacity?: number }) {
  return (
    <>
      <defs>
        <radialGradient id={id} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={color} stopOpacity={opacity} />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
    </>
  );
}

/** Stories stacked as a ranked list, one of them being lifted into place. */
export function BacklogIllustration(props: IllustrationProps) {
  const id = useId();
  return (
    <Frame viewBox="0 0 240 170" {...props}>
      <Glow id={`${id}-glow`} cx={120} cy={88} r={100} />
      <StoryCard x={44} y={30} tone="var(--chart-1)" />
      <StoryCard x={62} y={72} tone="var(--chart-2)" lines={[0.55, 0.5]} lifted />
      <StoryCard x={44} y={114} tone="var(--chart-3)" lines={[0.62, 0.35]} />
      <circle cx="190" cy="34" r="15" fill="var(--primary)" />
      <path d="M190 27v14M183 34h14" stroke="var(--primary-foreground)" strokeWidth="2.5" strokeLinecap="round" />
      <Sparkle x={30} y={64} size={6} color="var(--chart-2)" />
      <Sparkle x={212} y={130} size={5} color="var(--chart-3)" />
      <circle cx="214" cy="80" r="3" fill="var(--chart-5)" opacity="0.6" />
    </Frame>
  );
}

/** A winding path of milestones to a flag: a sprint from start to finish. */
export function SprintIllustration(props: IllustrationProps) {
  const id = useId();
  return (
    <Frame viewBox="0 0 240 170" {...props}>
      <Glow id={`${id}-glow`} cx={130} cy={86} r={100} />
      <path
        d="M34 138C70 138 64 96 104 96S142 60 176 58"
        stroke="var(--primary)"
        strokeOpacity="0.45"
        strokeWidth="3"
        strokeDasharray="2 8"
        strokeLinecap="round"
      />
      {[
        [34, 138, "var(--chart-2)"],
        [104, 96, "var(--chart-3)"],
      ].map(([cx, cy, fill]) => (
        <g key={`${cx}`}>
          <circle cx={cx as number} cy={cy as number} r="10" fill="var(--card)" stroke="var(--border)" />
          <circle cx={cx as number} cy={cy as number} r="4.5" fill={fill as string} />
        </g>
      ))}
      <path d="M178 60V22" stroke="var(--foreground)" strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M179 23h34l-8 10 8 10h-34z" fill="var(--primary)" />
      <ellipse cx="178" cy="62" rx="14" ry="4" fill="var(--foreground)" opacity="0.08" />
      <g transform="translate(26 26)">
        <rect width="58" height="54" rx="10" fill="var(--card)" stroke="var(--border)" />
        <rect width="58" height="15" rx="10" fill="var(--primary)" opacity="0.85" />
        <rect y="8" width="58" height="7" fill="var(--primary)" opacity="0.85" />
        {[0, 1, 2, 3].map((col) =>
          [0, 1].map((row) => (
            <rect
              key={`${col}-${row}`}
              x={8 + col * 11}
              y={23 + row * 12}
              width="7"
              height="7"
              rx="2"
              fill={col === 2 && row === 0 ? "var(--chart-5)" : "var(--muted-foreground)"}
              opacity={col === 2 && row === 0 ? 0.9 : 0.25}
            />
          )),
        )}
      </g>
      <Sparkle x={214} y={96} size={6} color="var(--chart-2)" />
      <Sparkle x={138} y={30} size={4} color="var(--chart-3)" />
    </Frame>
  );
}

/** Project boards fanned out, one picked. */
export function ProjectIllustration(props: IllustrationProps) {
  const id = useId();
  const board = (x: number, y: number, rotate: number, tone: string, picked = false) => (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      {picked ? <rect x="3" y="7" width="86" height="64" rx="11" fill="var(--primary)" opacity="0.2" /> : null}
      <rect width="86" height="64" rx="11" fill="var(--card)" stroke={picked ? "var(--primary)" : "var(--border)"} strokeWidth={picked ? 1.5 : 1} />
      <rect x="10" y="10" width="22" height="22" rx="6" fill={tone} opacity="0.85" />
      <rect x="38" y="13" width="36" height="5" rx="2.5" fill="var(--foreground)" opacity="0.5" />
      <rect x="38" y="23" width="24" height="4" rx="2" fill="var(--muted-foreground)" opacity="0.4" />
      {[0, 1, 2].map((index) => (
        <rect key={index} x={10 + index * 24} y="42" width="20" height="12" rx="3" fill="var(--muted)" />
      ))}
    </g>
  );
  return (
    <Frame viewBox="0 0 240 170" {...props}>
      <Glow id={`${id}-glow`} cx={120} cy={90} r={100} />
      {board(28, 58, -8, "var(--chart-2)")}
      {board(126, 52, 7, "var(--chart-3)")}
      {board(77, 40, 0, "var(--primary)", true)}
      <path d="M150 112l12 28 4-12 12-4z" fill="var(--foreground)" stroke="var(--card)" strokeWidth="2" strokeLinejoin="round" />
      <Sparkle x={52} y={34} size={6} color="var(--chart-5)" />
      <Sparkle x={200} y={36} size={5} color="var(--chart-2)" />
    </Frame>
  );
}

/** A magnifying glass over cards: nothing matches the search or filters. */
export function SearchIllustration(props: IllustrationProps) {
  const id = useId();
  return (
    <Frame viewBox="0 0 240 170" {...props}>
      <Glow id={`${id}-glow`} cx={120} cy={88} r={96} />
      <g opacity="0.55">
        <StoryCard x={40} y={40} tone="var(--chart-4)" />
        <StoryCard x={40} y={84} tone="var(--chart-4)" lines={[0.5, 0.4]} />
      </g>
      <circle cx="150" cy="86" r="34" fill="var(--card)" fillOpacity="0.75" stroke="var(--primary)" strokeWidth="6" />
      <path d="M174 112l26 26" stroke="var(--primary)" strokeWidth="10" strokeLinecap="round" />
      <path d="M138 80c3-8 13-12 21-8" stroke="var(--primary)" strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" />
      <Sparkle x={210} y={46} size={6} color="var(--chart-3)" />
    </Frame>
  );
}

/** A card with a broken link: something could not be loaded. */
export function ErrorIllustration(props: IllustrationProps) {
  const id = useId();
  return (
    <Frame viewBox="0 0 240 170" {...props}>
      <Glow id={`${id}-glow`} cx={120} cy={86} r={96} color="var(--danger)" opacity={0.12} />
      <rect x="62" y="36" width="116" height="92" rx="14" fill="var(--card)" stroke="var(--border)" />
      <rect x="62" y="36" width="116" height="20" rx="14" fill="var(--muted)" />
      <rect x="62" y="48" width="116" height="8" fill="var(--muted)" />
      {[0, 1, 2].map((dot) => (
        <circle key={dot} cx={76 + dot * 10} cy="46" r="3" fill="var(--muted-foreground)" opacity="0.5" />
      ))}
      <circle cx="120" cy="92" r="20" fill="var(--danger-soft)" />
      <path d="M120 82v12" stroke="var(--danger)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="120" cy="101" r="2.5" fill="var(--danger)" />
      <path d="M30 120c14 0 18-10 30-10" stroke="var(--muted-foreground)" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
      <path d="M210 60c-14 0-18 10-30 10" stroke="var(--muted-foreground)" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
    </Frame>
  );
}

/** Bars and a rising line with a spark: estimates and insights to come. */
export function InsightsIllustration(props: IllustrationProps) {
  const id = useId();
  return (
    <Frame viewBox="0 0 240 170" {...props}>
      <Glow id={`${id}-glow`} cx={120} cy={88} r={100} />
      <rect x="48" y="32" width="144" height="104" rx="14" fill="var(--card)" stroke="var(--border)" />
      {[
        [66, 92, "var(--chart-4)"],
        [90, 76, "var(--chart-2)"],
        [114, 84, "var(--chart-4)"],
        [138, 62, "var(--chart-3)"],
        [162, 50, "var(--primary)"],
      ].map(([x, y, fill]) => (
        <rect key={`${x}`} x={x as number} y={y as number} width="14" height={120 - (y as number)} rx="4" fill={fill as string} opacity="0.85" />
      ))}
      <path d="M66 82l26-18 24 8 24-22 26-12" stroke="var(--foreground)" strokeOpacity="0.6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="166" cy="38" r="4" fill="var(--card)" stroke="var(--foreground)" strokeOpacity="0.6" strokeWidth="2.5" />
      <Sparkle x={204} y={30} size={9} color="var(--primary)" />
      <Sparkle x={34} y={120} size={5} color="var(--chart-2)" />
    </Frame>
  );
}

/**
 * The welcome picture: the four components as nodes around the platform's core, joined like a synapse, with a
 * requirement going in on one side and a planned sprint coming out on the other.
 */
export function WelcomeIllustration(props: IllustrationProps) {
  const id = useId();
  const nodes: [number, number, string][] = [
    [96, 52, "var(--chart-2)"],
    [264, 52, "var(--chart-3)"],
    [96, 168, "var(--chart-5)"],
    [264, 168, "var(--chart-1)"],
  ];
  return (
    <Frame viewBox="0 0 360 220" {...props}>
      <defs>
        <linearGradient id={`${id}-core`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--chart-3)" />
          <stop offset="1" stopColor="var(--primary)" />
        </linearGradient>
      </defs>
      <Glow id={`${id}-glow`} cx={180} cy={110} r={150} opacity={0.2} />
      {nodes.map(([x, y]) => (
        <path
          key={`l${x}${y}`}
          d={`M180 110C${(180 + x) / 2} 110 ${(180 + x) / 2} ${y} ${x} ${y}`}
          stroke="var(--primary)"
          strokeOpacity="0.4"
          strokeWidth="2"
          strokeDasharray="1 6"
          strokeLinecap="round"
        />
      ))}
      <circle cx="180" cy="110" r="40" fill="var(--primary)" opacity="0.12" />
      <circle cx="180" cy="110" r="28" fill={`url(#${id}-core)`} />
      <path d="M168 110h24M180 98v24M171 101l18 18M189 101l-18 18" stroke="var(--primary-foreground)" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
      {nodes.map(([x, y, tone], index) => (
        <g key={`n${index}`} transform={`translate(${x - 22} ${y - 22})`}>
          <rect width="44" height="44" rx="12" fill="var(--card)" stroke="var(--border)" />
          <rect x="11" y="11" width="22" height="22" rx="7" fill={tone} opacity="0.9" />
          {index === 0 ? <path d="M17 19h10M17 23h10M17 27h6" stroke="var(--card)" strokeWidth="2" strokeLinecap="round" /> : null}
          {index === 1 ? <path d="M17 22l4 4 7-8" stroke="var(--card)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {index === 2 ? <path d="M19 25l6-6M17 21a3 3 0 0 1 4-4M27 23a3 3 0 0 1-4 4" stroke="var(--card)" strokeWidth="2" strokeLinecap="round" /> : null}
          {index === 3 ? <path d="M16 28a6 6 0 0 1 12 0M22 28l3-4" stroke="var(--card)" strokeWidth="2.2" strokeLinecap="round" /> : null}
        </g>
      ))}
      <g transform="translate(6 92)">
        <rect width="52" height="36" rx="8" fill="var(--card)" stroke="var(--border)" />
        <rect x="8" y="9" width="30" height="4" rx="2" fill="var(--foreground)" opacity="0.5" />
        <rect x="8" y="17" width="36" height="3" rx="1.5" fill="var(--muted-foreground)" opacity="0.4" />
        <rect x="8" y="24" width="24" height="3" rx="1.5" fill="var(--muted-foreground)" opacity="0.4" />
      </g>
      <path d="M60 110h12" stroke="var(--primary)" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
      <g transform="translate(302 86)">
        <rect width="52" height="48" rx="8" fill="var(--card)" stroke="var(--border)" />
        {[0, 1, 2].map((row) => (
          <g key={row}>
            <rect x="8" y={9 + row * 11} width="6" height="6" rx="2" fill={row === 2 ? "var(--primary)" : "var(--success)"} opacity="0.9" />
            <rect x="18" y={10 + row * 11} width={row === 1 ? 18 : 26} height="4" rx="2" fill="var(--muted-foreground)" opacity="0.45" />
          </g>
        ))}
      </g>
      <path d="M288 110h12" stroke="var(--primary)" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
      <Sparkle x={140} y={34} size={6} color="var(--chart-2)" />
      <Sparkle x={226} y={190} size={5} color="var(--chart-3)" />
      <Sparkle x={330} y={40} size={7} color="var(--primary)" />
    </Frame>
  );
}

/** Synapse's mark: three connected nodes on the brand gradient. */
export function SynapseMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" aria-hidden focusable="false" className={cn("size-8", className)}>
      <defs>
        <linearGradient id={`${id}-mark`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.62 0.22 293)" />
          <stop offset="1" stopColor="oklch(0.52 0.25 270)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id}-mark)`} />
      <path d="M10 21.5L16 10.5L22 21.5Z" stroke="white" strokeOpacity="0.55" strokeWidth="1.6" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="10.5" r="3.2" fill="white" />
      <circle cx="10" cy="21.5" r="2.7" fill="white" fillOpacity="0.9" />
      <circle cx="22" cy="21.5" r="2.7" fill="white" fillOpacity="0.9" />
    </svg>
  );
}
