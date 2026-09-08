import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import OnboardingModal from "./OnboardingModal";
import { createNotebook } from "../lib/db";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("react-router-dom", async () => ({ ...await vi.importActual<typeof import("react-router-dom")>("react-router-dom"), useNavigate: () => navigate }));
vi.mock("../lib/db", () => ({ createNotebook: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(createNotebook).mockReset();
  navigate.mockReset();
});

it("opens only on request and focuses the labelled topic field", async () => {
  const onClose = vi.fn();
  const { rerender } = render(<MemoryRouter><OnboardingModal isOpen={false} onClose={onClose} /></MemoryRouter>);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  rerender(<MemoryRouter><OnboardingModal isOpen onClose={onClose} /></MemoryRouter>);
  expect(screen.getByRole("dialog", { name: "Set up your study desk" })).toBeInTheDocument();
  const topic = screen.getByRole("textbox", { name: "Notebook topic" });
  await waitFor(() => expect(topic).toHaveFocus());
  expect(screen.getByRole("button", { name: "Create notebook" })).toBeDisabled();
  expect(screen.getByText("Import a PDF, add a link, or paste your notes.")).toBeInTheDocument();
  fireEvent.keyDown(topic, { key: "Escape" });
  expect(onClose).toHaveBeenCalledOnce();
});

it("creates one notebook with the complete topic and opens it after saving", async () => {
  const onClose = vi.fn();
  const title = "Learning and memory for the autumn psychology examination";
  const notebook = { id: "study-notebook", name: title, createdAt: 0, updatedAt: 0 };
  let finish!: (value: typeof notebook) => void;
  vi.mocked(createNotebook).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  render(<MemoryRouter><OnboardingModal isOpen onClose={onClose} /></MemoryRouter>);
  fireEvent.change(screen.getByRole("textbox", { name: "Notebook topic" }), { target: { value: `  ${title}  ` } });
  fireEvent.click(screen.getByRole("button", { name: "Create notebook" }));
  expect(screen.getByRole("button", { name: "Creating notebook…" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "Notebook topic" })).toBeDisabled();
  fireEvent.submit(screen.getByRole("form", { name: "Create a study notebook" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(createNotebook).toHaveBeenCalledOnce();
  expect(createNotebook).toHaveBeenCalledWith(title);
  expect(navigate).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => { finish(notebook); });
  expect(navigate).toHaveBeenCalledWith("/studio/study-notebook");
  expect(onClose).toHaveBeenCalledOnce();
});

it("keeps the topic available and permits a retry if notebook creation fails", async () => {
  const onClose = vi.fn();
  vi.mocked(createNotebook).mockRejectedValueOnce(new Error("The notebook could not be saved."));
  render(<MemoryRouter><OnboardingModal isOpen onClose={onClose} /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Research methods" }));
  fireEvent.click(screen.getByRole("button", { name: "Create notebook" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("The notebook could not be saved.");
  expect(screen.getByRole("textbox", { name: "Notebook topic" })).toHaveValue("Research methods");
  expect(screen.getByRole("button", { name: "Create notebook" })).toBeEnabled();
  expect(navigate).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  vi.mocked(createNotebook).mockResolvedValueOnce({ id: "retry-notebook", name: "Research methods", createdAt: 0, updatedAt: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Create notebook" }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/studio/retry-notebook"));
});
