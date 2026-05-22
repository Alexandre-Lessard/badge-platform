import { useState, useEffect, type FormEvent } from "react";
import { Link } from "react-router";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/i18n/context";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { getButtonClasses } from "@/lib/button-styles";
import { normalizeBadgeCode, BADGE_CODE_REGEX } from "@rnbp/shared";
import { ROUTES } from "@/routes/routes";

type AssignableItem = {
  id: string;
  name: string;
  badgeCode: string | null;
};

type CommonProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (code: string, itemId: string) => void;
};

type AssignRnbpModalProps = CommonProps &
  (
    | { mode?: "fixed-item"; itemId: string; itemName?: string; code?: undefined }
    | { mode: "pick-item"; code: string; itemId?: undefined; itemName?: undefined }
  );

export function AssignRnbpModal(props: AssignRnbpModalProps) {
  const { open, onClose, onSuccess } = props;
  const mode = props.mode ?? "fixed-item";
  const { t } = useLanguage();
  const [codeInput, setCodeInput] = useState("");
  const [pickedItemId, setPickedItemId] = useState("");
  const [items, setItems] = useState<AssignableItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setCodeInput("");
      setPickedItemId("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "pick-item") return;
    setLoadingItems(true);
    apiRequest<{ items: AssignableItem[] }>("/items")
      .then(({ items: list }) => {
        // Only items without a code can receive one (otherwise the claim would
        // overwrite their existing code, which is the edit-form's job, not this).
        setItems(list.filter((i) => !i.badgeCode));
      })
      .catch((err) => setError(getErrorMessage(err, t)))
      .finally(() => setLoadingItems(false));
  }, [open, mode, t]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    let code: string;
    let itemId: string;
    if (mode === "fixed-item") {
      code = normalizeBadgeCode(codeInput);
      itemId = props.itemId!;
    } else {
      code = normalizeBadgeCode(props.code!);
      itemId = pickedItemId;
    }

    if (!BADGE_CODE_REGEX.test(code)) {
      setError(t.apiErrors?.INVALID_BADGE_FORMAT ?? "Invalid badge code format.");
      return;
    }
    if (!itemId) {
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await apiRequest(`/sticker-codes/${encodeURIComponent(code)}/claim`, {
        method: "POST",
        body: { itemId },
      });
      onSuccess(code, itemId);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  const dash = t.dashboard;
  const scan = t.scan;
  const submitDisabled =
    submitting ||
    (mode === "fixed-item" && codeInput.trim() === "") ||
    (mode === "pick-item" && pickedItemId === "");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={dash?.assignBadgeModalTitle ?? "Assign an badge code"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "fixed-item" && props.itemName && (
          <p className="text-sm text-[var(--rcb-text-muted)]">{props.itemName}</p>
        )}

        {mode === "fixed-item" ? (
          <>
            <p className="text-sm text-[var(--rcb-text-muted)]">
              {dash?.assignBadgeModalHelp ??
                "Enter one of the codes printed on your sticker sheet."}
            </p>
            <input
              type="text"
              autoFocus
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="BADGE-XXXXXXXX"
              maxLength={13}
              className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 font-mono uppercase tracking-wider text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            />
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--rcb-text-muted)]">
              <span className="font-mono font-semibold tracking-wider text-[var(--rcb-text-strong)]">
                {props.code}
              </span>
            </p>
            <label
              htmlFor="assign-rnbp-item"
              className="block text-sm text-[var(--rcb-text-muted)]"
            >
              {scan?.pickItemLabel ?? "Which item do you want to link it to?"}
            </label>
            {loadingItems ? (
              <div className="flex justify-center py-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--rcb-primary)] border-t-transparent" />
              </div>
            ) : items.length === 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {scan?.noItemsToLink ??
                  "You have no unlinked items. Register an item first."}
              </p>
            ) : (
              <select
                id="assign-rnbp-item"
                autoFocus
                value={pickedItemId}
                onChange={(e) => setPickedItemId(e.target.value)}
                className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
              >
                <option value="">— {scan?.pickItemPlaceholder ?? "Select an item"} —</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}
          </>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t.archive?.cancelButton ?? "Cancel"}
          </Button>
          {mode === "pick-item" && !loadingItems && items.length === 0 ? (
            <Link
              to={ROUTES.registerItem}
              onClick={onClose}
              className={getButtonClasses("primary", "sm")}
            >
              + {t.dashboard?.addItem ?? "Register an item"}
            </Link>
          ) : (
            <Button type="submit" size="sm" disabled={submitDisabled}>
              {submitting
                ? "..."
                : (dash?.assignBadgeModalSubmit ?? "Assign")}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
