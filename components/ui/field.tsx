import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FieldProps {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
  hintClassName?: string;
  errorClassName?: string;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  labelClassName,
  hintClassName,
  errorClassName,
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className={cn(
            "block text-sm font-medium text-inkSoft",
            labelClassName
          )}
        >
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p
          role="alert"
          className={cn("text-xs text-danger", errorClassName)}
        >
          {error}
        </p>
      ) : hint ? (
        <p className={cn("text-xs text-inkMuted", hintClassName)}>{hint}</p>
      ) : null}
    </div>
  );
}
