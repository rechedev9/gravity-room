import { StaggerContainer, StaggerItem } from '@/lib/motion-primitives';

interface DashboardShellProps {
  /**
   * Optional onboarding row (mentor tour widget + home zone hint) pinned above
   * the hero. Rendered as a bare flex child, so when its contents return null
   * (the common, already-dismissed case) it collapses to nothing, no stray gap.
   */
  readonly mentor?: React.ReactNode;
  readonly hero: React.ReactNode;
  /** Omit for a pristine user: the hero already owns the day-one message. */
  readonly kpi?: React.ReactNode;
  /** Temporary guidance while progressive dashboard modules are still locked. */
  readonly guide?: React.ReactNode;
  /** Progressive: omit until enough sessions for a readable density signal. */
  readonly heatmap?: React.ReactNode;
  /** Progressive: PR road + mentor quote row. */
  readonly split?: React.ReactNode;
  /** Progressive: recent sessions list. */
  readonly recent?: React.ReactNode;
}

export function DashboardShell({
  mentor,
  hero,
  kpi,
  guide,
  heatmap,
  split,
  recent,
}: DashboardShellProps): React.ReactNode {
  return (
    <StaggerContainer className="flex flex-col gap-6 max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {mentor}
      <StaggerItem>{hero}</StaggerItem>
      {kpi != null ? <StaggerItem>{kpi}</StaggerItem> : null}
      {guide != null ? <StaggerItem>{guide}</StaggerItem> : null}
      {heatmap != null ? <StaggerItem>{heatmap}</StaggerItem> : null}
      {split != null ? <StaggerItem>{split}</StaggerItem> : null}
      {recent != null ? <StaggerItem>{recent}</StaggerItem> : null}
    </StaggerContainer>
  );
}
