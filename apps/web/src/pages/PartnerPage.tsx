import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useLanguage } from "@/i18n/context";
import { apiRequest, type ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import type { TabItem } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { getButtonClasses } from "@/lib/button-styles";
import { renderBold } from "@/lib/render-bold";
import { ROUTES } from "@/routes/routes";

type FormState = "idle" | "loading" | "success" | "error";
type Tab = "citizen" | "police" | "insurer";

export function PartnerPage() {
  const { t } = useLanguage();
  const p = t.partners!;

  const [activeTab, setActiveTab] = useState<Tab>("citizen");
  const [contactOpen, setContactOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [type, setType] = useState("");
  const [message, setMessage] = useState("");

  function resetForm() {
    setFormState("idle");
    setErrorMsg("");
    setName("");
    setEmail("");
    setCompany("");
    setType("");
    setMessage("");
  }

  function closeContactModal() {
    setContactOpen(false);
    // Don't reset — preserve data in case of accidental close
  }

  function openContactModal() {
    if (formState === "success") {
      resetForm();
    } else if (formState === "error") {
      setFormState("idle");
      setErrorMsg("");
    }
    // Pre-select type only if empty (preserve user's selection on reopen)
    if (!type) {
      setType(activeTab === "insurer" ? "insurer" : activeTab === "police" ? "security" : "");
    }
    setContactOpen(true);
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    resetForm();
    setContactOpen(false);
  }

  // Auto-close modal 3s after successful submission
  useEffect(() => {
    if (formState !== "success" || !contactOpen) return;
    const timer = setTimeout(closeContactModal, 3000);
    return () => clearTimeout(timer);
  }, [formState, contactOpen]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (formState === "loading") return;

    const form = e.currentTarget;
    const honeypot = (form.elements.namedItem("website") as HTMLInputElement)?.value;

    setFormState("loading");
    setErrorMsg("");

    try {
      await apiRequest("/contact", {
        method: "POST",
        body: {
          name,
          email,
          company: company || undefined,
          type,
          message,
          website: honeypot || undefined,
        },
      });
      setFormState("success");
      setName("");
      setEmail("");
      setCompany("");
      setType("");
      setMessage("");
    } catch (err) {
      const apiErr = err as ApiError;
      setErrorMsg(apiErr.message || p.errorMessage);
      setFormState("error");
    }
  }

  const inputClasses =
    "h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none";

  const tabs: TabItem<Tab>[] = [
    { key: "citizen", label: p.tabs.citizen },
    { key: "police", label: p.tabs.police },
    { key: "insurer", label: p.tabs.insurer },
  ];

  // Action button (same position for all tabs — right-aligned on tabs row)
  const consultLabel = p.consultButton ?? "Consulter";
  const actionButton = (
    <Link to={ROUTES.lookup} className={getButtonClasses("primary", "sm")} style={{ minWidth: 170 }}>
      {consultLabel}
    </Link>
  );

  return (
    <section className="min-h-[70vh] bg-[var(--rcb-white)]">
      
        <title>{t.pages.partners.title}</title>
        <meta name="description" content={t.pages.partners.description} />
      
      <div className="section-shell py-16">
        <h1 className="text-3xl font-bold text-[var(--rcb-text-strong)]">
          {p.heading}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-[var(--rcb-text-muted)]">
          {p.description}
        </p>

        {/* ── Tabs bar + action button ─────────────────────────── */}
        <div className="mt-10 flex items-end justify-between gap-4">
          <div role="tablist" className="flex min-w-0 flex-1 gap-0 overflow-x-auto border-b border-[var(--rcb-border)] sm:flex-initial">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                type="button"
                id={`tab-${tab.key}`}
                aria-selected={activeTab === tab.key}
                aria-controls={`tabpanel-${tab.key}`}
                onClick={() => switchTab(tab.key)}
                className={`flex-shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors sm:min-w-[180px] sm:px-5 sm:text-base ${
                  activeTab === tab.key
                    ? "border-[var(--rcb-primary)] text-[var(--rcb-primary)]"
                    : "border-transparent text-[var(--rcb-gray-dark)] hover:border-[var(--rcb-gray-dark)] hover:text-[var(--rcb-text-strong)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="hidden sm:block">{actionButton}</div>
        </div>

        {/* Mobile action button */}
        <div className="mt-4 sm:hidden">{actionButton}</div>

        {/* ── Tab panel ────────────────────────────────────────── */}
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="mt-8"
        >
          {/* ── Citoyen ──────────────────────────────────────── */}
          {activeTab === "citizen" && (
            <div>
              <p className="text-lg text-[var(--rcb-text-body)]">
                {p.citizenDescription}
              </p>

              <h2 className="mt-10 text-2xl font-semibold text-[var(--rcb-text-strong)]">
                {p.citizenWhyTitle}
              </h2>
              <ul className="mt-6 space-y-4">
                {p.citizenAdvantages.map((adv, i) => (
                  <li key={adv.title} className="flex items-start gap-3">
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--rcb-primary)] text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium text-[var(--rcb-text-strong)]">{adv.title}</p>
                      <p className="mt-1 text-sm text-[var(--rcb-text-muted)]">{adv.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Services Policiers ────────────────────────────── */}
          {activeTab === "police" && (
            <div>
              <h2 className="text-2xl font-semibold text-[var(--rcb-text-strong)]">
                {p.policeWhyTitle}
              </h2>
              <div className="mt-6">
                {p.policeAccordion.intro.split("\n").map((line, i) => (
                  <p key={i} className="mt-2 text-[var(--rcb-text-body)] first:mt-0">
                    {renderBold(line)}
                  </p>
                ))}
                <h3 className="mt-6 text-lg font-semibold text-[var(--rcb-text-strong)]">
                  {p.policeAccordion.subheading}
                </h3>
                <ul className="mt-4 space-y-4">
                  {p.policeAccordion.advantages.map((adv) => (
                    <li key={adv.title}>
                      <p className="font-medium text-[var(--rcb-text-strong)]">{adv.title}</p>
                      <p className="mt-1 text-sm text-[var(--rcb-text-muted)]">{adv.text}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-10 text-center">
                <Button variant="outline" onClick={openContactModal}>
                  {p.contactButton}
                </Button>
              </div>
            </div>
          )}

          {/* ── Compagnie d'assurance ─────────────────────────── */}
          {activeTab === "insurer" && (
            <div>
              <h2 className="text-2xl font-semibold text-[var(--rcb-text-strong)]">
                {p.insurerWhyTitle}
              </h2>
              <div className="mt-6">
                {p.insurerAccordion.intro.split("\n").map((line, i) => (
                  <p key={i} className="mt-2 text-[var(--rcb-text-body)] first:mt-0">
                    {renderBold(line)}
                  </p>
                ))}
                <h3 className="mt-6 text-lg font-semibold text-[var(--rcb-text-strong)]">
                  {p.insurerAccordion.subheading}
                </h3>
                <ul className="mt-4 space-y-4">
                  {p.insurerAccordion.advantages.map((adv) => (
                    <li key={adv.title}>
                      <p className="font-medium text-[var(--rcb-text-strong)]">{adv.title}</p>
                      <p className="mt-1 text-sm text-[var(--rcb-text-muted)]">{adv.text}</p>
                    </li>
                  ))}
                </ul>
                <blockquote className="mt-8 rounded-xl bg-[var(--rcb-surface)] border-l-4 border-[var(--rcb-primary)] px-6 py-5">
                  <p className="text-lg font-medium italic text-[var(--rcb-text-strong)]">
                    {`\u00ab\u00a0${p.insurerAccordion.quote}\u00a0\u00bb`}
                  </p>
                </blockquote>
              </div>

              <div className="mt-10 text-center">
                <Button variant="outline" onClick={openContactModal}>
                  {p.contactButton}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal formulaire contact ─────────────────────────── */}
      <Modal
        open={contactOpen}
        onClose={closeContactModal}
        title={p.formHeading}
      >
        {formState === "success" ? (
          <div className="text-center">
            <div className="rounded-lg bg-green-50 p-4 text-green-800">
              {p.successMessage}
            </div>
            <Button variant="outline" size="sm" onClick={closeContactModal} className="mt-4">
              {t.nav.myAccount ? "OK" : "OK"}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Honeypot */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                type="text"
                id="website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="contact-name"
                  className="mb-2 block text-sm font-medium text-[var(--rcb-text-strong)]"
                >
                  {p.nameLabel} <span className="text-[var(--rcb-primary)]">*</span>
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClasses}
                />
              </div>

              <div>
                <label
                  htmlFor="contact-email"
                  className="mb-2 block text-sm font-medium text-[var(--rcb-text-strong)]"
                >
                  {p.emailLabel} <span className="text-[var(--rcb-primary)]">*</span>
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  maxLength={255}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClasses}
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="contact-company"
                  className="mb-2 block text-sm font-medium text-[var(--rcb-text-strong)]"
                >
                  {p.companyLabel}
                </label>
                <input
                  id="contact-company"
                  type="text"
                  maxLength={255}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className={inputClasses}
                />
              </div>

              <div>
                <label
                  htmlFor="contact-type"
                  className="mb-2 block text-sm font-medium text-[var(--rcb-text-strong)]"
                >
                  {p.typeLabel} <span className="text-[var(--rcb-primary)]">*</span>
                </label>
                <select
                  id="contact-type"
                  required
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={inputClasses}
                >
                  <option value="">{p.typePlaceholder}</option>
                  {(Object.entries(p.typeOptions) as [string, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="contact-message"
                className="mb-2 block text-sm font-medium text-[var(--rcb-text-strong)]"
              >
                {p.messageLabel} <span className="text-[var(--rcb-primary)]">*</span>
              </label>
              <textarea
                id="contact-message"
                required
                minLength={10}
                maxLength={2000}
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 py-3 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
              />
            </div>

            {formState === "error" && (
              <div className="rounded-lg bg-red-50 p-4 text-red-800">
                {errorMsg || p.errorMessage}
              </div>
            )}

            <div className="text-center">
              <Button type="submit" disabled={formState === "loading"}>
                {formState === "loading" ? p.submitting : p.submitButton}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
export default PartnerPage;
