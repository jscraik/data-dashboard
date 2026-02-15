import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionScorer } from "./SessionScorer";

// Mock the Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("SessionScorer", () => {
  it("renders form inputs", () => {
    render(<SessionScorer />);

    expect(screen.getByLabelText(/Session ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Session Transcript")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Score Session" })).toBeInTheDocument();
  });

  it("disables button when fields empty", () => {
    render(<SessionScorer />);

    const button = screen.getByRole("button", { name: "Score Session" });
    expect(button).toBeDisabled();
  });

  it("enables button when fields filled", () => {
    render(<SessionScorer />);

    const sessionInput = screen.getByLabelText(/Session ID/i);
    const transcriptInput = screen.getByLabelText("Session Transcript");

    fireEvent.change(transcriptInput, { target: { value: "Some transcript text" } });

    const button = screen.getByRole("button", { name: "Score Session" });
    expect(button).not.toBeDisabled();

    fireEvent.change(sessionInput, { target: { value: "test-session" } });
    expect(button).not.toBeDisabled();
  });

  it("has accessible form labels", () => {
    render(<SessionScorer />);

    const sessionInput = screen.getByLabelText(/Session ID/i);
    const transcriptInput = screen.getByLabelText("Session Transcript");

    expect(sessionInput).toHaveAttribute("id", "sessionId");
    expect(transcriptInput).toHaveAttribute("id", "transcript");
  });

  it("shows loading state when scoring", async () => {
    render(<SessionScorer />);

    const sessionInput = screen.getByLabelText(/Session ID/i);
    const transcriptInput = screen.getByLabelText("Session Transcript");

    fireEvent.change(sessionInput, { target: { value: "test-session" } });
    fireEvent.change(transcriptInput, { target: { value: "Some transcript" } });

    const button = screen.getByRole("button", { name: "Score Session" });
    expect(button).toHaveAttribute("aria-busy", "false");
  });
});
