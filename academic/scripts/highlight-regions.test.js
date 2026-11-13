import test from "node:test";
import assert from "node:assert/strict";
import { uncoveredRegions } from "../src/utils/highlightRegions.js";

test("reselecting highlighted text adds no duplicate region", () => {
  const rect = [[10, 20], [50, 30]];
  assert.deepEqual(uncoveredRegions(rect, [rect]), []);
});
test("partly overlapping text adds only uncovered area", () => {
  assert.deepEqual(uncoveredRegions([[10, 20], [70, 30]], [[[10, 20], [50, 30]]]), [[[50, 20], [70, 30]]]);
});
test("overlapping selection rectangles and separate lines stay disjoint", () => {
  assert.deepEqual(uncoveredRegions([[10, 20], [70, 30]], [[[10, 20], [40, 30]], [[30, 20], [60, 30]]]), [[[60, 20], [70, 30]]]);
  assert.deepEqual(uncoveredRegions([[10, 40], [70, 50]], [[[10, 20], [70, 30]]]), [[[10, 40], [70, 50]]]);
});
