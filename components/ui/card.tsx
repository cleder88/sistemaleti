import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type CardVariant = "panel" | "elevated" | "muted" | "transparent";

const cardVariants: Record<CardVariant, string> = {
  panel: "border-line bg-panel",
  elevated: "border-line bg-panelElevated",
  muted: "border-line bg-panelMuted",
  transparent: "border-transparent bg-transparent shadow-none",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padded?: boolean;
  children: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "panel", padded = true, className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-card border shadow-soft",
        cardVariants[variant],
        padded && "p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
