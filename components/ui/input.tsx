import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type InputSize = "sm" | "md" | "lg";

const inputSizes: Record<InputSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-4 py-3 text-base",
};

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: InputSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = "md",
    leftIcon,
    rightIcon,
    invalid = false,
    className,
    ...props
  },
  ref
) {
  const input = (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-control border border-line bg-panelElevated text-ink transition-colors placeholder:text-inkMuted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-panelMuted disabled:opacity-70",
        inputSizes[size],
        leftIcon && "pl-10",
        rightIcon && "pr-10",
        invalid &&
          "border-danger focus:border-danger focus:ring-danger/20",
        className
      )}
      {...props}
    />
  );

  if (!leftIcon && !rightIcon) {
    return input;
  }

  return (
    <div className="relative">
      {leftIcon ? (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-inkMuted">
          {leftIcon}
        </span>
      ) : null}
      {input}
      {rightIcon ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-inkMuted">
          {rightIcon}
        </span>
      ) : null}
    </div>
  );
});
