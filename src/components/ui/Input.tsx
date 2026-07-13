import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

/** Glassy text input with neon focus glow. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-white/[0.08] bg-base-800/60 px-3.5",
        "text-sm text-slate-100 placeholder:text-slate-500",
        "backdrop-blur transition-all duration-300",
        "focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20",
        "focus:shadow-[0_0_20px_rgba(225,29,120,0.1)]",
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
        "w-full rounded-xl border border-white/[0.08] bg-base-800/60 px-3.5 py-2.5",
        "text-sm text-slate-100 placeholder:text-slate-500 backdrop-blur",
        "transition-all duration-300 resize-none",
        "focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20",
        "focus:shadow-[0_0_20px_rgba(225,29,120,0.1)]",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
