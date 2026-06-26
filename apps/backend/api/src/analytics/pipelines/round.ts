/**
 * Python-compatible decimal rounding.
 *
 * The Python analytics pipelines round payload values with the built-in
 * `round(x, ndigits)`, which is "correct rounding": it rounds the TRUE decimal
 * value of the IEEE-754 double to `ndigits` places, breaking exact halves to
 * even (banker's rounding). JavaScript's `Math.round` rounds half toward +Inf,
 * and a naive `Math.round(x * 10**n) / 10**n` both rounds the wrong way on ties
 * AND tests the tie on the binary-scaled value, so it diverges from Python on
 * values like 2.675 (Python 2.67), 116.65 (Python 116.7), 107.915 (Python
 * 107.91), and 2.665 (Python 2.67).
 *
 * `pyRound` reproduces CPython faithfully: it expands the double to its true
 * decimal value with `toFixed` (which yields the correctly-rounded decimal of
 * the underlying binary value) and applies decimal round-half-to-even at
 * `ndigits` on that string, so the stored insight payloads stay bit-stable
 * against the Python service.
 */
export function pyRound(value: number, ndigits: number): number {
  if (!Number.isFinite(value)) return value;

  const negative = value < 0 || Object.is(value, -0);
  // Expand the magnitude to its true decimal value. `ndigits + 20` guard digits
  // past the rounding place are enough to tell a genuine half-way tie (the value
  // is exactly k.5 * 10^-ndigits) from one that only looks like a tie because of
  // the binary representation. toFixed caps at 100 fractional digits.
  const precision = Math.min(100, Math.max(0, ndigits) + 20);
  const fixed = Math.abs(value).toFixed(precision);

  const rounded = roundHalfToEvenDecimal(fixed, ndigits);
  const result = Number(rounded);
  return negative ? -result : result;
}

/**
 * Round a NON-negative decimal string `s` ("int" or "int.frac") to `ndigits`
 * fractional digits using round-half-to-even. `ndigits` is assumed >= 0 (the
 * pipelines never round to negative places).
 */
function roundHalfToEvenDecimal(s: string, ndigits: number): string {
  const [intPart, fracPart = ''] = s.split('.');
  if (ndigits >= fracPart.length) return s;

  const keptFrac = fracPart.slice(0, ndigits);
  const dropped = fracPart.slice(ndigits); // guaranteed non-empty by the guard above

  // Digits we may carry into: the integer part followed by the kept fraction.
  const digits = (intPart + keptFrac).split('');

  const firstDropped = dropped.charAt(0);
  let roundUp: boolean;
  if (firstDropped > '5') {
    roundUp = true;
  } else if (firstDropped < '5') {
    roundUp = false;
  } else if (/[1-9]/.test(dropped.slice(1))) {
    // "5" followed by a non-zero digit → strictly greater than a half.
    roundUp = true;
  } else {
    // Exact tie → round to even: only round up if the last kept digit is odd.
    const lastKept = digits[digits.length - 1] ?? '0';
    roundUp = (lastKept.charCodeAt(0) - 48) % 2 === 1;
  }

  if (roundUp) {
    let i = digits.length - 1;
    for (; i >= 0; i--) {
      const d = digits[i] ?? '0';
      if (d === '9') {
        digits[i] = '0';
      } else {
        digits[i] = String.fromCharCode(d.charCodeAt(0) + 1);
        break;
      }
    }
    if (i < 0) digits.unshift('1');
  }

  const intLen = digits.length - ndigits;
  const newInt = digits.slice(0, intLen).join('');
  const newFrac = digits.slice(intLen).join('');
  return ndigits > 0 ? `${newInt}.${newFrac}` : newInt;
}
