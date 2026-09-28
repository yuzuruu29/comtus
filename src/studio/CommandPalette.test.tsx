import "fake-indexeddb/auto";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useEffect, type ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../lib/db";
import CommandPalette from "./CommandPalette";
import { useNotebookDesk } from "./useNotebookDesk";

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

async function seed() {
  await Promise.all([db.notebooks, db.sources, db.chatSessions, db.messages, db.generations].map((t) => t.clear()));
  await db.notebooks.add({ id: "nb-1", name: "Pharmacology", createdAt: 1, updatedAt: 1 });
  await db.sources.add({
    id: "s-1",
    notebookId: "nb-1",
    title: "Anticoagulants lecture",
    kind: "txt",
    content: "Warfarin is monitored with the INR.",
    chars: 35,
    tokens: 9,
    addedAt: 1,
  });
  await db.chatSessions.add({ id: "chat-1", notebookId: "nb-1", title: "Dosing questions", createdAt: 1, updatedAt: 2 });
  await db.messages.add({ id: "m-1", notebookId: "nb-1", sessionId: "chat-1", role: "user", content: "Is the INR target 2 to 3?", createdAt: 1 });
}

describe("CommandPalette library search", () => {
  beforeEach(seed);

  it("finds text inside sources and conversations and opens the match", async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter initialEntries={["/studio"]}>
        <CommandPalette open onClose={onClose} />
        <Where />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "inr" } });
    const source = await screen.findByRole("option", { name: /Anticoagulants lecture/ });
    expect(source).toHaveTextContent("Pharmacology");
    expect(source.querySelector("mark")).toHaveTextContent("INR");
    expect(screen.getByRole("option", { name: /Dosing questions/ })).toBeInTheDocument();

    fireEvent.click(source);
    expect(screen.getByTestId("where")).toHaveTextContent("/studio/nb-1?source=s-1&at=31");
    expect(onClose).toHaveBeenCalled();
  });

  it("says so when nothing matches", async () => {
    render(
      <MemoryRouter>
        <CommandPalette open onClose={() => {}} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzzzqqq" } });
    expect(await screen.findByText("Nothing in your library matches.")).toBeInTheDocument();
  });
});

describe("notebook deep links", () => {
  beforeEach(seed);

  it("opens the reader at a passage, then clears the link", async () => {
    const seen = { location: "" };
    function Probe() {
      const l = useLocation();
      useEffect(() => {
        seen.location = l.pathname + l.search;
      }, [l]);
      return null;
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={["/studio/nb-1?source=s-1&at=31&chat=chat-1"]}>
        <Routes>
          <Route
            path="/studio/:id"
            element={
              <>
                {children}
                <Probe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    const { result } = renderHook(() => useNotebookDesk("nb-1"), { wrapper });

    await waitFor(() => expect(result.current.pendingView).toEqual({ sourceId: "s-1", startChar: 31 }));
    expect(result.current.pendingChatId).toBe("chat-1");
    await waitFor(() => expect(seen.location).toBe("/studio/nb-1?chat=chat-1"));

    act(() => result.current.clearPendingChat());
    await waitFor(() => expect(seen.location).toBe("/studio/nb-1"));
  });
});
