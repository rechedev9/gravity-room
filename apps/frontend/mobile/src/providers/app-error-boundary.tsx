import { Component, type PropsWithChildren, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { MessageState } from '../ui/message-state';

interface AppErrorBoundaryState {
  readonly failed: boolean;
}

interface AppErrorFallbackProps {
  readonly onRetry: () => void;
}

function AppErrorFallback({ onRetry }: AppErrorFallbackProps) {
  const { t } = useTranslation();

  return (
    <MessageState
      actionAccessibilityLabel={t('startup.error_retry_accessibility')}
      actionLabel={t('common.retry')}
      body={t('startup.error_body')}
      onAction={onRetry}
      title={t('startup.error_title')}
    />
  );
}

export class AppErrorBoundary extends Component<PropsWithChildren, AppErrorBoundaryState> {
  public state: AppErrorBoundaryState = { failed: false };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  private readonly retry = (): void => {
    this.setState({ failed: false });
  };

  public render(): ReactNode {
    if (this.state.failed) {
      return <AppErrorFallback onRetry={this.retry} />;
    }

    return this.props.children;
  }
}
