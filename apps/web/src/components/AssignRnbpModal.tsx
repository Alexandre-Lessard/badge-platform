import { useState, useEffect, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/i18n/context";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { normalizeRnbpCode, RNBP_REGEX } from "@rnbp/shared";

type AssignRnbpModalProps = {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemName?: string;
  onSuccess: (code: string) => void;
};

export function AssignRnbpModal({
  open,
  onClose,
  itemId,
  itemName,
  onSuccess,
}: AssignRnbpModalProps) {
  const { t } = useLanguage();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setValue("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const code = normalizeRnbpCode(value);
    if (!RNBP_REGEX.test(code)) {
      setError(t.apiErrors?.INVALID_RNBP_FORMAT ?? "Invalid RNBP code format.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await apiRequest(`/sticker-codes/${encodeURIComponent(code)}/claim`, {
        method: "POST",
        body: { itemId },
      });
      onSuccess(code);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  const dash = t.dashboard;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={dash?.assignRnbpModalTitle ?? "Assign an RNBP code"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {itemName && (
          <p className="text-sm text-[var(--rcb-text-muted)]">
            {itemName}
          </p>
        )}
        <p className="text-sm text-[var(--rcb-text-muted)]">
          {dash?.assignRnbpModalHelp ??
            "Enter one of the codes printed on your sticker sheet."}
        </p>
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="RNBP-XXXXXXXX"
          maxLength={13}
          className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 font-mono uppercase tracking-wider text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
        />
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t.archive?.cancelButton ?? "Cancel"}
          </Button>
          <Button type="submit" size="sm" disabled={submitting || value.trim() === ""}>
            {submitting
              ? "..."
              : (dash?.assignRnbpModalSubmit ?? "Assign")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
