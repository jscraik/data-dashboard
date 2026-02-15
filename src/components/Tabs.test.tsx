import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/Tabs";

describe("Tabs", () => {
  it("renders tabs with correct ARIA roles", () => {
    render(
      <Tabs value="tab1" onValueChange={vi.fn()}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    const tablist = screen.getByRole("tablist");
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
  });

  it("supports arrow key navigation", () => {
    const handleChange = vi.fn();

    render(
      <Tabs value="tab1" onValueChange={handleChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    const tablist = screen.getByRole("tablist");
    const tab1 = screen.getByRole("tab", { name: "Tab 1" });
    const tab2 = screen.getByRole("tab", { name: "Tab 2" });

    tab1.focus();
    fireEvent.keyDown(tablist, { key: "ArrowRight" });

    expect(handleChange).toHaveBeenCalledWith("tab2");
    expect(tab2).toHaveFocus();
  });

  it("calls onValueChange when tab clicked", () => {
    const handleChange = vi.fn();

    render(
      <Tabs value="tab1" onValueChange={handleChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    fireEvent.click(screen.getByText("Tab 2"));
    expect(handleChange).toHaveBeenCalledWith("tab2");
  });

  it("shows selected tab with correct aria-selected", () => {
    render(
      <Tabs value="tab1" onValueChange={vi.fn()}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );

    const tab1 = screen.getByRole("tab", { name: "Tab 1" });
    expect(tab1).toHaveAttribute("aria-selected", "true");

    const tab2 = screen.getByRole("tab", { name: "Tab 2" });
    expect(tab2).toHaveAttribute("aria-selected", "false");
  });

  it("displays tab panel with correct id relationship", () => {
    render(
      <Tabs value="tab1" onValueChange={vi.fn()}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );

    const tab = screen.getByRole("tab");
    const panel = screen.getByRole("tabpanel");

    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  });
});
