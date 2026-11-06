import {
  forwardRef,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export type SelectSize = "sm" | "md" | "lg";

const selectSizes: Record<SelectSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-4 py-3 text-base",
};

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: SelectSize;
  leftIcon?: ReactNode;
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { size = "md", leftIcon, invalid = false, className, children, ...props },
    ref
  ) {
    const select = (
      <select
        ref={ref}
        className={cn(
          "w-full rounded-control border border-line bg-panelElevated text-ink transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-panelMuted disabled:opacity-70",
          selectSizes[size],
          leftIcon && "pl-10",
          invalid &&
            "border-danger focus:border-danger focus:ring-danger/20",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );

    if (!leftIcon) {
      return select;
    }

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-inkMuted">
          {leftIcon}
        </span>
        {select}
      </div>
    );
  }
);
