import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { UserInfo } from '@gzclp/domain/schemas/user';
import type { WeightUnit } from '@gzclp/domain/weight-unit';
import { updateProfile } from '@/lib/api-core';
import { queryKeys } from '@/lib/query-keys';
import {
  readStoredWeightUnit,
  readWeightUnit,
  readWeightUnitOwner,
  readWeightUnitPending,
  subscribeWeightUnit,
  writeWeightUnit,
  writeWeightUnitOwner,
  writeWeightUnitPending,
} from '@/lib/weight-unit';

/**
 * Keeps the browser's unit and the account's unit equal for a signed-in user.
 *
 * - Once per sign-in or restore the account value wins, except for one case: a
 *   unit chosen as a guest (no owner recorded) that is not the default is
 *   pushed up to the account.
 * - Later changes made anywhere in the app are written to the account.
 * - A write the account has not accepted stays marked as pending, so the next
 *   load sends it again instead of replacing it with the account value.
 *
 * Guests and API versions that send no unit stay purely local.
 */
export function useWeightUnitAccountSync(user: UserInfo | null): void {
  const queryClient = useQueryClient();
  const userId = user?.id;
  const accountUnit = user?.weightUnit;
  const hasAccountUnit = accountUnit !== undefined;
  const accountUnitRef = useRef<WeightUnit | undefined>(accountUnit);
  accountUnitRef.current = accountUnit;
  // Last unit sent or known to the account, so a toggle is never sent twice.
  const lastSentRef = useRef<WeightUnit | undefined>(accountUnit);

  useEffect(() => {
    if (userId === undefined || !hasAccountUnit) return;

    const push = (unit: WeightUnit): void => {
      lastSentRef.current = unit;
      writeWeightUnitPending(userId);
      updateProfile({ weightUnit: unit }).then(
        (saved) => {
          // A newer change may still be on its way: only the latest one settles the mark.
          if (readWeightUnit() === unit) writeWeightUnitPending(null);
          queryClient.setQueryData(queryKeys.auth.session, (prev: UserInfo | null | undefined) =>
            prev && saved.weightUnit !== undefined
              ? { ...prev, weightUnit: saved.weightUnit }
              : prev
          );
        },
        () => {
          // Offline or rejected: the pending mark makes the next load resend it,
          // and the next change is sent again.
          lastSentRef.current = accountUnitRef.current;
        }
      );
    };

    const known = accountUnitRef.current;
    if (known === undefined) return;
    const owner = readWeightUnitOwner();
    const local = readStoredWeightUnit();
    writeWeightUnitOwner(userId);
    lastSentRef.current = known;
    const isGuestChoice = owner === null && known === 'kg';
    const isRejectedWrite = owner === userId && readWeightUnitPending() === userId;
    if (local !== null && local !== known && (isGuestChoice || isRejectedWrite)) {
      push(local);
    } else {
      writeWeightUnitPending(null);
      if (readWeightUnit() !== known) writeWeightUnit(known);
    }

    return subscribeWeightUnit(() => {
      const unit = readWeightUnit();
      if (unit !== lastSentRef.current) push(unit);
    });
  }, [userId, hasAccountUnit, queryClient]);
}
