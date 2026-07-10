import React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  hover?: boolean;
  inset?: boolean;
  padded?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, as, hover, inset, padded = true, ...props },
  ref,
) {
  const Tag = (as ?? "div") as React.ElementType;
  return React.createElement(Tag, {
    ref,
    className: cn(
      "rounded-2xl border border-border bg-surface/95 shadow-sm",
      inset && "bg-surface-2 shadow-none",
      hover && "transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md",
      padded && "p-5",
      className,
    ),
    ...props,
  });
});

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex items-start justify-between gap-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[15px] font-semibold text-ink", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-0.5 text-[13px] text-ink-secondary", className)} {...props} />;
}
