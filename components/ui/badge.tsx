import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger";

export type BadgeSize = "sm" | "md";

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: "border-line bg-panelMuted text-inkSoft",
  brand: "border-brand/30 bg-brand/10 text-brand",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

const badgeSizes: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = "neutral", size = "md", dot = false, className, children, ...props },
  ref
) {
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border font-semibold",
        badgeVariants[variant],
        badgeSizes[size],
        className
      )}
      {...props}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
});
