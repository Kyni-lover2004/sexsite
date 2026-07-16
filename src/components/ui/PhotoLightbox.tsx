"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  FolderInput,
  Loader2,
  Folder,
  Images,
} from "lucide-react";

export type LightboxPhoto = {
  id?: string;
  url: string;
  caption?: string | null;
  album_id?: string | null;
};

export type MoveDestination = {
  /** null = main profile gallery */
  id: string | null;
  label: string;
};

interface PhotoLightboxProps {
  open: boolean;
  photos: LightboxPhoto[];
  initialIndex?: number;
  onClose: () => void;
  /** Shown only when owner can reorganize photos */
  moveDestinations?: MoveDestination[];
  onMove?: (
    photoId: string,
    targetAlbumId: string | null
  ) => Promise<void> | void;
}

export function PhotoLightbox({
  open,
  photos,
  initialIndex = 0,
  onClose,
  moveDestinations,
  onMove,
}: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState("");

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (photos.length === 0) return;
    if (index >= photos.length) setIndex(photos.length - 1);
  }, [photos.length, index]);

  useEffect(() => {
    if (!open) {
      setPickerOpen(false);
      setMoveError("");
      setMoving(false);
    }
  }, [open]);

  const goNext = useCallback(() => {
    if (photos.length === 0) return;
    setIndex((i) => (i + 1) % photos.length);
    setPickerOpen(false);
    setMoveError("");
  }, [photos.length]);

  const goPrev = useCallback(() => {
    if (photos.length === 0) return;
    setIndex((i) => (i - 1 + photos.length) % photos.length);
    setPickerOpen(false);
    setMoveError("");
  }, [photos.length]);

  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (pickerOpen) {
          setPickerOpen(false);
          return;
        }
        onClose();
      }
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose, goNext, goPrev, pickerOpen]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const current = photos[index];
  const canMove =
    !!onMove &&
    !!moveDestinations &&
    moveDestinations.length > 0 &&
    !!current?.id;

  const destinations = useMemo(() => {
    if (!canMove || !current) return [];
    const curAlbum = current.album_id ?? null;
    return moveDestinations!.filter((d) => d.id !== curAlbum);
  }, [canMove, current, moveDestinations]);

  async function handleMove(targetId: string | null) {
    if (!current?.id || !onMove || moving) return;
    setMoving(true);
    setMoveError("");
    try {
      await onMove(current.id, targetId);
      setPickerOpen(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Не удалось переместить фото";
      setMoveError(msg);
    } finally {
      setMoving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md"
          onClick={onClose}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>

          {photos.length > 1 && (
            <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white/80">
              {index + 1} / {photos.length}
            </div>
          )}

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                className="absolute left-4 z-10 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Предыдущее"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                className="absolute right-4 z-10 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Следующее"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Owner actions */}
          {canMove && destinations.length > 0 && (
            <div
              className="absolute bottom-6 left-1/2 z-20 w-[min(100%-2rem,22rem)] -translate-x-1/2"
              onClick={(e) => e.stopPropagation()}
            >
              <AnimatePresence mode="wait">
                {pickerOpen ? (
                  <motion.div
                    key="picker"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="overflow-hidden rounded-2xl border border-white/15 bg-base-900/95 shadow-2xl backdrop-blur-xl"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                      <p className="text-sm font-medium text-white">
                        Переместить в…
                      </p>
                      <button
                        type="button"
                        onClick={() => setPickerOpen(false)}
                        className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                        aria-label="Закрыть выбор"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <ul className="max-h-56 overflow-y-auto py-1">
                      {destinations.map((d) => (
                        <li key={d.id ?? "main"}>
                          <button
                            type="button"
                            disabled={moving}
                            onClick={() => void handleMove(d.id)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:bg-white/10 disabled:opacity-50"
                          >
                            {d.id === null ? (
                              <Images size={16} className="shrink-0 text-gold-soft" />
                            ) : (
                              <Folder size={16} className="shrink-0 text-gold-soft" />
                            )}
                            <span className="min-w-0 flex-1 truncate">
                              {d.label}
                            </span>
                            {moving && (
                              <Loader2
                                size={14}
                                className="shrink-0 animate-spin text-white/60"
                              />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                    {moveError && (
                      <p className="border-t border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
                        {moveError}
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="btn"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="flex flex-col items-center gap-2"
                  >
                    {moveError && (
                      <p className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs text-red-200">
                        {moveError}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={moving}
                      onClick={() => {
                        setMoveError("");
                        setPickerOpen(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-50"
                    >
                      {moving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <FolderInput size={16} />
                      )}
                      Переместить в…
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <motion.div
            key={current.id ?? index}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative max-h-[85vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={current.caption ?? "Фото"}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
            {current.caption && (
              <div className="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/60 px-4 py-2 text-center text-sm text-white/80">
                {current.caption}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
