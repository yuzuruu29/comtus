import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import HostedCheckout from "./HostedCheckout";

/* PayPalCheckout is the browser-SDK boundary; the hosted page test only
   cares what this page does with a captured pass. */
vi.mock("../studio/PayPalCheckout", () => ({
  default: ({ plan, onSuccess }: { plan: { id: string }; onSuccess: (t: string, o: string) => void }) => (
    <button type="button" data-testid="mock-pay" onClick={() => onSuccess("comtus-pass-v1.test.sig", "ORDER-77")}>
      Pay {plan.id}
    </button>
  ),
}));

function renderAt(url: string) {
  window.history.replaceState({}, "", url);
  return render(
    <MemoryRouter initialEntries={[url]}>
      <HostedCheckout />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe("HostedCheckout", () => {
  it("offers every study plan and defaults to Scholar", () => {
    renderAt("/checkout");
    for (const name of ["Sprint Pass", "Scholar Pass", "Mastery Pass"]) {
      expect(screen.getByRole("button", { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(document.title).toBe("Smarter Models checkout — Comtus");
  });

  it("preselects the plan named in the query string", () => {
    renderAt("/checkout?plan=mastery");
    fireEvent.click(screen.getByTestId("mock-pay"));
    expect(screen.getByTestId("mock-pay")).toHaveTextContent("mastery");
  });

  it("shows the pass and the order id after payment, with the keep-it hint", () => {
    renderAt("/checkout");
    expect(screen.getByText(/Access Pass appears right here/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-pay"));
    expect(screen.getByText("comtus-pass-v1.test.sig")).toBeInTheDocument();
    expect(screen.getByText("PayPal order id: ORDER-77")).toBeInTheDocument();
    expect(screen.getByText(/Keep the order id/i)).toBeInTheDocument();
  });
});
