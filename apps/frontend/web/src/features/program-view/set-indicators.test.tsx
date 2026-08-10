import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetIndicators } from './set-indicators';

describe('SetIndicators', () => {
  it('renders nothing when sets is zero or negative', () => {
    const { container } = render(<SetIndicators sets={0} result={undefined} isAmrap={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders decorative circles when onSetTap is absent', () => {
    render(<SetIndicators sets={3} result="success" isAmrap={false} />);
    expect(screen.getByLabelText('3 series')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('only enables the next unlogged set for sequential logging', () => {
    const onSetTap = vi.fn();
    render(
      <SetIndicators
        sets={5}
        result={undefined}
        isAmrap={true}
        targetReps={3}
        setLogs={[{ reps: 3 }]}
        onSetTap={onSetTap}
      />
    );

    // Set 1 completed; only set 2 is tappable
    expect(screen.getByLabelText('Serie 1: 3 repeticiones')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar serie 2 de 5' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Registrar serie 1 de 5' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Registrar serie 3 de 5' })
    ).not.toBeInTheDocument();
  });

  it('opens the stepper and confirms reps via onSetTap', () => {
    const onSetTap = vi.fn();
    render(
      <SetIndicators
        sets={3}
        result={undefined}
        isAmrap={false}
        targetReps={5}
        setLogs={[]}
        onSetTap={onSetTap}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Registrar serie 1 de 3' }));

    // Stepper shows with target reps as initial value
    expect(screen.getByText('5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar reps' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reps' }));

    expect(onSetTap).toHaveBeenCalledTimes(1);
    expect(onSetTap).toHaveBeenCalledWith(0, 6);
  });

  it('cancels the stepper without calling onSetTap', () => {
    const onSetTap = vi.fn();
    render(
      <SetIndicators
        sets={3}
        result={undefined}
        isAmrap={false}
        targetReps={5}
        onSetTap={onSetTap}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Registrar serie 1 de 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onSetTap).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Registrar serie 1 de 3' })).toBeInTheDocument();
  });

  it('shows committed set logs as completed and is not interactive once result is set', () => {
    render(
      <SetIndicators
        sets={3}
        result="success"
        isAmrap={false}
        targetReps={5}
        committedSetLogs={[{ reps: 5 }, { reps: 5 }, { reps: 4 }]}
        onSetTap={vi.fn()}
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Serie 3: 4 repeticiones')).toBeInTheDocument();
  });

  it('marks a completed set below target with the fail color class', () => {
    render(
      <SetIndicators
        sets={2}
        result={undefined}
        isAmrap={false}
        targetReps={5}
        setLogs={[{ reps: 3 }]}
        onSetTap={vi.fn()}
      />
    );

    const failed = screen.getByLabelText('Serie 1: 3 repeticiones');
    expect(failed.className).toMatch(/fail/);
  });

  it('starts the first set enabled when there are no logs yet', () => {
    render(
      <SetIndicators sets={5} result={undefined} isAmrap={true} targetReps={3} onSetTap={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: 'Registrar serie 1 de 5' })).toBeInTheDocument();
  });
});
