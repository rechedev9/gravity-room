import { describe, expect, it } from 'vitest';
import {
  HOME_HEATMAP_MIN_SESSIONS,
  HOME_QUICK_LINKS_MIN_SESSIONS,
  HOME_RECENT_MIN_SESSIONS,
  HOME_SPLIT_MIN_SESSIONS,
  getHomeDashboardLayout,
} from './home-dashboard-layout';

describe('getHomeDashboardLayout', () => {
  it('hides progressive widgets on day zero (no sessions yet)', () => {
    expect(getHomeDashboardLayout(0)).toEqual({
      showHeatmap: false,
      showPrRoad: false,
      showMentorPill: false,
      showRecent: false,
      showQuickLinks: false,
    });
  });

  it('shows recent activity after the first session, still hides density widgets', () => {
    const layout = getHomeDashboardLayout(HOME_RECENT_MIN_SESSIONS);
    expect(layout.showRecent).toBe(true);
    expect(layout.showHeatmap).toBe(false);
    expect(layout.showPrRoad).toBe(false);
    expect(layout.showMentorPill).toBe(false);
    expect(layout.showQuickLinks).toBe(false);
  });

  it('unlocks PR road, mentor, and quick links once the split threshold is met', () => {
    const layout = getHomeDashboardLayout(HOME_SPLIT_MIN_SESSIONS);
    expect(layout.showRecent).toBe(true);
    expect(layout.showPrRoad).toBe(true);
    expect(layout.showMentorPill).toBe(true);
    expect(layout.showQuickLinks).toBe(true);
    expect(layout.showHeatmap).toBe(false);
  });

  it('shows the heatmap only when enough history exists to read density', () => {
    expect(getHomeDashboardLayout(HOME_HEATMAP_MIN_SESSIONS - 1).showHeatmap).toBe(false);
    expect(getHomeDashboardLayout(HOME_HEATMAP_MIN_SESSIONS).showHeatmap).toBe(true);
  });

  it('keeps thresholds ordered so denser widgets unlock later', () => {
    expect(HOME_RECENT_MIN_SESSIONS).toBeLessThanOrEqual(HOME_SPLIT_MIN_SESSIONS);
    expect(HOME_SPLIT_MIN_SESSIONS).toBeLessThanOrEqual(HOME_HEATMAP_MIN_SESSIONS);
    expect(HOME_QUICK_LINKS_MIN_SESSIONS).toBe(HOME_SPLIT_MIN_SESSIONS);
  });
});
