import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import PreLandingOnboarding, {
  ONBOARDING_SEEN_KEY,
} from "./PreLandingOnboarding";
import { SUBJECTS, GOALS } from "./OnboardingModal";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("gsap", () => ({
  default: {
    to: vi.fn((_target: unknown, vars?: { onComplete?: () => void }) => {
      vars?.onComplete?.();
      return Promise.resolve();
    }),
    fromTo: vi.fn((_target: unknown, _from: unknown, vars?: { onComplete?: () => void }) => {
      vars?.onComplete?.();
      return Promise.resolve();
    }),
  },
}));

describe("PreLandingOnboarding Component", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders Phase 1: Philosophy with brand emblem and headline", () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();

    render(
      <BrowserRouter>
        <PreLandingOnboarding onComplete={onComplete} onSkip={onSkip} />
      </BrowserRouter>
    );

    expect(screen.getByRole("region", { name: /Welcome and workspace setup/i })).toBeInTheDocument();
    expect(screen.getByText(/Rough thought, polished\./i)).toBeInTheDocument();
    expect(screen.getByText(/The Calibrated Desk/i)).toBeInTheDocument();
    expect(screen.getByText(/Cantor8 Architecture/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Recall Drills/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Calibrate Your Desk/i })).toBeInTheDocument();
  });

  it("advances from Phase 1 to Phase 2 upon clicking Calibrate Your Desk", () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();

    render(
      <BrowserRouter>
        <PreLandingOnboarding onComplete={onComplete} onSkip={onSkip} />
      </BrowserRouter>
    );

    const nextBtn = screen.getByRole("button", { name: /Calibrate Your Desk/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/Calibrate Your Scholar's Desk/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. Study Domain/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Primary Learning Focus/i)).toBeInTheDocument();

    // Verify all subjects are rendered
    SUBJECTS.forEach((sub) => {
      expect(screen.getByText(sub.label)).toBeInTheDocument();
    });

    // Verify all goals are rendered
    GOALS.forEach((goal) => {
      expect(screen.getByText(goal.label)).toBeInTheDocument();
    });
  });

  it("allows selecting a subject and goal in Phase 2 and proceeding to Phase 3", () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();

    render(
      <BrowserRouter>
        <PreLandingOnboarding onComplete={onComplete} onSkip={onSkip} />
      </BrowserRouter>
    );

    // Advance to Step 2
    fireEvent.click(screen.getByRole("button", { name: /Calibrate Your Desk/i }));

    // Select STEM & Engineering
    const stemBtn = screen.getByText("STEM & Engineering").closest("button");
    expect(stemBtn).not.toBeNull();
    if (stemBtn) fireEvent.click(stemBtn);

    // Select Practice rapid quiz drills
    const quizBtn = screen.getByText("Practice rapid quiz drills").closest("button");
    expect(quizBtn).not.toBeNull();
    if (quizBtn) fireEvent.click(quizBtn);

    // Advance to Step 3
    const previewBtn = screen.getByRole("button", { name: /Continue to Preview/i });
    fireEvent.click(previewBtn);

    expect(screen.getByText(/Your Scholar Workspace is Primed/i)).toBeInTheDocument();
    expect(screen.getByText(/STEM & Engineering/i)).toBeInTheDocument();
    expect(screen.getByText(/Practice rapid quiz drills/i)).toBeInTheDocument();
  });

  it("navigates back to Step 2 when clicking Adjust Configuration in Step 3", () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();

    render(
      <BrowserRouter>
        <PreLandingOnboarding onComplete={onComplete} onSkip={onSkip} />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Calibrate Your Desk/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Preview/i }));

    const backBtn = screen.getByRole("button", { name: /Adjust Configuration/i });
    fireEvent.click(backBtn);

    expect(screen.getByText(/Calibrate Your Scholar's Desk/i)).toBeInTheDocument();
  });

  it("launches into Studio with session storage kickstart when clicking Launch into Studio", () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();

    render(
      <BrowserRouter>
        <PreLandingOnboarding onComplete={onComplete} onSkip={onSkip} />
      </BrowserRouter>
    );

    // Advance to Step 2
    fireEvent.click(screen.getByRole("button", { name: /Calibrate Your Desk/i }));

    // Select Medicine & Nursing and Socratic Intuition
    fireEvent.click(screen.getByRole("button", { name: /Continue to Preview/i }));

    // Click Launch into Studio
    const launchBtn = screen.getByRole("button", { name: /Launch into Studio/i });
    fireEvent.click(launchBtn);

    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe("true");
    const kickstart = sessionStorage.getItem("comtus_kickstart");
    expect(kickstart).not.toBeNull();
    expect(JSON.parse(kickstart || "{}").subject).toContain("Medicine");
    expect(mockNavigate).toHaveBeenCalledWith("/studio");
  });

  it("executes exit to landing page when clicking Explore Landing Page", () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();

    render(
      <BrowserRouter>
        <PreLandingOnboarding onComplete={onComplete} onSkip={onSkip} />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Calibrate Your Desk/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Preview/i }));

    const exploreBtn = screen.getByRole("button", { name: /Explore Landing Page/i });
    fireEvent.click(exploreBtn);

    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe("true");
    expect(onComplete).toHaveBeenCalled();
  });

  it("triggers skip when clicking Skip to Overview", () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();

    render(
      <BrowserRouter>
        <PreLandingOnboarding onComplete={onComplete} onSkip={onSkip} />
      </BrowserRouter>
    );

    const skipBtn = screen.getByRole("button", {
      name: /Skip onboarding to landing page/i,
    });
    fireEvent.click(skipBtn);

    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe("true");
    expect(onSkip).toHaveBeenCalled();
  });

  it("triggers skip on Escape key press", () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();

    render(
      <BrowserRouter>
        <PreLandingOnboarding onComplete={onComplete} onSkip={onSkip} />
      </BrowserRouter>
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe("true");
    expect(onSkip).toHaveBeenCalled();
  });
});
