import type { ReactNode } from "react";

type Option<T extends string> = {
  value: T;
  label?: ReactNode;
};

type PillToggleGroupProps<T extends string> = {
  options: Option<T>[];
  value?: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
};

export default function PillToggleGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: PillToggleGroupProps<T>) {
  return (
    <div className="pill-group" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`pill ${active ? "active" : ""}`.trim()}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {option.label ?? option.value}
          </button>
        );
      })}
    </div>
  );
}
