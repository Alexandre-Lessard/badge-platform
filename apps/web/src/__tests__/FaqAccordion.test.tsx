import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/i18n/context";
import { FaqAccordion } from "@/components/ui/FaqAccordion";

describe("FaqAccordion", () => {
  it("renders the default locale heading and description when overrides are absent", () => {
    localStorage.setItem("locale", "fr");

    render(
      <LanguageProvider>
        <FaqAccordion
          headingLevel="h2"
          items={[
            {
              question: "Question test",
              answer: "Réponse test",
            },
          ]}
        />
      </LanguageProvider>,
    );

    expect(screen.getByRole("heading", { name: "FAQ" })).toBeInTheDocument();
    expect(
      screen.getByText("Trouvez les réponses aux questions courantes sur l’enregistrement de vos biens."),
    ).toBeInTheDocument();
  });

  it("renders injected heading and description without regressing the accordion body", () => {
    localStorage.setItem("locale", "fr");

    render(
      <LanguageProvider>
        <FaqAccordion
          headingLevel="h2"
          heading="FAQ assureurs"
          description="Réponse rapide au sujet du financement."
          items={[
            {
              question: "Qui finance Badge?",
              answer: "Badge est financé par ses activités commerciales.",
            },
          ]}
        />
      </LanguageProvider>,
    );

    expect(screen.getByRole("heading", { name: "FAQ assureurs" })).toBeInTheDocument();
    expect(screen.getByText("Réponse rapide au sujet du financement.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qui finance Badge?" })).toBeInTheDocument();
  });
});
