import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FirstRunSetup from "./FirstRunSetup";
import { useSettings } from "../lib/settings";
import { probeOllama } from "../lib/ollama";

vi.mock("../lib/ollama", () => ({
  OLLAMA_BASE_URL: "http://localhost:11434/v1",
  RECOMMENDED_MODEL: "qwen3:4b",
  pickOllamaModel: (models: string[]) => models[0] ?? "",
  probeOllama: vi.fn(),
}));

const probe = vi.mocked(probeOllama);

function resetSettings() {
  useSettings.setState({
    provider: "openai-compatible",
    compatKey: "",
    compatBaseUrl: "https://openrouter.ai/api/v1",
    compatModel: "openrouter/free",
    storedKeys: [],
    isPro: false,
    deskSetupDone: false,
  });
}

describe("FirstRunSetup", () => {
  beforeEach(() => {
    resetSettings();
    probe.mockReset();
  });

  it("offers a running model and activates it as the local provider", async () => {
    probe.mockResolvedValue({ reachable: true, models: ["qwen3:4b"], origin: "http://127.0.0.1:11434" });
    render(<FirstRunSetup open onClose={() => undefined} />);

    fireEvent.click(await screen.findByRole("button", { name: "Use qwen3:4b" }));
    expect(screen.getByText(/The lamp is lit/)).toBeInTheDocument();

    const s = useSettings.getState();
    expect(s.provider).toBe("openai-compatible");
    expect(s.compatBaseUrl).toBe("http://127.0.0.1:11434/v1");
    expect(s.compatModel).toBe("qwen3:4b");
    expect(s.deskSetupDone).toBe(true);
  });

  it("points at ollama.com when the daemon is missing, and skip marks setup handled", async () => {
    probe.mockResolvedValue({ reachable: false, models: [], origin: null });
    render(<FirstRunSetup open onClose={() => undefined} />);

    expect(await screen.findByText(/Ollama is not running yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ollama.com/download" })).toHaveAttribute(
      "href",
      "https://ollama.com/download",
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(useSettings.getState().deskSetupDone).toBe(true);
    expect(useSettings.getState().compatModel).toBe("openrouter/free");
  });

  it("shows the pull command when Ollama runs without models", async () => {
    probe.mockResolvedValue({ reachable: true, models: [], origin: "http://localhost:11434" });
    render(<FirstRunSetup open onClose={() => undefined} />);

    expect(await screen.findByText(/ollama pull qwen3:4b/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy the pull command" })).toBeInTheDocument();
  });
});
