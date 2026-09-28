import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import VisionConsentDialog from "./VisionConsentDialog";

describe("VisionConsentDialog", () => {
  it("names the file, the model and the cost before anything is sent", () => {
    const onAnswer = vi.fn();
    render(
      <VisionConsentDialog
        request={{ fileName: "Scan.pdf", kind: "scan", pages: 30, scannedPages: 42 }}
        modelLabel="Sonnet 5"
        offerApplyToRest
        onAnswer={onAnswer}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Read the scanned pages?" });
    expect(dialog).toHaveTextContent("“Scan.pdf” has 42 pages with no text layer");
    expect(dialog).toHaveTextContent("Your model, Sonnet 5, can transcribe the first 30");
    expect(dialog).toHaveTextContent("uses about 30 requests");
    expect(dialog).toHaveTextContent("read the remaining 12 pages");

    fireEvent.click(screen.getByRole("checkbox", { name: /Do the same for other photos/ }));
    fireEvent.click(screen.getByRole("button", { name: "Read 30 pages" }));
    expect(onAnswer).toHaveBeenCalledWith(true, true);
  });

  it("declines when dismissed, and speaks of a single page as one", () => {
    const onAnswer = vi.fn();
    render(
      <VisionConsentDialog
        request={{ fileName: "Notes.pdf", kind: "scan", pages: 1, scannedPages: 1 }}
        modelLabel="Sonnet 5"
        offerApplyToRest={false}
        onAnswer={onAnswer}
      />,
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("has a page with no text layer — a scan or a photo. Your model, Sonnet 5, can transcribe it");
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Keep without text" }));
    expect(onAnswer).toHaveBeenCalledWith(false, false);
  });
});
