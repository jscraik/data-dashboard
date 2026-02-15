import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecentSessions } from "./RecentSessions";

describe("RecentSessions", () => {
  const mockSessions = [
    {
      session_id: "test-session-1",
      timestamp: "2026-02-15T10:00:00Z",
      total_rules: 8,
      passed_rules: 6,
      score_percentage: 75.0,
      summary: "Good session",
    },
    {
      session_id: "test-session-2",
      timestamp: "2026-02-14T10:00:00Z",
      total_rules: 8,
      passed_rules: 7,
      score_percentage: 87.5,
      summary: "Better session",
    },
  ];

  it("renders session list", () => {
    render(<RecentSessions sessions={mockSessions} />);

    expect(screen.getByText("Recent Sessions")).toBeInTheDocument();
    expect(screen.getByText("2 total")).toBeInTheDocument();
  });

  it("displays session IDs", () => {
    render(<RecentSessions sessions={mockSessions} />);

    expect(screen.getByText("test-session-1")).toBeInTheDocument();
    expect(screen.getByText("test-session-2")).toBeInTheDocument();
  });

  it("displays scores with correct colors", () => {
    render(<RecentSessions sessions={mockSessions} />);

    const scores = screen.getAllByText(/\d+\.\d%/);
    expect(scores).toHaveLength(2);
  });

  it("shows empty state when no sessions", () => {
    render(<RecentSessions sessions={[]} />);

    expect(screen.getByText("No sessions scored yet")).toBeInTheDocument();
  });

  it("has hover interaction class", () => {
    render(<RecentSessions sessions={mockSessions} />);

    const row = screen.getByRole("button", { name: "Open details for test-session-1" });
    expect(row).toHaveClass("hover:bg-slate-50");
  });
});
