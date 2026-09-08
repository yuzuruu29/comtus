import { describe, expect, it } from "vitest";
import { findPageBreak } from "./assessmentExport";

describe("assessment export pagination", () => {
  it("breaks at whitespace without cutting a math row", () => {
    const rows = Array<boolean>(100).fill(false);
    rows[38] = rows[39] = true;
    expect(findPageBreak(rows, 0, 50)).toBe(39);
    expect(findPageBreak(rows, 40, 50)).toBe(40);
    expect(findPageBreak(rows, 80, 50)).toBe(100);
  });
});
