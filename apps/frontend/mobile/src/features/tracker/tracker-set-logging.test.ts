import {
  appendSetLog,
  deriveCompletedSlotResult,
  nextSetIndex,
  popSetLog,
  slotLogKey,
  slotSupportsSetFlow,
} from './tracker-set-logging';

describe('tracker set logging', () => {
  it('appends sets until the slot is complete and then derives success', () => {
    const first = appendSetLog(undefined, { reps: 3, weight: 60 });
    const second = appendSetLog(first, { reps: 3, weight: 60 });

    expect(nextSetIndex(first)).toBe(1);
    expect(nextSetIndex(second)).toBe(2);
    expect(deriveCompletedSlotResult(second, 3)).toBe('success');
  });

  it('derives fail when a logged set is under the target', () => {
    expect(
      deriveCompletedSlotResult(
        [
          { reps: 3, weight: 60 },
          { reps: 1, weight: 60 },
        ],
        3
      )
    ).toBe('fail');
  });

  it('pops the latest draft set and keys logs by workout and slot', () => {
    const logs = appendSetLog([{ reps: 3 }], { reps: 3 });
    expect(popSetLog(logs)).toEqual([{ reps: 3 }]);
    expect(popSetLog([{ reps: 3 }])).toBeUndefined();
    expect(slotLogKey(2, 'squat-t1')).toBe('2:squat-t1');
  });

  it('keeps prescription, GPP, and test slots on the slot-level fallback', () => {
    expect(
      slotSupportsSetFlow({ prescriptions: undefined, isGpp: undefined, isTestSlot: undefined })
    ).toBe(true);
    expect(
      slotSupportsSetFlow({
        prescriptions: [{ percent: 70, reps: 5, sets: 3, weight: 60 }],
        isGpp: undefined,
        isTestSlot: undefined,
      })
    ).toBe(false);
  });
});
