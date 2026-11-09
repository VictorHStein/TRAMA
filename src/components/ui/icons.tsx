import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number, props: IconProps) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

/** Mission: a target. */
export function IconMission({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
    </svg>
  );
}

/** Requirement: a document with lines. */
export function IconRequirement({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <path d="M4 1.5h5.5L13 5v9.5H4z" />
      <path d="M9.5 1.5V5H13M6 8h4M6 10.5h4" />
    </svg>
  );
}

/** Function: a branching flow. */
export function IconFunction({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <circle cx="3.5" cy="8" r="1.8" />
      <circle cx="12.5" cy="3.5" r="1.8" />
      <circle cx="12.5" cy="12.5" r="1.8" />
      <path d="M5.3 8h2.2c1.5 0 2.2-.8 3-2.2l.3-.6M5.3 8h2.2c1.5 0 2.2.8 3 2.2l.3.6" />
    </svg>
  );
}

/** Subsystem: a box. */
export function IconSubsystem({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <path d="M8 1.5 14 4.5v7L8 14.5 2 11.5v-7z" />
      <path d="M2 4.5l6 3 6-3M8 7.5v7" />
    </svg>
  );
}

/** Component: a chip. */
export function IconComponent({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <rect x="4" y="4" width="8" height="8" rx="1" />
      <path d="M6 1.5v2.5M10 1.5V4M6 12v2.5M10 12v2.5M1.5 6H4M1.5 10H4M12 6h2.5M12 10h2.5" />
    </svg>
  );
}

/** Verification: a check inside a circle. */
export function IconVerification({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="m5 8.2 2 2 4-4.4" />
    </svg>
  );
}

/** Objective: a flag on a pole. */
export function IconObjective({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <path d="M3.5 14.5V1.5" />
      <path d="M3.5 2.5h8.5l-2 3 2 3H3.5" />
    </svg>
  );
}

/** Segment: stacked layers (space, ground, launch). */
export function IconSegment({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <path d="M8 2 14.5 5 8 8 1.5 5z" />
      <path d="M1.5 8 8 11l6.5-3M1.5 11 8 14l6.5-3" />
    </svg>
  );
}

/** Generic fallback: a dot. */
export function IconGeneric({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconChevronRight({ size = 12, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}

const BY_CATEGORY: Record<string, (p: IconProps) => JSX.Element> = {
  mission: IconMission,
  objective: IconObjective,
  segment: IconSegment,
  requirement: IconRequirement,
  function: IconFunction,
  subsystem: IconSubsystem,
  component: IconComponent,
  verification: IconVerification,
};

/** Icon for a category id (falls back to a dot for custom categories). */
export function CategoryIcon({ category, size = 16, ...p }: IconProps & { category: string }) {
  const Icon = BY_CATEGORY[category] ?? IconGeneric;
  return <Icon size={size} {...p} />;
}
