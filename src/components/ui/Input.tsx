import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

/** Glassy text input with a restrained gold focus glow. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-gold/15 bg-base-900/60 px-3.5",
        "text-sm text-slate-100 placeholder:text-slate-500",
        "backdrop-blur transition-all duration-300",
        "focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15",
        "focus:shadow-[0_0_24px_rgba(245,213,138,0.1)]",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-gold/15 bg-base-900/60 px-3.5 py-2.5",
        "text-sm text-slate-100 placeholder:text-slate-500 backdrop-blur",
        "transition-all duration-300 resize-none",
        "focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15",
        "focus:shadow-[0_0_24px_rgba(245,213,138,0.1)]",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
