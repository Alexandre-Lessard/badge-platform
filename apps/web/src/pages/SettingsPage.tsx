import { useState } from "react";
import { useLanguage } from "@/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/api-client";
import { AccountNav } from "@/components/layout/AccountNav";
import { Button } from "@/components/ui/Button";

export function SettingsPage() {
  const { t } = useLanguage();
  const { user, refreshUser } = useAuth();
  const [lang, setLang] = useState(user?.preferredLanguage ?? "fr");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSuccess(false);
    setError(false);
    try {
      await apiRequest("/auth/profile", {
        method: "PATCH",
        body: { preferredLanguage: lang },
      });
      await refreshUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 5000);
    } finally {
      setSaving(false);
    }
  }

  const s = t.settings;

  return (
    <section className="min-h-[70vh] bg-[var(--rcb-white)]">
      <title>{`${s?.heading ?? "Settings"} | Badge`}</title>
      <div className="section-shell py-16">
        <h1 className="text-3xl font-bold text-[var(--rcb-text-strong)]">
          {s?.heading ?? "Settings"}
        </h1>

        <AccountNav current="settings" className="mt-6" />

        <div className="mt-10 max-w-lg">
          <h2 className="text-lg font-semibold text-[var(--rcb-text-strong)]">
            {s?.communicationHeading ?? "Communication"}
          </h2>
          <p className="mt-2 text-sm text-[var(--rcb-text-muted)]">
            {s?.communicationDescription ?? "Choose the language for emails and notifications."}
          </p>

          <div className="mt-4">
            <label htmlFor="pref-lang" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
              {s?.languageLabel ?? "Preferred language"}
            </label>
            <select
              id="pref-lang"
              value={lang}
              onChange={(e) => setLang(e.target.value as "fr" | "en")}
              className="h-12 w-full max-w-xs rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? (s?.saving ?? "Saving…")
                : (s?.saveButton ?? "Save")}
            </Button>
            {success && (
              <span className="text-sm font-medium text-green-600">
                {s?.successMessage ?? "Saved!"}
              </span>
            )}
            {error && (
              <span className="text-sm font-medium text-red-600">
                {t.errors?.generic ?? "Error"}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
export default SettingsPage;
