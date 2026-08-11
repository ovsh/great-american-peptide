/**
 * How tall a chart stands on the screen it was handed.
 *
 * The number written in the code is the phone height, and it stays the phone
 * height: it is the floor of the clamp, and no iPhone is wide enough to lift the
 * result off that floor. An iPad hands the same card half as much width again,
 * and a band of the phone's height stretched across it reads as a strip in a
 * tall empty screen, so past that point the height follows the width.
 *
 * The growth is capped, because every one of these charts shares its card with
 * something that has to stay above the fold: the log band on Progress, the peak,
 * trough and average under the level curve.
 *
 * `width` and `fixed` must describe the same rendered block. A chart inside a
 * padded card counts that padding into both, so the ratio reads the block the
 * user sees rather than the drawing surface inside it.
 *
 * Only the width-derived term is rounded. `fixed` is returned as it was given,
 * so a caller whose natural height lands on a half point gets that half point
 * back and no layout moves by the width of a rounding.
 */
const WIDTH_RATIO = 0.55;
const GROWTH_CAP = 96;

export function chartHeightFor(width: number, fixed: number): number {
  return Math.min(Math.max(fixed, Math.round(width * WIDTH_RATIO)), fixed + GROWTH_CAP);
}
