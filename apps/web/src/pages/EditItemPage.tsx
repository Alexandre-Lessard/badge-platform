import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useLanguage } from "@/i18n/context";
import { useRef } from "react";
import { apiRequest, apiUpload, isNetworkError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { Button } from "@/components/ui/Button";
import { getButtonClasses } from "@/lib/button-styles";
import { Modal } from "@/components/ui/Modal";
import { ServiceUnavailable } from "@/components/auth/ServiceUnavailable";
import { PromoCallout } from "@/components/ui/PromoCallout";
import { ItemImage } from "@/components/ui/ItemImage";
import { ITEM_CATEGORIES, normalizeRnbpCode, RNBP_REGEX } from "@rnbp/shared";
import type { ItemWithFiles } from "@rnbp/shared";
import { ROUTES } from "@/routes/routes";

type FormData = {
  name: string;
  category: string;
  brand: string;
  model: string;
  year: string;
  serialNumber: string;
  trackerId: string;
  estimatedValue: string;
  description: string;
  rnbpNumber: string;
};

export function EditItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [form, setForm] = useState<FormData>({
    name: "",
    category: "",
    brand: "",
    model: "",
    year: "",
    serialNumber: "",
    trackerId: "",
    estimatedValue: "",
    description: "",
    rnbpNumber: "",
  });
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const [documents, setDocuments] = useState<{ id: string; url: string; fileName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemStatus, setItemStatus] = useState("");
  const [itemRnbpNumber, setItemRnbpNumber] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [backendDown, setBackendDown] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveCustom, setArchiveCustom] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const edit = t.editItem;
  const reg = t.registration;

  useEffect(() => {
    if (!id) return;
    apiRequest<{ item: ItemWithFiles }>(`/items/${id}`)
      .then(({ item }) => {
        if (item.status === "stolen") {
          navigate(ROUTES.itemDetail(id!), { replace: true });
          return;
        }
        setItemStatus(item.status);
        setItemRnbpNumber(item.rnbpNumber);
        setPhotos(item.photos.map((p) => ({ id: p.id, url: p.url })));
        setDocuments(item.documents.map((d) => ({ id: d.id, url: d.url, fileName: d.fileName })));
        setForm({
          name: item.name,
          category: item.category,
          brand: item.brand ?? "",
          model: item.model ?? "",
          year: item.year?.toString() ?? "",
          serialNumber: item.serialNumber ?? "",
          trackerId: item.trackerId ?? "",
          estimatedValue: item.estimatedValue?.toString() ?? "",
          description: item.description ?? "",
          rnbpNumber: item.rnbpNumber ?? "",
        });
      })
      .catch((err) => {
        if (isNetworkError(err)) {
          setBackendDown(true);
        } else if (err.status === 404 || err.status === 403) {
          setNotFound(true);
        } else {
          setError(getErrorMessage(err, t));
        }
      })
      .finally(() => setLoading(false));
  }, [id, t, navigate]);

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError("");

    const desiredCode = normalizeRnbpCode(form.rnbpNumber);
    const currentCode = itemRnbpNumber ?? "";
    const codeChanged = desiredCode !== currentCode;

    if (codeChanged && desiredCode !== "" && !RNBP_REGEX.test(desiredCode)) {
      setError(t.apiErrors?.INVALID_RNBP_FORMAT ?? "Invalid RNBP code format.");
      setSaving(false);
      return;
    }

    const body: Record<string, unknown> = {
      name: form.name,
      category: form.category,
      brand: form.brand,
      model: form.model,
      year: form.year ? Number(form.year) : undefined,
      serialNumber: form.serialNumber,
      trackerId: form.trackerId,
      estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
      description: form.description,
    };

    try {
      // Claim the new RNBP code (separate endpoint) before saving the rest.
      // If the claim fails, abort — don't leave the item partially updated.
      if (codeChanged && desiredCode !== "") {
        await apiRequest(`/sticker-codes/${encodeURIComponent(desiredCode)}/claim`, {
          method: "POST",
          body: { itemId: id },
        });
        setItemRnbpNumber(desiredCode);
      }
      await apiRequest(`/items/${id}`, { method: "PATCH", body });
      navigate(ROUTES.dashboard);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  }

  const categoryLabels = t.allCategories.items;
  const categoryOptions = ITEM_CATEGORIES.map((slug, i) => ({
    value: slug,
    label: categoryLabels[i] ?? slug,
  }));

  async function handleArchive() {
    if (archiving || !archiveReason) return;
    setArchiving(true);
    try {
      await apiRequest(`/items/${id}/archive`, {
        method: "POST",
        body: {
          reason: archiveReason,
          customReason: archiveReason === "other" ? archiveCustom : undefined,
        },
      });
      navigate(ROUTES.dashboard);
    } catch (err) {
      setError(getErrorMessage(err, t));
      setArchiveOpen(false);
    } finally {
      setArchiving(false);
    }
  }

  async function handleRecover() {
    if (recovering) return;
    setRecovering(true);
    try {
      await apiRequest(`/items/${id}/recover`, { method: "PATCH" });
      setItemStatus("active");
      setRecoverOpen(false);
    } catch (err) {
      setError(getErrorMessage(err, t));
      setRecoverOpen(false);
    } finally {
      setRecovering(false);
    }
  }

  async function handleUploadPhotos(fileList: FileList | null) {
    if (!fileList || uploading) return;
    setUploading(true);
    setError("");
    const fd = new FormData();
    Array.from(fileList).forEach((f) => fd.append("photos", f));
    try {
      const res = await apiUpload<{ photos: typeof photos }>(`/items/${id}/photos`, fd);
      setPhotos((prev) => [...prev, ...res.photos]);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function handleUploadDocuments(fileList: FileList | null) {
    if (!fileList || uploading) return;
    setUploading(true);
    setError("");
    const fd = new FormData();
    Array.from(fileList).forEach((f) => fd.append("documents", f));
    try {
      const res = await apiUpload<{ documents: typeof documents }>(`/items/${id}/documents`, fd);
      setDocuments((prev) => [...prev, ...res.documents]);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setUploading(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  }

  async function handleDeletePhoto(photoId: string) {
    try {
      await apiRequest(`/items/${id}/photos/${photoId}`, { method: "DELETE" });
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }

  async function handleDeleteDocument(docId: string) {
    try {
      await apiRequest(`/items/${id}/documents/${docId}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }

  const isStolen = itemStatus === "stolen";
  const canSave = form.name.trim() !== "" && form.category !== "" && !isStolen;
  const canArchive = archiveReason !== "" && (archiveReason !== "other" || archiveCustom.trim() !== "");
  const maxYear = new Date().getFullYear() + 1;
  const arc = t.archive;
  const trf = t.transfer;

  if (backendDown) {
    return (
      <section className="min-h-[80vh] bg-[var(--rcb-white)]">
        <ServiceUnavailable />
      </section>
    );
  }

  if (loading) {
    return (
      <section className="min-h-[80vh] bg-[var(--rcb-white)]">
        <div className="section-shell py-16">
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rcb-primary)] border-t-transparent" />
          </div>
        </div>
      </section>
    );
  }

  if (notFound) {
    return (
      <section className="min-h-[80vh] bg-[var(--rcb-white)]">
        <div className="section-shell py-16 text-center">
          <p className="text-lg text-[var(--rcb-text-muted)]">
            {edit?.notFound ?? "Item not found."}
          </p>
          <Link
            to={ROUTES.dashboard}
            className={`${getButtonClasses("primary", "sm")} mt-6`}
          >
            {edit?.backToDashboard ?? "Back to dashboard"}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[80vh] bg-[var(--rcb-white)]">
      <title>{`${edit?.heading ?? "Edit item"} | RNBP`}</title>
      <div className="section-shell py-16">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-[var(--rcb-text-strong)]">
            {edit?.heading ?? "Edit item"}
          </h1>
          <Link
            to={ROUTES.dashboard}
            className="text-sm font-medium text-[var(--rcb-primary)] hover:underline"
          >
            {edit?.backToDashboard ?? "Back to dashboard"}
          </Link>
        </div>

        {!itemRnbpNumber && (
          <div className="mt-6">
            <PromoCallout variant="item" items={[{ rnbpNumber: itemRnbpNumber }]} />
          </div>
        )}

        {isStolen && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {t.lookup?.stolenMessage ?? "This item has been reported stolen"}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <fieldset disabled={isStolen} className="mx-auto mt-8 max-w-2xl space-y-5">
          <div>
            <label htmlFor="edit-category" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
              {reg?.categoryLabel ?? "Category"} *
            </label>
            <select
              id="edit-category"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            >
              <option value="">{reg?.categoryPlaceholder ?? "Select a category"}</option>
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="edit-name" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
              {reg?.nameLabel ?? "Item name"} *
            </label>
            <input
              id="edit-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="edit-brand" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
                {reg?.brandLabel ?? "Brand"}
              </label>
              <input
                id="edit-brand"
                type="text"
                value={form.brand}
                onChange={(e) => update("brand", e.target.value)}
                className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="edit-model" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
                {reg?.modelLabel ?? "Model"}
              </label>
              <input
                id="edit-model"
                type="text"
                value={form.model}
                onChange={(e) => update("model", e.target.value)}
                className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="edit-year" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
                {reg?.yearLabel ?? "Year"}
              </label>
              <input
                id="edit-year"
                type="number"
                min="1900"
                max={maxYear}
                value={form.year}
                onChange={(e) => update("year", e.target.value)}
                className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-serial" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
              {reg?.serialLabel ?? "Serial number (original)"}
            </label>
            <input
              id="edit-serial"
              type="text"
              value={form.serialNumber}
              onChange={(e) => update("serialNumber", e.target.value)}
              className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            />
            <p className="mt-1 text-xs text-[var(--rcb-text-muted)]">
              {reg?.serialExplanation ?? "If your item has a manufacturer serial number, enter it here."}
            </p>
          </div>

          <div>
            <label htmlFor="edit-tracker" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
              {reg?.trackerIdLabel ?? "Tracker ID"}
            </label>
            <input
              id="edit-tracker"
              type="text"
              value={form.trackerId}
              onChange={(e) => update("trackerId", e.target.value)}
              className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            />
            <p className="mt-1 text-xs text-[var(--rcb-text-muted)]">
              {reg?.trackerIdExplanation ?? "e.g. serial number of an AirTag, Tile, or Samsung SmartTag"}
            </p>
          </div>

          <div>
            <label htmlFor="edit-rnbp" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
              {edit?.rnbpNumberLabel ?? "RNBP number"}
            </label>
            <input
              id="edit-rnbp"
              type="text"
              maxLength={13}
              value={form.rnbpNumber}
              onChange={(e) => update("rnbpNumber", e.target.value.toUpperCase())}
              placeholder="RNBP-XXXXXXXX"
              className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 font-mono uppercase tracking-wider text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            />
            <p className="mt-1 text-xs text-[var(--rcb-text-muted)]">
              {edit?.rnbpNumberHelper ??
                "Enter the code printed on your sticker to physically link this item to the registry."}
            </p>
            {itemRnbpNumber && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {edit?.rnbpOverwriteWarning ??
                  "Changing this code will replace the published identifier in the registry. Use this only to fix a typo or replace a damaged sheet."}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="edit-value" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
              {reg?.valueLabel ?? "Estimated value ($)"}
            </label>
            <input
              id="edit-value"
              type="number"
              min="250"
              value={form.estimatedValue}
              onChange={(e) => update("estimatedValue", e.target.value)}
              className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="edit-description" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
              {reg?.descriptionLabel ?? "Description"}
            </label>
            <textarea
              id="edit-description"
              rows={3}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              className="w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 py-3 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            />
            <p className="mt-1 text-xs text-[var(--rcb-text-muted)]">
              {reg?.descriptionHelper}
            </p>
          </div>

          {/* ── Photos ───────────────────────────────────── */}
          <div className="border-t border-[var(--rcb-border)] pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--rcb-text-strong)]">
                {reg?.photosHeading ?? "Photos"}
              </h2>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploading}
                className="cursor-pointer text-sm font-medium text-[var(--rcb-primary)] hover:underline disabled:opacity-50"
              >
                {uploading ? "..." : `+ ${reg?.photosHeading ?? "Add photos"}`}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleUploadPhotos(e.target.files)}
              />
            </div>
            {photos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {photos.map((photo) => (
                  <div key={photo.id} className="group relative">
                    <ItemImage
                      src={photo.url}
                      alt={form.name || reg?.photosHeading || "Item photo"}
                      className="h-24 w-24 rounded-lg border border-[var(--rcb-border)] object-cover"
                      fallbackClassName="flex h-24 w-24 items-center justify-center rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-surface)]"
                      iconClassName="h-8 w-8 text-[var(--rcb-border)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute -top-2 -right-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Documents ──────────────────────────────── */}
          <div className="border-t border-[var(--rcb-border)] pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--rcb-text-strong)]">
                {reg?.documentsHeading ?? "Documents"}
              </h2>
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                disabled={uploading}
                className="cursor-pointer text-sm font-medium text-[var(--rcb-primary)] hover:underline disabled:opacity-50"
              >
                {uploading ? "..." : `+ ${reg?.documentsHeading ?? "Add documents"}`}
              </button>
              <input
                ref={docInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => handleUploadDocuments(e.target.files)}
              />
            </div>
            {documents.length > 0 && (
              <ul className="mt-3 space-y-2">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-surface)] px-4 py-2 text-sm"
                  >
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-[var(--rcb-primary)] hover:underline"
                    >
                      {doc.fileName}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="ml-3 cursor-pointer text-red-500 hover:text-red-700"
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!isStolen && (
            <Button
              onClick={handleSave}
              disabled={!canSave || saving}
            >
              {saving
                ? (edit?.saving ?? "Saving\u2026")
                : (edit?.saveButton ?? "Save changes")}
            </Button>
          )}
        </fieldset>

          {/* ── Archive, Recover & Transfer actions ──────── */}
          <div className="mx-auto mt-10 max-w-2xl flex flex-wrap gap-3 border-t border-[var(--rcb-border)] pt-6">
            {itemStatus === "stolen" && (
              <Button
                size="sm"
                onClick={() => setRecoverOpen(true)}
              >
                {edit?.recoverButton ?? "Mark as recovered"}
              </Button>
            )}
            {itemStatus !== "stolen" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setArchiveOpen(true)}
              >
                {arc?.button ?? "Archive this item"}
              </Button>
            )}
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-xl border border-[var(--rcb-border)] px-6 py-2 text-sm font-medium text-[var(--rcb-text-muted)] opacity-50"
              title={trf?.comingSoon ?? "Coming soon"}
            >
              {trf?.button ?? "Transfer this item"}
            </button>
          </div>
      </div>

      {/* ── Archive modal ───────────────────────────────── */}
      <Modal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title={arc?.modalTitle ?? "Archive item"}
      >
        <p className="text-sm text-[var(--rcb-text-muted)]">
          {arc?.modalDescription ?? "Why do you want to archive this item?"}
        </p>
        <div className="mt-4 space-y-2">
          {["destroyed", "lost", "discarded", "registration_error", "other"].map((reason) => (
            <label key={reason} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--rcb-surface)]">
              <input
                type="radio"
                name="archive-reason"
                value={reason}
                checked={archiveReason === reason}
                onChange={() => setArchiveReason(reason)}
                className="accent-[var(--rcb-primary)]"
              />
              <span className="text-sm text-[var(--rcb-text-body)]">
                {arc?.reasons?.[reason] ?? reason}
              </span>
            </label>
          ))}
        </div>
        {archiveReason === "other" && (
          <textarea
            className="mt-3 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 py-3 text-sm text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            rows={2}
            placeholder={arc?.customReasonPlaceholder ?? "Specify the reason…"}
            value={archiveCustom}
            onChange={(e) => setArchiveCustom(e.target.value)}
          />
        )}
        <div className="mt-6 flex gap-3">
          <Button
            onClick={handleArchive}
            disabled={!canArchive || archiving}
            size="sm"
          >
            {archiving
              ? (arc?.archiving ?? "Archiving…")
              : (arc?.confirmButton ?? "Archive")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setArchiveOpen(false)}
          >
            {arc?.cancelButton ?? "Cancel"}
          </Button>
        </div>
      </Modal>

      {/* ── Recover confirmation modal ────────────────── */}
      <Modal
        open={recoverOpen}
        onClose={() => setRecoverOpen(false)}
        title={edit?.recoverButton ?? "Mark as recovered"}
      >
        <p className="text-sm text-[var(--rcb-text-muted)]">
          {edit?.recoverConfirm ?? "Confirm this item has been recovered?"}
        </p>
        <div className="mt-6 flex gap-3">
          <Button
            onClick={handleRecover}
            disabled={recovering}
            size="sm"
          >
            {recovering
              ? (edit?.recovering ?? "Processing…")
              : (edit?.recoverConfirmButton ?? "Yes, mark as recovered")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRecoverOpen(false)}
          >
            {edit?.recoverCancel ?? "Cancel"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
export default EditItemPage;
