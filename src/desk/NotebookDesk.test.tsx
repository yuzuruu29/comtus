import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AddSourceKind } from "../studio/AddSourceMenu";
import NotebookDesk from "./NotebookDesk";

const sourcesProps: Array<{ addRequest?: number; addKind?: AddSourceKind; onAddRequestConsumed?: () => void }> = [];

vi.mock("../studio/SourcesPane", () => ({
  default: (props: { addRequest?: number; addKind?: AddSourceKind; onAddRequestConsumed?: () => void }) => {
    sourcesProps.push(props);
    return (
      <div>
        <span data-testid="sources-kind">{props.addKind ?? "none"}</span>
        <span data-testid="sources-req">{props.addRequest ?? 0}</span>
        <button type="button" onClick={props.onAddRequestConsumed}>
          consume
        </button>
      </div>
    );
  },
}));

vi.mock("../studio/ChatPane", () => ({
  default: ({ onAddSources }: { onAddSources?: (kind?: AddSourceKind) => void }) => (
    <button type="button" onClick={() => onAddSources?.("url")}>
      add-url-sheet
    </button>
  ),
}));

vi.mock("../studio/StudioPane", () => ({
  default: () => <div />,
}));

vi.mock("../lib/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

afterEach(() => {
  cleanup();
  sourcesProps.length = 0;
});

describe("NotebookDesk", () => {
  it("forwards the requested source kind from ChatPane into SourcesPane and clears it on consume", () => {
    render(
      <NotebookDesk
        notebookId="nb1"
        notebook={{ id: "nb1", name: "Notes", createdAt: 1, updatedAt: 1 }}
        sourcesVersion={0}
        bumpSources={vi.fn()}
        layout="standard"
        setLayout={vi.fn()}
        importRequestId={null}
        onImportConsumed={vi.fn()}
        dropRequest={null}
        onDropConsumed={vi.fn()}
        pendingView={null}
        openSource={vi.fn()}
        clearPendingView={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "add-url-sheet" }));
    expect(screen.getByTestId("sources-req")).toHaveTextContent("1");
    expect(screen.getByTestId("sources-kind")).toHaveTextContent("url");

    fireEvent.click(screen.getByRole("button", { name: "consume" }));
    expect(screen.getByTestId("sources-req")).toHaveTextContent("0");
    expect(screen.getByTestId("sources-kind")).toHaveTextContent("none");
  });
});
