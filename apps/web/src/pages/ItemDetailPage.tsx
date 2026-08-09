import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useLanguage } from "@/i18n/context";
import { apiRequest, apiUpload, isNetworkError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { Button } from "@/components/ui/Button";
import { getButtonClasses } from "@/lib/button-styles";
import { Modal } from "@/components/ui/Modal";
import { ServiceUnavailable } from "@/components/auth/ServiceUnavailable";
import { ItemImage } from "@/components/ui/ItemImage";
import { AssignBadgeCodeModal } from "@/components/AssignBadgeCodeModal";
import { INSURERS, ITEM_CATEGORIES, type ItemWithFiles } from "@badge/shared";
import { ROUTES } from "@/routes/routes";

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, locale } = useLanguage();

  const [item, setItem] = useState<ItemWithFiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [backendDown, setBackendDown] = useState(false);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveCustom, setArchiveCustom] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  const edit = t.editItem;
  const reg = t.registration;
  const arc = t.archive;
  const dash = t.dashboard;

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    stolen: "bg-red-100 text-red-800",
    transferred: "bg-gray-100 text-gray-800",
  };

  useEffect(() => {
    if (!id) return;
    apiRequest<{ item: ItemWithFiles }>(`/items/${id}`)
      .then(({ item }) => setItem(item))
      .catch((err) => {
        if (isNetworkError(err)) setBackendDown(true);
        else if (err.status === 404 || err.status === 403) setNotFound(true);
        else setError(getErrorMessage(err, t));
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  async function handleUploadDocuments(fileList: FileList | null) {
    if (!fileList || uploading || !item) return;
    setUploading(true);
    setError("");
    const fd = new FormData();
    Array.from(fileList).forEach((f) => fd.append("documents", f));
    try {
      const res = await apiUpload<{ documents: ItemWithFiles["documents"] }>(
        `/items/${item.id}/documents`,
        fd,
      );
      setItem((prev) =>
        prev ? { ...prev, documents: [...prev.documents, ...res.documents] } : prev,
      );
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setUploading(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  }

  async function handleRecover() {
    if (recovering) return;
    setRecovering(true);
    try {
      await apiRequest(`/items/${id}/recover`, { method: "PATCH" });
      setItem((prev) => prev ? { ...prev, status: "active" } : prev);
      setRecoverOpen(false);
    } catch (err) {
      setError(getErrorMessage(err, t));
      setRecoverOpen(false);
    } finally {
      setRecovering(false);
    }
  }

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

  function handleAssignSuccess(code: string) {
    setItem((prev) => (prev ? { ...prev, badgeCode: code } : prev));
  }

  const canArchive = archiveReason !== "" && (archiveReason !== "other" || archiveCustom.trim() !== "");

  if (backendDown) return <section className="min-h-[80vh] bg-[var(--rcb-white)]"><ServiceUnavailable /></section>;

  if (loading) {
    return (
      <section className="min-h-[80vh] bg-[var(--rcb-white)]">
        <div className="section-shell py-16">
          <div className="flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rcb-primary)] border-t-transparent" /></div>
        </div>
      </section>
    );
  }

  if (notFound || !item) {
    return (
      <section className="min-h-[80vh] bg-[var(--rcb-white)]">
        <div className="section-shell py-16 text-center">
          <p className="text-lg text-[var(--rcb-text-muted)]">{edit?.notFound ?? "Item not found."}</p>
          <Link to={ROUTES.dashboard} className={`${getButtonClasses("primary", "sm")} mt-6`}>
            {edit?.backToDashboard ?? "Back to dashboard"}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[80vh] bg-[var(--rcb-white)]">
      <title>{`${item.name} | Badge`}</title>
      <div className="section-shell py-16">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            to={ROUTES.dashboard}
            className="text-sm font-medium text-[var(--rcb-text-muted)] transition-colors hover:text-[var(--rcb-primary)]"
          >
            &larr; {edit?.backToDashboard ?? "Back to dashboard"}
          </Link>
          {item.status !== "stolen" && (
            <Link
              to={ROUTES.edit(item.id)}
              className={getButtonClasses("outline", "sm")}
            >
              {dash?.editItem ?? "Edit"}
            </Link>
          )}
        </div>

        {/* Stolen banner */}
        {item.status === "stolen" && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {t.lookup?.stolenMessage ?? "This item has been reported stolen"}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="mx-auto mt-8 max-w-3xl">
          {/* Title + status */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--rcb-text-strong)]">{item.name}</h1>
              {(item.brand || item.model) && (
                <p className="mt-1 text-[var(--rcb-text-muted)]">
                  {item.brand}{item.model ? ` ${item.model}` : ""}
                </p>
              )}
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusColors[item.status] ?? "bg-gray-100 text-gray-800"}`}>
              {dash?.statuses?.[item.status] ?? item.status}
            </span>
          </div>

          {/* Badge code */}
          {item.badgeCode ? (
            <div className="mt-4 inline-block rounded-lg bg-[var(--rcb-surface)] px-4 py-2">
              <span className="text-xs text-[var(--rcb-text-muted)]">Badge</span>
              <p className="font-mono text-lg font-bold tracking-wider text-[var(--rcb-primary)]">{item.badgeCode}</p>
            </div>
          ) : (
            item.status === "active" && (
              <div className="mt-4">
                <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                  {dash?.assignBadgeButton ?? "Assign an badge code"}
                </Button>
              </div>
            )
          )}

          {/* Photo gallery */}
          {item.photos.length > 0 && (
            <div className="mt-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {item.photos.map((photo) => (
                  <ItemImage
                    key={photo.id}
                    src={photo.url}
                    alt={item.name}
                    className="h-48 w-full rounded-lg border border-[var(--rcb-border)] object-cover"
                    fallbackClassName="flex h-48 w-full items-center justify-center rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-surface)]"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Details grid */}
          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase text-[var(--rcb-text-muted)]">{reg?.categoryLabel ?? "Category"}</p>
              <p className="mt-1 text-[var(--rcb-text-strong)]">
                {t.allCategories.items[ITEM_CATEGORIES.indexOf(item.category as (typeof ITEM_CATEGORIES)[number])] ?? item.category}
              </p>
            </div>
            {item.year && (
              <div>
                <p className="text-xs font-medium uppercase text-[var(--rcb-text-muted)]">{reg?.yearLabel ?? "Year"}</p>
                <p className="mt-1 text-[var(--rcb-text-strong)]">{item.year}</p>
              </div>
            )}
            {item.serialNumber && (
              <div>
                <p className="text-xs font-medium uppercase text-[var(--rcb-text-muted)]">{reg?.serialLabel ?? "Serial number"}</p>
                <p className="mt-1 font-mono text-sm text-[var(--rcb-text-strong)]">{item.serialNumber}</p>
              </div>
            )}
            {item.trackerId && (
              <div>
                <p className="text-xs font-medium uppercase text-[var(--rcb-text-muted)]">{reg?.trackerIdLabel ?? "Tracker ID"}</p>
                <p className="mt-1 font-mono text-sm text-[var(--rcb-text-strong)]">{item.trackerId}</p>
              </div>
            )}
            {item.estimatedValue && (
              <div>
                <p className="text-xs font-medium uppercase text-[var(--rcb-text-muted)]">{reg?.valueLabel ?? "Estimated value"}</p>
                <p className="mt-1 text-[var(--rcb-text-strong)]">{item.estimatedValue.toLocaleString()} $</p>
              </div>
            )}
            {item.isInsured && (
              <div>
                <p className="text-xs font-medium uppercase text-[var(--rcb-text-muted)]">{reg?.insurerLabel ?? "Insurer"}</p>
                {/* Resolve from the id so the name follows the active language;
                    `insurerName` is the stored snapshot used as fallback. */}
                <p className="mt-1 text-[var(--rcb-text-strong)]">
                  {INSURERS.find((i) => i.id === item.insurerId)?.[locale] ?? item.insurerName ?? "—"}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          {item.description && (
            <div className="mt-6">
              <p className="text-xs font-medium uppercase text-[var(--rcb-text-muted)]">{reg?.descriptionLabel ?? "Description"}</p>
              <p className="mt-2 text-[var(--rcb-text-body)]">{item.description}</p>
            </div>
          )}

          {/* Documents — always visible, with empty state + upload from this page */}
          <div className="mt-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-medium uppercase text-[var(--rcb-text-muted)]">{reg?.documentsHeading ?? "Documents"}</p>
              <input
                ref={docInputRef}
                type="file"
                accept="application/pdf,image/*"
                multiple
                className="hidden"
                onChange={(e) => handleUploadDocuments(e.target.files)}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => docInputRef.current?.click()}
                className="cursor-pointer text-sm font-medium text-[var(--rcb-primary)] hover:underline disabled:opacity-50"
              >
                {uploading ? "…" : (reg?.addDocumentButton ?? "+ Add a document")}
              </button>
            </div>
            {item.documents.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {item.documents.map((doc) => (
                  <li key={doc.id}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--rcb-primary)] hover:underline"
                    >
                      {doc.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--rcb-text-muted)]">
                {reg?.documentsEmpty ?? "No document yet. Add your purchase invoice or any proof of ownership."}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="mt-10 flex flex-wrap gap-3 border-t border-[var(--rcb-border)] pt-6">
            {item.status === "stolen" && (
              <Button size="sm" onClick={() => setRecoverOpen(true)}>
                {edit?.recoverButton ?? "Mark as recovered"}
              </Button>
            )}
            {item.status !== "stolen" && (
              <>
                <Link to={ROUTES.edit(item.id)} className={getButtonClasses("outline", "sm")}>
                  {dash?.editItem ?? "Edit"}
                </Link>
                <Button variant="outline" size="sm" onClick={() => setArchiveOpen(true)}>
                  {arc?.button ?? "Archive this item"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recover modal */}
      <Modal open={recoverOpen} onClose={() => setRecoverOpen(false)} title={edit?.recoverButton ?? "Mark as recovered"}>
        <p className="text-sm text-[var(--rcb-text-muted)]">{edit?.recoverConfirm ?? "Confirm this item has been recovered?"}</p>
        <div className="mt-6 flex gap-3">
          <Button onClick={handleRecover} disabled={recovering} size="sm">
            {recovering ? (edit?.recovering ?? "Processing...") : (edit?.recoverConfirmButton ?? "Yes, mark as recovered")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRecoverOpen(false)}>
            {edit?.recoverCancel ?? "Cancel"}
          </Button>
        </div>
      </Modal>

      {/* Assign-badge modal */}
      <AssignBadgeCodeModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        itemId={item.id}
        itemName={item.name}
        onSuccess={handleAssignSuccess}
      />

      {/* Archive modal */}
      <Modal open={archiveOpen} onClose={() => setArchiveOpen(false)} title={arc?.modalTitle ?? "Archive item"}>
        <p className="text-sm text-[var(--rcb-text-muted)]">{arc?.modalDescription ?? "Why do you want to archive this item?"}</p>
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
              <span className="text-sm text-[var(--rcb-text-body)]">{arc?.reasons?.[reason] ?? reason}</span>
            </label>
          ))}
        </div>
        {archiveReason === "other" && (
          <textarea
            className="mt-3 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 py-3 text-sm text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            rows={2}
            placeholder={arc?.customReasonPlaceholder ?? "Specify the reason..."}
            value={archiveCustom}
            onChange={(e) => setArchiveCustom(e.target.value)}
          />
        )}
        <div className="mt-6 flex gap-3">
          <Button onClick={handleArchive} disabled={!canArchive || archiving} size="sm">
            {archiving ? (arc?.archiving ?? "Archiving...") : (arc?.confirmButton ?? "Archive")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setArchiveOpen(false)}>
            {arc?.cancelButton ?? "Cancel"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
export default ItemDetailPage;
