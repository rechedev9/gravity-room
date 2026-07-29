/**
 * Progressive disclosure rules for the authenticated home dashboard.
 *
 * Early training history is sparse — showing an empty 12-week heatmap and a
 * PR road of zeros reads as abandonment, not potential. Widgets unlock as
 * soon as they carry a signal.
 */

export const HOME_RECENT_MIN_SESSIONS = 1;
export const HOME_SPLIT_MIN_SESSIONS = 3;
export const HOME_QUICK_LINKS_MIN_SESSIONS = HOME_SPLIT_MIN_SESSIONS;
export const HOME_HEATMAP_MIN_SESSIONS = 5;

export interface HomeDashboardLayout {
  readonly showHeatmap: boolean;
  readonly showPrRoad: boolean;
  readonly showMentorPill: boolean;
  readonly showRecent: boolean;
  readonly showQuickLinks: boolean;
}

export function getHomeDashboardLayout(totalSessions: number): HomeDashboardLayout {
  const sessions = Number.isFinite(totalSessions) ? Math.max(0, totalSessions) : 0;
  return {
    showHeatmap: sessions >= HOME_HEATMAP_MIN_SESSIONS,
    showPrRoad: sessions >= HOME_SPLIT_MIN_SESSIONS,
    showMentorPill: sessions >= HOME_SPLIT_MIN_SESSIONS,
    showRecent: sessions >= HOME_RECENT_MIN_SESSIONS,
    showQuickLinks: sessions >= HOME_QUICK_LINKS_MIN_SESSIONS,
  };
}
