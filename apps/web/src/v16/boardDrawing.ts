export type Point = [number, number];
export type Drawing = { version: 1; width: number; points: Point[] };
export const MAX_POINTS = 128;
export const coordinate = (n: number) =>
  Math.max(0, Math.min(100000, Math.round(n)));
export function readDrawing(body: string): Drawing | undefined {
  try {
    const d = JSON.parse(body);
    if (
      d.version !== 1 ||
      !Number.isInteger(d.width) ||
      d.width < 1 ||
      d.width > 32 ||
      !Array.isArray(d.points) ||
      !d.points.length ||
      d.points.length > MAX_POINTS
    )
      return;
    if (
      !d.points.every(
        (p: unknown) =>
          Array.isArray(p) &&
          p.length === 2 &&
          p.every((n) => Number.isInteger(n) && n >= 0 && n <= 100000),
      )
    )
      return;
    return d;
  } catch {
    return;
  }
}
export function appendPoint(
  points: Point[],
  point: Point,
  force = false,
): Point[] {
  const last = points.at(-1)!;
  const distance = Math.hypot(point[0] - last[0], point[1] - last[1]);
  if (distance === 0 || (!force && distance < 2)) return points;
  // Resample long gestures while preserving both endpoints and bounding the payload.
  const sampled =
    points.length >= MAX_POINTS
      ? points.filter((_, i) => i % 2 === 0 || i === points.length - 1)
      : points;
  return [...sampled, point];
}
export function finishDrawing(points: Point[], width: number) {
  const x = Math.min(...points.map((p) => p[0])),
    y = Math.min(...points.map((p) => p[1]));
  return {
    x,
    y,
    body: JSON.stringify({
      version: 1,
      width,
      points: points.map((p) => [p[0] - x, p[1] - y]),
    }),
  };
}
export function drawingPath(points: Point[]) {
  // A tiny segment makes a single click a visible round brush dot.
  return `M${points.map((p) => p.join(",")).join(" L")}${points.length === 1 ? " l0.01,0" : ""}`;
}
