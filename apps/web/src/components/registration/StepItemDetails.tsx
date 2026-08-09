import { Link } from "react-router";
import { useLanguage } from "@/i18n/context";
import { ROUTES } from "@/routes/routes";
import { Button } from "@/components/ui/Button";
import { ITEM_CATEGORIES } from "@badge/shared";
import {
  isKnownItemCategory,
  isValidEstimatedValue,
  isValidRegistrationYear,
  isWholeNumberString,
  type ItemFormData,
} from "@/lib/register-item";

type StepItemDetailsProps = {
  data: ItemFormData;
  onChange: (data: ItemFormData) => void;
  onNext: () => void;
  termsAccepted: boolean;
  onTermsChange: (v: boolean) => void;
};

export function StepItemDetails({
  data,
  onChange,
  onNext,
  termsAccepted,
  onTermsChange,
}: StepItemDetailsProps) {
  const { t } = useLanguage();
  const reg = t.registration!;

  const categoryLabels = t.allCategories.items;
  const categoryOptions = ITEM_CATEGORIES.map((slug, i) => ({
    value: slug,
    label: categoryLabels[i] ?? slug,
  }));

  function update(field: keyof ItemFormData, value: string) {
    onChange({ ...data, [field]: value });
  }

  const categoryValid = isKnownItemCategory(data.category);
  const yearValid = isValidRegistrationYear(data.year);
  const estimatedValueWholeNumber = isWholeNumberString(data.estimatedValue);
  const estimatedValueValid = isValidEstimatedValue(data.estimatedValue);

  const canContinue =
    data.name.trim() !== "" &&
    categoryValid &&
    yearValid &&
    estimatedValueValid &&
    termsAccepted;

  const maxYear = new Date().getFullYear() + 1;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <label htmlFor="reg-category" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
          {reg.categoryLabel} *
        </label>
        <select
          id="reg-category"
          value={data.category}
          onChange={(e) => update("category", e.target.value)}
          className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
        >
          <option value="">{reg.categoryPlaceholder}</option>
          {categoryOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="reg-name" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
          {reg.nameLabel} *
        </label>
        <input
          id="reg-name"
          type="text"
          required
          value={data.name}
          onChange={(e) => update("name", e.target.value)}
          className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="reg-brand" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
            {reg.brandLabel}
          </label>
          <input
            id="reg-brand"
            type="text"
            value={data.brand}
            onChange={(e) => update("brand", e.target.value)}
            className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="reg-model" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
            {reg.modelLabel}
          </label>
          <input
            id="reg-model"
            type="text"
            value={data.model}
            onChange={(e) => update("model", e.target.value)}
            className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="reg-year" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
            {reg.yearLabel}
          </label>
          <input
            id="reg-year"
            type="number"
            min="1900"
            max={maxYear}
            step="1"
            inputMode="numeric"
            value={data.year}
            onChange={(e) => update("year", e.target.value)}
            className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
          />
          {!yearValid && (
            <p className="mt-1 text-xs text-red-500">{reg.yearInvalidError}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="reg-serial" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
          {reg.serialLabel}
        </label>
        <input
          id="reg-serial"
          type="text"
          value={data.serialNumber}
          onChange={(e) => update("serialNumber", e.target.value)}
          className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
        />
        <p className="mt-1 text-xs text-[var(--rcb-text-muted)]">
          {reg.serialExplanation}
        </p>
      </div>

      <div>
        <label htmlFor="reg-tracker" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
          {reg.trackerIdLabel}
        </label>
        <input
          id="reg-tracker"
          type="text"
          value={data.trackerId}
          onChange={(e) => update("trackerId", e.target.value)}
          className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
        />
        <p className="mt-1 text-xs text-[var(--rcb-text-muted)]">
          {reg.trackerIdExplanation}
        </p>
      </div>

      <div>
        <label htmlFor="reg-value" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
          {reg.valueLabel}
        </label>
        <input
          id="reg-value"
          type="number"
          min="250"
          step="1"
          inputMode="numeric"
          value={data.estimatedValue}
          onChange={(e) => update("estimatedValue", e.target.value)}
          className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
        />
        {!estimatedValueWholeNumber && (
          <p className="mt-1 text-xs text-red-500">{reg.valueIntegerError}</p>
        )}
        {estimatedValueWholeNumber && !estimatedValueValid && (
          <p className="mt-1 text-xs text-red-500">{reg.valueMinError}</p>
        )}
      </div>

      <div>
        <label htmlFor="reg-description" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
          {reg.descriptionLabel}
        </label>
        <textarea
          id="reg-description"
          rows={3}
          value={data.description}
          onChange={(e) => update("description", e.target.value)}
          className="w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 py-3 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
        />
        <p className="mt-1 text-xs text-[var(--rcb-text-muted)]">
          {reg.descriptionHelper}
        </p>
      </div>

      <div className="flex items-start gap-3">
        <input
          id="reg-terms"
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => onTermsChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-[var(--rcb-border)] accent-[var(--rcb-primary)]"
        />
        <label htmlFor="reg-terms" className="text-sm text-[var(--rcb-text-body)]">
          {reg.termsCheckbox}{" "}
          <Link to={ROUTES.terms} className="text-[var(--rcb-primary)] hover:underline" target="_blank">
            &rarr;
          </Link>
        </label>
      </div>

      <Button
        onClick={onNext}
        disabled={!canContinue}
        className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      >
        {reg.continueButton}
      </Button>
    </div>
  );
}
