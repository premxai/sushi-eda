import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium select-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none",
  {
    variants: {
      variant: {
        primary: "bg-ink text-paper hover:bg-ink/90 shadow-xs",
        brand: "bg-brand text-white hover:bg-brand-hover shadow-xs",
        secondary: "bg-surface text-ink border border-border-strong hover:bg-surface-2 shadow-xs",
        ghost: "bg-transparent text-ink-secondary hover:bg-surface-2 hover:text-ink",
        danger: "bg-danger text-white hover:opacity-90 shadow-xs",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-4 text-[13.5px]",
        lg: "h-11 px-5 text-[14.5px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
