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
  subscribeWeightUnit,
  writeWeightUnit,
  writeWeightUnitOwner,
} from '@/lib/weight-unit';

/**
 * Keeps the browser's unit and the account's unit equal for a signed-in user.
 *
 * - Once per sign-in or restore the account value wins, except for one case: a
 *   unit chosen as a guest (no owner recorded) that is not the default is
 *   pushed up to the account.
 * - Later changes made anywhere in the app are written to the account.
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
      updateProfile({ weightUnit: unit }).then(
        (saved) => {
          queryClient.setQueryData(queryKeys.auth.session, (prev: UserInfo | null | undefined) =>
            prev && saved.weightUnit !== undefined
              ? { ...prev, weightUnit: saved.weightUnit }
              : prev
          );
        },
        () => {
          // Offline or rejected: the browser keeps the choice and the next
          // change is sent again.
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
    if (owner === null && local !== null && local !== known && known === 'kg') {
      push(local);
    } else if (readWeightUnit() !== known) {
      writeWeightUnit(known);
    }

    return subscribeWeightUnit(() => {
      const unit = readWeightUnit();
      if (unit !== lastSentRef.current) push(unit);
    });
  }, [userId, hasAccountUnit, queryClient]);
}
