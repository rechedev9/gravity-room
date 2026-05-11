import { StaggerContainer, StaggerItem } from '@/lib/motion-primitives';

interface DashboardShellProps {
  readonly hero: React.ReactNode;
  readonly kpi: React.ReactNode;
  readonly heatmap: React.ReactNode;
  readonly split: React.ReactNode;
  readonly recent: React.ReactNode;
}

export function DashboardShell({
  hero,
  kpi,
  heatmap,
  split,
  recent,
}: DashboardShellProps): React.ReactNode {
  return (
    <StaggerContainer className="flex flex-col gap-6 max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <StaggerItem>{hero}</StaggerItem>
      <StaggerItem>{kpi}</StaggerItem>
      <StaggerItem>{heatmap}</StaggerItem>
      <StaggerItem>{split}</StaggerItem>
      <StaggerItem>{recent}</StaggerItem>
    </StaggerContainer>
  );
}
