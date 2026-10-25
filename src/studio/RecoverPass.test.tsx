import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import RecoverPass from "./RecoverPass";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

function renderField() {
  const onPass = vi.fn();
  render(<RecoverPass onPass={onPass} />);
  return onPass;
}

describe("RecoverPass", () => {
  it("restores a pass from a completed order id", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ passToken: "comtus-pass-v1.abc.sig" }) });
    const onPass = renderField();

    fireEvent.change(screen.getByPlaceholderText("PayPal order id"), { target: { value: "ORDER-1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => expect(onPass).toHaveBeenCalledWith("comtus-pass-v1.abc.sig"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/paypal/recover");
    expect(JSON.parse(String(init.body))).toEqual({ orderId: "ORDER-1234" });
    expect(screen.getByPlaceholderText("PayPal order id")).toHaveValue("");
  });

  it("stays inert until an id that could be real is entered", () => {
    renderField();
    expect(screen.getByRole("button", { name: "Restore" })).toBeDisabled();
  });

  it("surfaces the server's reason when an order cannot be restored", async () => {
    fetchMock.mockResolvedValue({ ok: 404, json: async () => ({ error: "No order with that id." }) });
    const onPass = renderField();

    fireEvent.change(screen.getByPlaceholderText("PayPal order id"), { target: { value: "ORDER-XXXX" } });
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(await screen.findByText("No order with that id.")).toBeInTheDocument();
    expect(onPass).not.toHaveBeenCalled();
  });
});
