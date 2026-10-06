import { expect, it } from "vitest";
import {
  appendPoint,
  coordinate,
  drawingPath,
  finishDrawing,
  readDrawing,
} from "../../../apps/web/src/v16/boardDrawing";
it("bounds long gestures and preserves endpoints in a valid compact relative drawing", () => {
  let points: [number, number][] = [[120, 180]];
  for (let i = 1; i < 2000; i++)
    points = appendPoint(points, [120 + i, 180 + i]);
  points = appendPoint(points, [2119, 2179], true);
  expect(points.length).toBeLessThanOrEqual(128);
  expect(points[0]).toEqual([120, 180]);
  expect(points.at(-1)).toEqual([2119, 2179]);
  const result = finishDrawing(points, 4);
  expect(result.x).toBe(120);
  expect(result.y).toBe(180);
  expect(readDrawing(result.body)?.points[0]).toEqual([0, 0]);
  expect(result.body.length).toBeLessThan(4000);
  expect(drawingPath([[0, 0]])).toContain("l0.01,0");
  expect(coordinate(-5)).toBe(0);
  expect(coordinate(100001)).toBe(100000);
});
it("rejects untrusted drawing shapes and nonfinite coordinates", () => {
  for (const body of [
    "<script>",
    "null",
    "{}",
    JSON.stringify({ version: 1, width: 4, points: [[0, "1"]] }),
    JSON.stringify({ version: 1, width: 4, points: [[null, 0]] }),
  ])
    expect(readDrawing(body)).toBeUndefined();
});
