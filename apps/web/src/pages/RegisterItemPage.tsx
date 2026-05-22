import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/i18n/context";
import { useAuth, setRefreshToken } from "@/lib/auth-context";
import { apiRequest, apiUpload, setAccessToken, isNetworkError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { useCart } from "@/lib/cart-context";
import { ServiceUnavailable } from "@/components/auth/ServiceUnavailable";
import { StepIndicator } from "@/components/registration/StepIndicator";
import { StepItemDetails } from "@/components/registration/StepItemDetails";
import { StepDocuments } from "@/components/registration/StepDocuments";
import { StepStickerUpsell } from "@/components/registration/StepStickerUpsell";
import { StepAccount } from "@/components/registration/StepAccount";
import { RegistrationConfirmation } from "@/components/registration/RegistrationConfirmation";
import { useObjectUrls } from "@/lib/useObjectUrls";
import {
  buildCreateItemInput,
  sanitizeItemDraft,
  type ItemFormData,
} from "@/lib/register-item";

type AccountData = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
};

const STORAGE_KEY = "rnbp_registration_draft";

function loadDraft(): { item: ItemFormData; account: AccountData; termsAccepted: boolean } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as {
      item?: unknown;
      account?: Partial<AccountData>;
      termsAccepted?: boolean;
    };

    return {
      item: sanitizeItemDraft(parsed.item, emptyItem),
      account: {
        email: typeof parsed.account?.email === "string" ? parsed.account.email : emptyAccount.email,
        password: typeof parsed.account?.password === "string" ? parsed.account.password : emptyAccount.password,
        firstName: typeof parsed.account?.firstName === "string" ? parsed.account.firstName : emptyAccount.firstName,
        lastName: typeof parsed.account?.lastName === "string" ? parsed.account.lastName : emptyAccount.lastName,
        phone: typeof parsed.account?.phone === "string" ? parsed.account.phone : emptyAccount.phone,
      },
      termsAccepted: parsed.termsAccepted === true,
    };
  } catch {
    return null;
  }
}

function saveDraft(item: ItemFormData, account: AccountData, termsAccepted: boolean) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ item, account, termsAccepted }));
}

function clearDraft() {
  sessionStorage.removeItem(STORAGE_KEY);
}

const emptyItem: ItemFormData = {
  name: "",
  category: "",
  brand: "",
  model: "",
  year: "",
  serialNumber: "",
  trackerId: "",
  estimatedValue: "",
  description: "",
};

const emptyAccount: AccountData = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  phone: "",
};

export function RegisterItemPage() {
  const { t } = useLanguage();
  const { user, refreshAuth } = useAuth();
  const { updateItemId } = useCart();
  const reg = t.registration;

  const draft = loadDraft();
  const [step, setStep] = useState(1);
  const [itemData, setItemData] = useState<ItemFormData>(draft?.item ?? emptyItem);
  const [accountData, setAccountData] = useState<AccountData>(draft?.account ?? emptyAccount);
  const [termsAccepted, setTermsAccepted] = useState(draft?.termsAccepted ?? false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backendDown, setBackendDown] = useState(false);
  const [completed, setCompleted] = useState(false);
  const photoUrls = useObjectUrls(photos);

  // Logged in = 3 steps, logged out = 4
  const totalSteps = user ? 3 : 4;

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  // Debounced save to sessionStorage
  useEffect(() => {
    const timeout = setTimeout(() => {
      saveDraft(itemData, accountData, termsAccepted);
    }, 500);
    return () => clearTimeout(timeout);
  }, [itemData, accountData, termsAccepted]);

  const uploadFiles = useCallback(async (itemId: string) => {
    let uploadFailed = false;
    if (photos.length > 0) {
      const fd = new FormData();
      photos.forEach((f) => fd.append("photos", f));
      try { await apiUpload(`/items/${itemId}/photos`, fd); } catch { uploadFailed = true; }
    }
    if (documents.length > 0) {
      const fd = new FormData();
      documents.forEach((f) => fd.append("documents", f));
      try { await apiUpload(`/items/${itemId}/documents`, fd); } catch { uploadFailed = true; }
    }
    if (uploadFailed) {
      setError(t.errors?.generic ?? "Some files could not be uploaded. You can add them later from the item page.");
    }
  }, [photos, documents, t]);

  const handleSubmitLoggedIn = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const body = buildCreateItemInput(itemData);
      if (body.error) {
        setError(body.error);
        return;
      }

      const res = await apiRequest<{ item: { id: string } }>(
        "/items",
        { method: "POST", body: body.data },
      );

      await uploadFiles(res.item.id);

      clearDraft();
      // Update cart if a sticker was added during registration
      updateItemId(`pending:${itemData.name}`, res.item.id);
      setCompleted(true);
      setStep(totalSteps + 1); // confirmation
    } catch (err) {
      if (isNetworkError(err)) { setBackendDown(true); return; }
      setError(getErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  }, [itemData, uploadFiles, totalSteps, updateItemId, t]);

  const handleSubmitWithAccount = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const item = buildCreateItemInput(itemData);
      if (item.error) {
        setError(item.error);
        return;
      }

      const res = await apiRequest<{
        item: { id: string };
        accessToken: string;
        refreshToken: string;
      }>("/auth/register-with-item", {
        method: "POST",
        body: {
          account: {
            email: accountData.email,
            password: accountData.password,
            firstName: accountData.firstName,
            lastName: accountData.lastName,
            phone: accountData.phone || undefined,
          },
          item: item.data,
        },
      });

      setAccessToken(res.accessToken);
      setRefreshToken(res.refreshToken);
      await refreshAuth();

      await uploadFiles(res.item.id);

      clearDraft();
      // Update cart if a sticker was added during registration
      updateItemId(`pending:${itemData.name}`, res.item.id);
      setCompleted(true);
      setStep(totalSteps + 1); // confirmation
    } catch (err) {
      if (isNetworkError(err)) { setBackendDown(true); return; }
      setError(getErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  }, [accountData, itemData, uploadFiles, totalSteps, refreshAuth, updateItemId, t]);

  if (backendDown) {
    return (
      <section className="min-h-[70vh] bg-[var(--rcb-white)]">
        <ServiceUnavailable />
      </section>
    );
  }

  // Confirmation screen
  if (completed) {
    return (
      <section className="bg-[var(--rcb-white)] py-16">
        <div className="section-shell">
          <RegistrationConfirmation totalSteps={totalSteps} />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[var(--rcb-white)] py-16">
      <div className="section-shell">
        <title>{`${reg?.heading ?? "Register an item"} | Badge`}</title>
        <h1 className="text-center text-3xl font-bold text-[var(--rcb-text-strong)]">
          {reg?.heading ?? "Register an item"}
        </h1>
        <p className="mt-2 text-center text-lg text-[var(--rcb-text-muted)]">
          {reg?.description ?? ""}
        </p>

        <div className="mt-10">
          <StepIndicator currentStep={step} totalSteps={totalSteps} />
        </div>

        <div className="mt-12">
          {step === 1 && (
            <StepItemDetails
              data={itemData}
              onChange={setItemData}
              onNext={() => setStep(2)}
              termsAccepted={termsAccepted}
              onTermsChange={setTermsAccepted}
            />
          )}

          {step === 2 && (
            <StepDocuments
              photos={photos}
              photoUrls={photoUrls}
              documents={documents}
              onPhotosChange={setPhotos}
              onDocumentsChange={setDocuments}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <StepStickerUpsell
              loading={loading}
              error={error}
              onNext={() => {
                if (user) {
                  handleSubmitLoggedIn();
                } else {
                  setStep(4);
                }
              }}
              onBack={() => setStep(2)}
            />
          )}

          {step === 4 && !user && (
            <StepAccount
              data={accountData}
              onChange={setAccountData}
              onSubmit={handleSubmitWithAccount}
              onBack={() => setStep(3)}
              loading={loading}
              error={error}
            />
          )}
        </div>
      </div>
    </section>
  );
}
export default RegisterItemPage;
