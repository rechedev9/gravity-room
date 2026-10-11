import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Chip } from './chip';

describe('Chip', () => {
  it('exposes the selected state to assistive tech', () => {
    render(
      <Chip selected onClick={() => undefined}>
        Beginner
      </Chip>
    );
    expect(screen.getByRole('button', { name: 'Beginner' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('calls onClick and ignores clicks while disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Chip onClick={onClick}>All</Chip>);
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Chip disabled onClick={onClick}>
        All
      </Chip>
    );
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
