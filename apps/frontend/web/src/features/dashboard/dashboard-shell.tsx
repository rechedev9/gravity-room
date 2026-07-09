import { StaggerContainer, StaggerItem } from '@/lib/motion-primitives';

interface DashboardShellProps {
  /**
   * Optional onboarding row (mentor tour widget + home zone hint) pinned above
   * the hero. Rendered as a bare flex child, so when its contents return null
   * (the common, already-dismissed case) it collapses to nothing, no stray gap.
   */
  readonly mentor?: React.ReactNode;
  readonly hero: React.ReactNode;
  readonly kpi: React.ReactNode;
  readonly heatmap: React.ReactNode;
  readonly split: React.ReactNode;
  readonly recent: React.ReactNode;
}

export function DashboardShell({
  mentor,
  hero,
  kpi,
  heatmap,
  split,
  recent,
}: DashboardShellProps): React.ReactNode {
  return (
    <StaggerContainer className="flex flex-col gap-6 max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {mentor}
      <StaggerItem>{hero}</StaggerItem>
      <StaggerItem>{kpi}</StaggerItem>
      <StaggerItem>{heatmap}</StaggerItem>
      <StaggerItem>{split}</StaggerItem>
      <StaggerItem>{recent}</StaggerItem>
    </StaggerContainer>
  );
}
