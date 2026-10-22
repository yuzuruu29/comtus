import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssistantMessage from "./AssistantMessage";
import type { ChatMessage } from "../lib/types";

afterEach(cleanup);

const base: ChatMessage = { id: "m", notebookId: "nb", role: "assistant", content: "", createdAt: 1 };
const search = { status: "ok" as const, query: "sodium pump", count: 4, ms: 1800 };

describe("progress while an answer streams", () => {
  it("says what is happening in one place at a time", () => {
    const { rerender } = render(<AssistantMessage msg={base} streaming phase="searching" onCite={vi.fn()} />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Searching the web…");

    rerender(<AssistantMessage msg={base} streaming phase="reading" onCite={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Reading…");

    rerender(
      <AssistantMessage msg={{ ...base, thinking: "Contrast energy use." }} streaming phase="thinking" onCite={vi.fn()} />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { expanded: false })).toHaveTextContent("Thinking…");
  });

  it("keeps the typing cursor inside the answer text", () => {
    const { container } = render(
      <AssistantMessage msg={{ ...base, content: "and pull **2" }} streaming phase="answering" onCite={vi.fn()} />,
    );
    expect(container.querySelector("p strong")).toHaveTextContent("2");
    expect(container.querySelector("p .stream-typing-beacon")).toBeInTheDocument();
    expect(container.textContent).not.toContain("**");
  });
});

describe("web search", () => {
  it("states what was read without a time that goes stale", () => {
    render(<AssistantMessage msg={{ ...base, content: "Done.", webSearch: search }} onCite={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Read 4 web pages");
    expect(screen.getByRole("status")).not.toHaveTextContent("just now");
  });

  it("keeps the provider's error text out of the message", () => {
    const failed = { ...search, status: "error" as const, count: 0, error: "HTTP 502: upstream timed out" };
    render(<AssistantMessage msg={{ ...base, content: "Done.", webSearch: failed }} onCite={vi.fn()} />);
    const strip = screen.getByRole("status");
    expect(strip).not.toHaveTextContent("HTTP 502");
    expect(strip).toHaveAttribute("title", failed.error);
  });

  it("links a cited web page to the page itself", () => {
    const onCite = vi.fn();
    render(
      <AssistantMessage
        msg={{
          ...base,
          content: "Answer.",
          citations: [
            { documentIndex: 0, sourceId: "src-1", sourceTitle: "Ch. 4", citedText: "3 Na+ out" },
            {
              documentIndex: 1,
              sourceId: "web-1-0",
              sourceTitle: "Web: Sodium–potassium pump",
              citedText: "",
              url: "https://en.wikipedia.org/wiki/Na%2B/K%2B-ATPase",
            },
            { documentIndex: 2, sourceId: "web-0-1", sourceTitle: "Web: Older result", citedText: "" },
          ],
        }}
        onCite={onCite}
      />,
    );
    const link = screen.getByRole("link", { name: /\[2\] Sodium–potassium pump en\.wikipedia\.org/ });
    expect(link).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Na%2B/K%2B-ATPase");
    expect(link).not.toHaveTextContent("Web:");

    expect(screen.queryByRole("button", { name: /Older result/ })).not.toBeInTheDocument();
    expect(screen.getByText("Older result")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /\[1\] Ch\. 4/ }));
    expect(onCite).toHaveBeenCalledWith("src-1", undefined);
  });
});
