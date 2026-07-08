"use client";

/**
 * Sushi design-system primitives — warm minimal.
 * Every new surface composes these so the look stays consistent.
 * Colors/radii/shadows come from the CSS tokens in globals.css.
 */

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "brand";
type ButtonSize = "sm" | "md" | "lg";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap rounded-full " +
  "select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  // Ink-black primary — the confident default (Notion/Linear energy)
  primary: "bg-ink text-paper hover:opacity-90 active:opacity-100 shadow-soft-sm",
  // Salmon brand — reserved for the single most important AI action
  brand:
    "text-white shadow-soft-sm hover:brightness-[1.06] bg-[linear-gradient(135deg,var(--brand),#FF9466)]",
  secondary:
    "bg-surface text-ink border border-line-2 hover:bg-surface-2 shadow-soft-sm",
  ghost: "bg-transparent text-muted-ink hover:bg-[rgba(26,25,23,0.05)] hover:text-ink",
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "text-[13px] px-3.5 py-1.5",
  md: "text-[14px] px-5 py-2.5",
  lg: "text-[15px] px-6 py-3",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button className={cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)} {...props} />
  );
}

interface LinkButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  ...props
}: LinkButtonProps) {
  const external = href.startsWith("http");
  const cls = cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], "no-underline", className);
  if (external) return <a href={href} className={cls} {...props} />;
  return <Link href={href} className={cls} {...(props as Record<string, unknown>)} />;
}

// ── Card ────────────────────────────────────────────────────────────────────

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  hover?: boolean;
  inset?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, hover, inset, as, ...props },
  ref,
) {
  const Tag = (as ?? "div") as React.ElementType;
  // createElement avoids JSX ref-typing friction on the polymorphic `as` tag,
  // and lets react-dropzone attach its root ref to the card.
  return React.createElement(Tag, {
    ref,
    className: cn(
      "rounded-card border border-line bg-surface shadow-soft-sm",
      inset && "bg-surface-2 shadow-none",
      hover && "transition-shadow hover:shadow-soft",
      className,
    ),
    ...props,
  });
});

// ── Eyebrow (small uppercase label) ───────────────────────────────────────────

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("eyebrow", className)}>{children}</p>;
}

// ── Badge / Pill ──────────────────────────────────────────────────────────────

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-ink/5 text-muted-ink border-line",
  brand: "bg-brand-weak text-brand border-[color:var(--brand-weak-2)]",
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/10 text-warning border-warning/25",
  danger: "bg-danger/10 text-danger border-danger/25",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-[12px] font-medium",
        BADGE_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── Container ──────────────────────────────────────────────────────────────────

export function Container({
  children,
  className,
  size = "lg",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const max = { sm: "max-w-2xl", md: "max-w-4xl", lg: "max-w-5xl", xl: "max-w-6xl" }[size];
  return <div className={cn("mx-auto w-full px-6", max, className)}>{children}</div>;
}
