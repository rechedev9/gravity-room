import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listProgramSummaries } from '../../lib/programs/program-repository';
import { MessageState } from '../../ui/message-state';
import { TrackerScreen } from './tracker-screen';

type TrackerHomeState =
  | { readonly status: 'loading' }
  | { readonly status: 'empty' }
  | { readonly status: 'ready'; readonly programInstanceId: string }
  | { readonly status: 'error' };

export function TrackerHomeScreen() {
  const { t } = useTranslation();
  const [state, setState] = useState<TrackerHomeState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadActiveProgram(): Promise<void> {
      try {
        const programs = await listProgramSummaries();
        if (!active) {
          return;
        }

        const activeProgram = programs[0];
        setState(
          activeProgram
            ? { status: 'ready', programInstanceId: activeProgram.id }
            : { status: 'empty' }
        );
      } catch {
        if (active) {
          setState({ status: 'error' });
        }
      }
    }

    setState({ status: 'loading' });
    void loadActiveProgram();

    return () => {
      active = false;
    };
  }, [reloadToken]);

  const retry = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  if (state.status === 'loading') {
    return <MessageState body={t('tracker.loading')} title={t('nav.tracker')} />;
  }

  if (state.status === 'empty') {
    return <MessageState body={t('tracker.empty_body')} title={t('tracker.empty_title')} />;
  }

  if (state.status === 'error') {
    return (
      <MessageState
        actionAccessibilityLabel={t('tracker.retry_accessibility')}
        actionLabel={t('common.retry')}
        body={t('tracker.load_error_body')}
        onAction={retry}
        title={t('tracker.load_error_title')}
      />
    );
  }

  return <TrackerScreen programInstanceId={state.programInstanceId} />;
}
