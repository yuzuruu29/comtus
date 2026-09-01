import { describe, expect, it } from "vitest";
import { studioNotebookIdFromPath } from "./studioPath";

describe("studioNotebookIdFromPath", () => {
  it("treats the shelf path as no notebook", () => {
    expect(studioNotebookIdFromPath("/studio")).toBeUndefined();
    expect(studioNotebookIdFromPath("/studio/")).toBeUndefined();
  });

  it("reads the id from /studio/:id even when useParams is stale", () => {
    expect(studioNotebookIdFromPath("/studio/mtimvl76-kffywfn")).toBe("mtimvl76-kffywfn");
  });
});
