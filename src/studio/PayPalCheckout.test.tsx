import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import PayPalCheckout from "./PayPalCheckout";
import { STUDY_PLANS } from "../lib/paypal";

vi.mock("../lib/desktop", () => ({ isTauri: () => false }));
vi.mock("../lib/paypal", async (importOriginal) => ({ ...await importOriginal<object>(), PAYPAL_CLIENT_ID: "test-client" }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  delete window.paypal;
});

it("requires review of the final amount before capturing payment", async () => {
  let approve: ((data: { orderID: string }) => Promise<void>) | undefined;
  window.paypal = { Buttons: (config) => {
    approve = config.onApprove;
    return { render: async () => {} };
  } };
  const fetchMock = vi.fn(async (url: string) => url.endsWith("prepare-order")
    ? Response.json({ price: "5.00", discounted: true, reviewToken: "review-token" })
    : Response.json({ passToken: "pass" }));
  vi.stubGlobal("fetch", fetchMock);
  const onSuccess = vi.fn();
  render(<PayPalCheckout plan={STUDY_PLANS[0]} onSuccess={onSuccess} />);
  await waitFor(() => expect(approve).toBeDefined());
  await act(async () => { await approve!({ orderID: "ORDER123" }); });
  expect(screen.getByText(/final price:/)).toHaveTextContent("Sprint Pass final price: $5.00 USD");
  expect(screen.getByText(/ORDER123/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  cleanup();
  render(<PayPalCheckout plan={STUDY_PLANS[0]} onSuccess={onSuccess} />);
  expect(screen.getByText(/ORDER123/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm payment" }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("pass", "ORDER123"));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("keeps the order reference and permits a retry after an interrupted capture", async () => {
  let approve: ((data: { orderID: string }) => Promise<void>) | undefined;
  window.paypal = { Buttons: (config) => { approve = config.onApprove; return { render: async () => {} }; } };
  let attempts = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("prepare-order")) return Response.json({ price: "5.00", discounted: true, reviewToken: "review-token" });
    attempts++;
    if (attempts === 1) throw new Error("connection lost");
    return Response.json({ passToken: "pass" });
  }));
  const onSuccess = vi.fn();
  render(<PayPalCheckout plan={STUDY_PLANS[0]} onSuccess={onSuccess} />);
  await waitFor(() => expect(approve).toBeDefined());
  await act(async () => { await approve!({ orderID: "ORDER123" }); });
  fireEvent.click(screen.getByRole("button", { name: "Confirm payment" }));
  await screen.findByText("connection lost");
  expect(screen.getByText(/ORDER123/)).toBeInTheDocument();
  cleanup();
  render(<PayPalCheckout plan={STUDY_PLANS[0]} onSuccess={onSuccess} />);
  expect(screen.getByText(/ORDER123/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm payment" }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("pass", "ORDER123"));
});

it("clears the declined order so the buyer can start a new checkout", async () => {
  let approve: ((data: { orderID: string }) => Promise<void>) | undefined;
  window.paypal = { Buttons: (config) => { approve = config.onApprove; return { render: async () => {} }; } };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("prepare-order")
    ? Response.json({ price: "5.00", discounted: true, reviewToken: "review-token" })
    : Response.json({ error: "Payment declined. Start a new checkout.", restartCheckout: true }, { status: 409 })));
  render(<PayPalCheckout plan={STUDY_PLANS[0]} onSuccess={vi.fn()} />);
  await waitFor(() => expect(approve).toBeDefined());
  await act(async () => { await approve!({ orderID: "ORDER123" }); });
  fireEvent.click(screen.getByRole("button", { name: "Confirm payment" }));
  await screen.findByText("Payment declined. Start a new checkout.");
  expect(screen.queryByText(/PayPal order ID: ORDER123/)).not.toBeInTheDocument();
  expect(sessionStorage.getItem("comtus-pending-checkout")).toBeNull();
});
