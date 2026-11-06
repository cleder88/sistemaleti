import Link from "next/link";
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-60";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-black shadow-soft hover:bg-brandStrong",
  secondary:
    "border border-line bg-panelElevated text-inkSoft hover:bg-panelMuted hover:text-ink",
  ghost:
    "bg-transparent text-inkSoft hover:bg-white/5 hover:text-ink",
  outline:
    "border border-line bg-transparent text-inkSoft hover:border-inkMuted hover:text-ink",
  danger:
    "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/15",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-sm",
};

export function buttonClassName(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string
) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "secondary", size = "md", className, type = "button", children, ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={buttonClassName(variant, size, className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

export interface ButtonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  function ButtonLink(
    { href, variant = "secondary", size = "md", className, children, ...props },
    ref
  ) {
    return (
      <Link
        ref={ref}
        href={href}
        className={buttonClassName(variant, size, className)}
        {...props}
      >
        {children}
      </Link>
    );
  }
);
