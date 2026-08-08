import { useRef, useState } from "react";
import { useLanguage } from "@/i18n/context";
import { Button } from "@/components/ui/Button";
import {
  INSURERS,
  INSURER_EMAILS,
  type InsurerId,
} from "@rnbp/shared";
import avivaLogo from "@/assets/insurers/aviva.png";
import belairdirectLogo from "@/assets/insurers/belairdirect.png";
import benevaLogo from "@/assets/insurers/beneva.png";
import cooperatorsLogo from "@/assets/insurers/cooperators.svg";
import desjardinsLogo from "@/assets/insurers/desjardins.svg";
import economicalLogo from "@/assets/insurers/economical.svg";
import intactLogo from "@/assets/insurers/intact.png";
import promutuelLogo from "@/assets/insurers/promutuel.png";
import tdLogo from "@/assets/insurers/td.jpg";
import wawanesaLogo from "@/assets/insurers/wawanesa.svg";

const FEATURED_INSURERS = [
  "intact",
  "aviva",
  "beneva",
  "belairdirect",
  "desjardins",
  "td",
  "wawanesa",
  "promutuel",
  "economical",
  "cooperators",
] as const satisfies readonly InsurerId[];

const FEATURED_INSURER_LOGOS: Partial<Record<InsurerId, string>> = {
  intact: intactLogo,
  aviva: avivaLogo,
  beneva: benevaLogo,
  belairdirect: belairdirectLogo,
  desjardins: desjardinsLogo,
  td: tdLogo,
  wawanesa: wawanesaLogo,
  promutuel: promutuelLogo,
  economical: economicalLogo,
  cooperators: cooperatorsLogo,
};

export function InsuranceFormSection() {
  const { t, locale } = useLanguage();
  const [selectedInsurerId, setSelectedInsurerId] = useState("");
  const [copied, setCopied] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const ins = t.insurance;
  if (!ins) return null;

  const selectedInsurer = INSURERS.find((i) => i.id === selectedInsurerId);
  const insurerDisplayName = selectedInsurer
    ? selectedInsurer[locale]
    : "";
  const selectedSummary = selectedInsurer
    ? ins.selectedSummary.replace("{{insurer}}", insurerDisplayName)
    : "";

  const message = selectedInsurerId
    ? ins.messageTemplate.replace("{{insurer}}", insurerDisplayName)
    : "";

  const insurerEmail = selectedInsurerId
    ? INSURER_EMAILS[selectedInsurerId] ?? null
    : null;

  const mailtoHref = insurerEmail
    ? `mailto:${insurerEmail}?subject=${encodeURIComponent(ins.emailSubject)}&body=${encodeURIComponent(message).replace(/%0A/g, "%0D%0A")}`
    : null;

  async function handleCopy() {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = message;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  function scrollToComposer() {
    composerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function selectInsurer(insurerId: string) {
    setSelectedInsurerId(insurerId);
    setCopied(false);
  }

  function handleSelectInsurer(insurerId: string) {
    selectInsurer(insurerId);
    scrollToComposer();
  }

  function handleOpenMore() {
    scrollToComposer();
    selectRef.current?.focus();
    selectRef.current?.showPicker?.();
  }

  return (
    <section className="bg-[var(--rcb-bg)]">
      <div className="section-shell py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="flex justify-center lg:justify-start">
            <img
              src="/assets/insurance-savings.png"
              alt={ins.heading}
              className="w-full max-w-md rounded-2xl"
            />
          </div>
          <div>
            <h2 className="text-4xl font-bold text-[var(--rcb-text)] sm:text-5xl">
              {ins.heading}
            </h2>
            {ins.promo && (
              <p className="mt-4 text-lg font-semibold text-[var(--rcb-primary)]">
                {ins.promo}
              </p>
            )}
            <p className="mt-4 text-xl leading-relaxed text-[var(--rcb-text-muted)]">
              {ins.description}
            </p>
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-5xl">
          <div className="mb-8">
            <div className="mb-4">
              <p className="text-lg font-semibold text-[var(--rcb-text-strong)]">
                {ins.featuredHeading}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--rcb-text-muted)]">
                {ins.featuredHint}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {FEATURED_INSURERS.map((insurerId, index) => {
                const insurer = INSURERS.find((entry) => entry.id === insurerId);
                if (!insurer) return null;

                const logo = FEATURED_INSURER_LOGOS[insurerId];
                const isSelected = selectedInsurerId === insurerId;
                // 10 logos → the 3-column layout leaves a single orphan on the
                // last row; center it (only in the 3-col range).
                const isLast = index === FEATURED_INSURERS.length - 1;
                const orphanCentering = isLast ? "sm:col-start-2 lg:col-start-auto" : "";

                return (
                  <button
                    key={insurerId}
                    type="button"
                    onClick={() => handleSelectInsurer(insurerId)}
                    aria-pressed={isSelected}
                    className={`flex min-h-40 items-center justify-center rounded-2xl border px-6 py-6 text-center transition-all ${orphanCentering} ${
                      isSelected
                        ? "border-[var(--rcb-primary)] bg-white shadow-sm ring-2 ring-[var(--rcb-primary)]/15"
                        : "border-[var(--rcb-border)] bg-white hover:border-[var(--rcb-primary)] hover:shadow-sm"
                    }`}
                  >
                    {logo ? (
                      <img
                        src={logo}
                        alt={insurer[locale]}
                        className="h-24 w-full object-contain"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-[var(--rcb-text-strong)]">
                        {insurer[locale]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleOpenMore}
              className="mt-4 flex w-full items-center justify-between rounded-2xl border border-dashed border-[var(--rcb-border)] bg-white px-5 py-4 text-left transition-colors hover:border-[var(--rcb-primary)] hover:bg-[var(--rcb-primary)]/5"
            >
              <span>
                <span className="block text-sm font-semibold text-[var(--rcb-text-strong)]">
                  {ins.moreButton}
                </span>
                <span className="mt-1 block text-sm text-[var(--rcb-text-muted)]">
                  {ins.moreDescription}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="ml-4 text-xl font-semibold text-[var(--rcb-primary)]"
              >
                +
              </span>
            </button>
          </div>

          <div
            ref={composerRef}
            className="mx-auto max-w-2xl scroll-mt-28 rounded-3xl border border-[var(--rcb-border)] bg-white p-6 shadow-sm"
          >
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-[var(--rcb-text-strong)]">
                {ins.composerHeading}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--rcb-text-muted)]">
                {ins.composerDescription}
              </p>
              {selectedSummary && (
                <p className="mt-3 inline-flex rounded-full bg-[var(--rcb-primary)]/10 px-3 py-1 text-sm font-medium text-[var(--rcb-primary)]">
                  {selectedSummary}
                </p>
              )}
            </div>

            <label
              htmlFor="insurer-select"
              className="mb-2 block text-sm font-medium text-[var(--rcb-text-strong)]"
            >
              {ins.selectLabel}
            </label>
            <select
              id="insurer-select"
              ref={selectRef}
              value={selectedInsurerId}
              onChange={(e) => {
                selectInsurer(e.target.value);
              }}
              className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            >
              <option value="">{ins.selectPlaceholder}</option>
              {INSURERS.map((insurer) => (
                <option key={insurer.id} value={insurer.id}>
                  {insurer[locale]}
                </option>
              ))}
            </select>

            {selectedInsurerId && (
              <div className="mt-6">
                <label
                  htmlFor="insurance-message"
                  className="mb-2 block text-sm font-medium text-[var(--rcb-text-strong)]"
                >
                  {ins.messageLabel}
                </label>
                <textarea
                  id="insurance-message"
                  readOnly
                  value={message}
                  rows={4}
                  className="w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-white)] px-4 py-3 text-[var(--rcb-text-body)] focus:outline-none"
                />

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {mailtoHref && (
                    <a
                      href={mailtoHref}
                      className="inline-block rounded-xl bg-[var(--rcb-primary)] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--rcb-primary-dark)]"
                    >
                      {ins.emailButton}
                    </a>
                  )}
                  <Button
                    onClick={handleCopy}
                    variant={mailtoHref ? "outline" : "primary"}
                    size="sm"
                    className="cursor-pointer"
                  >
                    {ins.sendButton}
                  </Button>
                  {copied && (
                    <span className="text-sm font-medium text-green-600">
                      {ins.copiedToast}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
