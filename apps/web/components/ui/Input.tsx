import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "focus-ring h-12 w-full rounded-xl border border-ink-200 bg-surface px-4 text-[15px] text-ink-900 placeholder:text-ink-300",
          className
        )}
        {...props}
      />
    );
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "focus-ring w-full rounded-xl border border-ink-200 bg-surface px-4 py-3 text-[15px] text-ink-900 placeholder:text-ink-300",
          className
        )}
        {...props}
      />
    );
  }
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-ink-700", className)} {...props} />;
}
