import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/i18n/context";
import { InsuranceFormSection } from "@/components/sections/InsuranceFormSection";

describe("InsuranceFormSection", () => {
  const scrollIntoView = vi.fn();
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  beforeEach(() => {
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("syncs a featured insurer click with the dropdown and generated message", () => {
    localStorage.setItem("locale", "fr");

    render(
      <LanguageProvider>
        <InsuranceFormSection />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Intact Assurance" }));

    const select = screen.getByLabelText("Votre assureur") as HTMLSelectElement;
    expect(select.value).toBe("intact");

    const textarea = screen.getByLabelText("Message pré-rempli") as HTMLTextAreaElement;
    expect(textarea.value).toContain("Intact Assurance");
    expect(textarea.value).toContain("Badge");
    expect(screen.getByText("Assureur sélectionné : Intact Assurance")).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalled();
  });
});
