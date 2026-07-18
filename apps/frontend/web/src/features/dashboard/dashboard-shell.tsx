import { StaggerContainer, StaggerItem } from '@/lib/motion-primitives';

interface DashboardShellProps {
  readonly header: React.ReactNode;
  readonly mentor?: React.ReactNode;
  readonly hero: React.ReactNode;
  readonly program: React.ReactNode;
  readonly kpi?: React.ReactNode;
  readonly heatmap?: React.ReactNode;
  readonly split?: React.ReactNode;
  readonly recent?: React.ReactNode;
}

export function DashboardShell({
  header,
  mentor,
  hero,
  program,
  kpi,
  heatmap,
  split,
  recent,
}: DashboardShellProps): React.ReactNode {
  return (
    <StaggerContainer className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <StaggerItem>
        <div className="grid items-end gap-4 lg:grid-cols-[minmax(260px,0.72fr)_minmax(420px,1.28fr)]">
          {header}
          {mentor}
        </div>
      </StaggerItem>
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.9fr)]">
        <StaggerItem>{hero}</StaggerItem>
        <StaggerItem>{program}</StaggerItem>
      </div>
      {kpi && <StaggerItem>{kpi}</StaggerItem>}
      {heatmap && <StaggerItem>{heatmap}</StaggerItem>}
      {split && <StaggerItem>{split}</StaggerItem>}
      {recent && <StaggerItem>{recent}</StaggerItem>}
    </StaggerContainer>
  );
}
