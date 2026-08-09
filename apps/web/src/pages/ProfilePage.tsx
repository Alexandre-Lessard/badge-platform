import { useEffect, useState } from "react";
import type { User } from "@badge/shared";
import { Link } from "react-router";
import { useLanguage } from "@/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/api-client";
import { AccountNav } from "@/components/layout/AccountNav";
import { Button } from "@/components/ui/Button";
import { getButtonClasses } from "@/lib/button-styles";
import { ROUTES } from "@/routes/routes";

type ProfileForm = {
  firstName: string;
  lastName: string;
  contactEmail: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  postalCode: string;
};

function getProfileForm(user: User | null): ProfileForm {
  return {
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    contactEmail: user?.contactEmail ?? "",
    phone: user?.phone ?? "",
    address1: user?.address1 ?? "",
    address2: user?.address2 ?? "",
    city: user?.city ?? "",
    province: user?.province ?? "",
    postalCode: user?.postalCode ?? "",
  };
}

export function ProfilePage() {
  const { t } = useLanguage();
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState<ProfileForm>(() => getProfileForm(user));
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setForm(getProfileForm(user));
  }, [user]);

  function update<K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setSuccess(false);
    setError(false);

    try {
      await apiRequest("/auth/profile", {
        method: "PATCH",
        body: form,
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

  const profile = t.profile;
  const auth = t.auth;

  return (
    <section className="min-h-[70vh] bg-[var(--rcb-white)]">
      <title>{`${profile?.heading ?? "My profile"} | Badge`}</title>
      <div className="section-shell py-16">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold text-[var(--rcb-text-strong)]">
            {profile?.heading ?? "My profile"}
          </h1>
          <p className="mt-2 text-sm text-[var(--rcb-text-muted)]">
            {profile?.description ?? "Manage your personal information and civic address."}
          </p>
        </div>

        <AccountNav current="profile" className="mt-6" />

        <div className="mt-10 max-w-3xl space-y-10">
          <div>
            <h2 className="text-lg font-semibold text-[var(--rcb-text-strong)]">
              {profile?.personalInfoHeading ?? "Personal information"}
            </h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="profile-first-name" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
                  {auth?.firstNameLabel ?? "First name"}
                </label>
                <input
                  id="profile-first-name"
                  type="text"
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="profile-last-name" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
                  {auth?.lastNameLabel ?? "Last name"}
                </label>
                <input
                  id="profile-last-name"
                  type="text"
                  value={form.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                  className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 max-w-md">
              <label htmlFor="profile-phone" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
                {auth?.phoneLabel ?? "Phone"}{" "}
                <span className="text-[var(--rcb-text-muted)]">({auth?.optional ?? "optional"})</span>
              </label>
              <input
                id="profile-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
              />
            </div>

            <div className="mt-4 max-w-md">
              <label htmlFor="profile-contact-email" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
                {profile?.contactEmailLabel ?? "Contact email"}{" "}
                <span className="text-[var(--rcb-text-muted)]">({auth?.optional ?? "optional"})</span>
              </label>
              <input
                id="profile-contact-email"
                type="email"
                value={form.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
                placeholder={user?.email ?? ""}
                className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
              />
              <p className="mt-1 text-xs text-[var(--rcb-text-muted)]">
                {profile?.contactEmailHelper ?? "Used to reach you if one of your items is found. Defaults to your account email."}
              </p>
            </div>
          </div>

          <div className="border-t border-[var(--rcb-border)] pt-8">
            <h2 className="text-lg font-semibold text-[var(--rcb-text-strong)]">
              {profile?.addressHeading ?? "Civic address"}
            </h2>
            <p className="mt-2 text-sm text-[var(--rcb-text-muted)]">
              {profile?.addressDescription ?? "Address fields are optional and can be used to complete your profile."}
            </p>

            <div className="mt-4 grid gap-4">
              <div>
                <label htmlFor="profile-address1" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
                  {profile?.address1Label ?? "Address line 1"}{" "}
                  <span className="text-[var(--rcb-text-muted)]">({auth?.optional ?? "optional"})</span>
                </label>
                <input
                  id="profile-address1"
                  type="text"
                  value={form.address1}
                  onChange={(e) => update("address1", e.target.value)}
                  className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="profile-address2" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
                  {profile?.address2Label ?? "Address line 2"}{" "}
                  <span className="text-[var(--rcb-text-muted)]">({auth?.optional ?? "optional"})</span>
                </label>
                <input
                  id="profile-address2"
                  type="text"
                  value={form.address2}
                  onChange={(e) => update("address2", e.target.value)}
                  className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="profile-city" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
                    {profile?.cityLabel ?? "City"}{" "}
                    <span className="text-[var(--rcb-text-muted)]">({auth?.optional ?? "optional"})</span>
                  </label>
                  <input
                    id="profile-city"
                    type="text"
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="profile-province" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
                    {profile?.provinceLabel ?? "Province"}{" "}
                    <span className="text-[var(--rcb-text-muted)]">({auth?.optional ?? "optional"})</span>
                  </label>
                  <input
                    id="profile-province"
                    type="text"
                    value={form.province}
                    onChange={(e) => update("province", e.target.value)}
                    className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="profile-postal-code" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
                    {profile?.postalCodeLabel ?? "Postal code"}{" "}
                    <span className="text-[var(--rcb-text-muted)]">({auth?.optional ?? "optional"})</span>
                  </label>
                  <input
                    id="profile-postal-code"
                    type="text"
                    value={form.postalCode}
                    onChange={(e) => update("postalCode", e.target.value)}
                    className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || !user}>
              {saving
                ? (profile?.saving ?? "Saving...")
                : (profile?.saveButton ?? "Save")}
            </Button>
            <Link
              to={ROUTES.dashboard}
              className={getButtonClasses("outline", "sm", "whitespace-nowrap text-center")}
            >
              {profile?.backToDashboard ?? "Back to dashboard"}
            </Link>
            {success && (
              <span className="text-sm font-medium text-green-600">
                {profile?.successMessage ?? "Saved!"}
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

export default ProfilePage;
