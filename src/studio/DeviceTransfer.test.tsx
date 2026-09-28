import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendNotebook = vi.fn();
const receiveNotebook = vi.fn();
vi.mock("../lib/transfer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/transfer")>();
  return {
    ...actual,
    relayOrigin: () => "https://comtus-ai.vercel.app",
    sendNotebook: (...args: unknown[]) => sendNotebook(...args),
    forgetTransfer: vi.fn(async () => {}),
    receiveNotebook: (...args: unknown[]) => receiveNotebook(...args),
  };
});

import { ReceiveFromDeviceDialog, SendToDeviceDialog, receiveCodeFromHash } from "./DeviceTransfer";

const CODE = "7K3FQX9PM2RT8WZA4HCN6VBD";

beforeEach(() => {
  sendNotebook.mockReset();
  receiveNotebook.mockReset();
});

describe("SendToDeviceDialog", () => {
  it("shows a QR code and the code once the notebook is sealed and sent", async () => {
    sendNotebook.mockImplementation(async (_id: string, progress: (d: number, t: number) => void) => {
      progress(0, 3);
      return { code: CODE, expiresAt: Date.now() + 3_600_000 };
    });
    render(<SendToDeviceDialog notebook={{ id: "nb", name: "Cell biology" }} onClose={() => {}} />);
    expect(await screen.findByText("7K3F-QX9P-M2RT-8WZA-4HCN-6VBD")).toBeInTheDocument();
    expect(sendNotebook).toHaveBeenCalledWith("nb", expect.any(Function));
    expect(screen.getByRole("img", { name: /QR code that opens “Cell biology”/ })).toBeInTheDocument();
    expect(screen.getByText(/Works once, for the next 60 minutes\./)).toBeInTheDocument();
    expect(screen.getByText(/the relay can't read your notebook/)).toBeInTheDocument();
  });

  it("says what went wrong and can try again", async () => {
    sendNotebook.mockRejectedValueOnce(new Error("This notebook is too large to send this way."));
    sendNotebook.mockResolvedValueOnce({ code: CODE, expiresAt: Date.now() + 3_600_000 });
    render(<SendToDeviceDialog notebook={{ id: "nb", name: "Bio" }} onClose={() => {}} />);
    expect(await screen.findByText("This notebook is too large to send this way.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("7K3F-QX9P-M2RT-8WZA-4HCN-6VBD")).toBeInTheDocument();
  });
});

describe("ReceiveFromDeviceDialog", () => {
  it("waits for a whole code, then receives", async () => {
    receiveNotebook.mockResolvedValue({ notebookId: "nb", name: "Bio", isNew: true, added: 5, updated: 0 });
    const onReceived = vi.fn();
    render(<ReceiveFromDeviceDialog onClose={() => {}} onReceived={onReceived} />);
    const receive = screen.getByRole("button", { name: "Receive" });
    fireEvent.change(screen.getByLabelText("Transfer code"), { target: { value: "7k3f-qx9p" } });
    expect(receive).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Transfer code"), { target: { value: "7k3f-qx9p-m2rt-8wza-4hcn-6vbd" } });
    fireEvent.click(receive);
    await waitFor(() => expect(onReceived).toHaveBeenCalledWith(expect.objectContaining({ notebookId: "nb" })));
  });

  it("starts at once from a scanned link and reports failures", async () => {
    receiveNotebook.mockRejectedValue(new Error("This code has expired or was already used."));
    render(<ReceiveFromDeviceDialog initialCode={CODE} onClose={() => {}} onReceived={() => {}} />);
    expect(await screen.findByText("This code has expired or was already used.")).toBeInTheDocument();
    expect(receiveNotebook).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Transfer code")).toHaveValue("7K3F-QX9P-M2RT-8WZA-4HCN-6VBD");
  });

  it("reads codes out of receive links only", () => {
    expect(receiveCodeFromHash(`#receive=${CODE}`)).toBe(CODE);
    expect(receiveCodeFromHash("#receive=nope")).toBeNull();
    expect(receiveCodeFromHash("#other")).toBeNull();
  });
});
