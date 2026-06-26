/**
 * Python-compatible decimal rounding.
 *
 * The Python analytics pipelines round payload values with the built-in
 * `round(x, ndigits)`, which rounds half to even (banker's rounding) on the
 * underlying binary float. JavaScript's `Math.round` rounds half toward +Inf,
 * so a naive `Math.round(x * 10**n) / 10**n` diverges from Python on exact
 * half-way values (and on negative numbers). `pyRound` reproduces Python's
 * round-half-to-even, keeping the stored insight payloads bit-stable against
 * the Python service for the values these pipelines emit.
 */
export function pyRound(value: number, ndigits: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** ndigits;
  const scaled = value * factor;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;

  let rounded: number;
  if (Math.abs(diff - 0.5) < 1e-9) {
    // Exact half: round to even.
    rounded = floor % 2 === 0 ? floor : floor + 1;
  } else {
    rounded = Math.round(scaled);
  }
  return rounded / factor;
}
