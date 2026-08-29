import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import OnboardingModal, { SUBJECTS, GOALS, PROMPT_SUGGESTIONS } from "./OnboardingModal";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("OnboardingModal - Interactive Pixel Desk Setup Flow", () => {
  it("does not render when isOpen is false", () => {
    const onClose = vi.fn();
    render(
      <BrowserRouter>
        <OnboardingModal isOpen={false} onClose={onClose} />
      </BrowserRouter>
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders Step 1: The Empty Desk with pixel scene preview, subject domains, and breadcrumb", () => {
    const onClose = vi.fn();
    render(
      <BrowserRouter>
        <OnboardingModal isOpen={true} onClose={onClose} />
      </BrowserRouter>
    );

    // Modal dialog
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Step 1 Heading & Narrative
    expect(screen.getByText(/What discipline are you studying\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Select your academic discipline/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Step 1 of 3/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Discipline Domain/i).length).toBeGreaterThan(0);

    // 16-Bit Pixel Desk Scene Image
    const scene = screen.getByRole("img", { name: /16-bit Pixel Desk/i });
    expect(scene).toBeInTheDocument();
    expect(scene.getAttribute("aria-label")).toContain("battery in standby");

    // Renders all subjects
    SUBJECTS.forEach((sub) => {
      expect(screen.getByText(sub.label)).toBeInTheDocument();
    });
  });

  it("allows selecting a discipline domain (e.g. STEM & Engineering) and updates tome preview", () => {
    const onClose = vi.fn();
    render(
      <BrowserRouter>
        <OnboardingModal isOpen={true} onClose={onClose} />
      </BrowserRouter>
    );

    const stemRadio = screen.getByRole("radio", { name: /STEM & Engineering/i });
    expect(stemRadio).toBeInTheDocument();

    fireEvent.click(stemRadio);
    expect(stemRadio).toHaveAttribute("aria-checked", "true");

    // Scene reflects chosen tome
    const scene = screen.getByRole("img", { name: /16-bit Pixel Desk/i });
    expect(scene.getAttribute("aria-label")).toContain("STEM & Engineering tome on desk");
  });

  it("progresses to Step 2: Calibrate Pedagogical Goal", () => {
    const onClose = vi.fn();
    render(
      <BrowserRouter>
        <OnboardingModal isOpen={true} onClose={onClose} />
      </BrowserRouter>
    );

    // Click Continue
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    fireEvent.click(continueBtn);

    // Step 2 Header
    expect(screen.getByText(/What is your primary study objective\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Calibrate the cognitive workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 2 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Pedagogical Objective/i)).toBeInTheDocument();

    // Scene preview reflects ignited battery
    const scene = screen.getByRole("img", { name: /16-bit Pixel Desk/i });
    expect(scene.getAttribute("aria-label")).toContain("battery fully charged");

    // Goals rendered
    GOALS.forEach((goal) => {
      expect(screen.getByText(goal.label)).toBeInTheDocument();
    });
  });

  it("allows changing learning goals on Step 2", () => {
    const onClose = vi.fn();
    render(
      <BrowserRouter>
        <OnboardingModal isOpen={true} onClose={onClose} />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    const quizGoal = screen.getByRole("radio", { name: /Practice rapid quiz drills/i });
    fireEvent.click(quizGoal);
    expect(quizGoal).toHaveAttribute("aria-checked", "true");
  });

  it("navigates back to Step 1 from Step 2 when Back is clicked", () => {
    const onClose = vi.fn();
    render(
      <BrowserRouter>
        <OnboardingModal isOpen={true} onClose={onClose} />
      </BrowserRouter>
    );

    // Go to step 2
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    expect(screen.getByText(/Pedagogical Objective/i)).toBeInTheDocument();

    // Go back to step 1
    const backBtn = screen.getByRole("button", { name: /Back/i });
    fireEvent.click(backBtn);
    expect(screen.getAllByText(/Discipline Domain/i).length).toBeGreaterThan(0);
  });

  it("progresses to Step 3: Workspace Seed, illuminates quill, and accepts prompt suggestions", () => {
    const onClose = vi.fn();
    render(
      <BrowserRouter>
        <OnboardingModal isOpen={true} onClose={onClose} />
      </BrowserRouter>
    );

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    // Step 2 -> Step 3
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));

    // Step 3 UI
    expect(screen.getByText(/What topic or material are we tackling\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Enter your topic or paste lecture notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 3 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Workspace Seed/i)).toBeInTheDocument();

    // Scene preview reflects quill ready & illuminated study
    const scene = screen.getByRole("img", { name: /16-bit Pixel Desk/i });
    expect(scene.getAttribute("aria-label")).toContain("quill ready");

    // Click a prompt suggestion
    const suggestionBtn = screen.getByText(`+ ${PROMPT_SUGGESTIONS[0]}`);
    fireEvent.click(suggestionBtn);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe(PROMPT_SUGGESTIONS[0]);
  });

  it("saves kickstart intent to sessionStorage, closes modal, and navigates to /studio on launch", () => {
    const onClose = vi.fn();
    render(
      <BrowserRouter>
        <OnboardingModal isOpen={true} onClose={onClose} />
      </BrowserRouter>
    );

    // Select Law & Governance on Step 1
    fireEvent.click(screen.getByRole("radio", { name: /Law & Governance/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    // Select Exam Preparation on Step 2
    fireEvent.click(screen.getByRole("radio", { name: /Prepare for a major exam/i }));
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));

    // Inscribe topic on Step 3
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Constitutional Law Commerce Clause" } });

    // Launch
    const launchBtn = screen.getByRole("button", { name: /Launch Study Workspace/i });
    fireEvent.click(launchBtn);

    // Verify sessionStorage persistence
    const saved = sessionStorage.getItem("comtus_kickstart");
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.subject).toBe("Law & Governance");
    expect(parsed.goal).toBe("Prepare for a major exam");
    expect(parsed.goalId).toBe("exam");
    expect(parsed.prompt).toBe("Constitutional Law Commerce Clause");

    // Verify callbacks & routing
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/studio");
  });

  it("closes modal when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <BrowserRouter>
        <OnboardingModal isOpen={true} onClose={onClose} />
      </BrowserRouter>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes modal when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <BrowserRouter>
        <OnboardingModal isOpen={true} onClose={onClose} />
      </BrowserRouter>
    );

    const closeBtn = screen.getByRole("button", { name: /Close modal/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
}, 20000);
