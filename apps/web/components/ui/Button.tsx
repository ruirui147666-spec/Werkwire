import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 disabled:bg-ink-200",
  secondary: "bg-ink-900 text-white hover:bg-ink-700 disabled:bg-ink-200",
  outline: "border border-ink-200 bg-surface text-ink-900 hover:bg-surface-subtle disabled:text-ink-300",
  ghost: "bg-transparent text-ink-700 hover:bg-surface-muted disabled:text-ink-300",
  danger: "bg-danger-500 text-white hover:bg-danger-600 disabled:bg-ink-200",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-4 text-[15px] rounded-xl gap-2",
  lg: "h-14 px-6 text-base rounded-2xl gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", fullWidth, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "focus-ring inline-flex items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    />
  );
});
