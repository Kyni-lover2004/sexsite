"use client";

import { ImagePlus, X } from "lucide-react";
import type { SupportAttachment } from "@/lib/types";

export function AttachmentPicker({
  files,
  onChange,
  inputId,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  inputId: string;
}) {
  return (
    <div className="space-y-2">
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onChange([...files, ...Array.from(e.target.files ?? [])]);
          e.currentTarget.value = "";
        }}
      />
      <label
        htmlFor={inputId}
        className="inline-flex h-9 max-w-full cursor-pointer items-center gap-2 rounded-lg border border-gold/25 bg-base-900/60 px-3 text-xs font-medium text-gold-soft transition-colors hover:bg-gold/10"
      >
        <ImagePlus size={14} />
        Прикрепить фото
      </label>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <span
              key={`${file.name}-${index}`}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-gold/15 bg-gold/10 px-2 py-1 text-[11px] text-gold-soft"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                aria-label="Убрать фото"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function AttachmentGallery({
  attachments,
}: {
  attachments: SupportAttachment[];
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {attachments.map((attachment) => (
        <a
          key={attachment.path}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="group block overflow-hidden rounded-lg border border-gold/10 bg-base-950/50"
        >
          <img
            src={attachment.url}
            alt={attachment.name || "Фото обращения"}
            className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </a>
      ))}
    </div>
  );
}
