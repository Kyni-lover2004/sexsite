"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn, ZoomOut, RotateCcw, Check } from "lucide-react";
import { Button } from "./Button";

interface AvatarCropperProps {
  open: boolean;
  imageSrc: string;
  onCrop: (blob: Blob) => void;
  onClose: () => void;
}

export function AvatarCropper({ open, imageSrc, onCrop, onClose }: AvatarCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastOffset, setLastOffset] = useState({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);
  const [cropping, setCropping] = useState(false);

  const CROP_SIZE = 400;

  useEffect(() => {
    if (!open) {
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
      setImgLoaded(false);
    }
  }, [open]);

  useEffect(() => {
    if (!imageSrc || !open) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
      const minDim = Math.min(img.width, img.height);
      const initialZoom = CROP_SIZE / minDim;
      setZoom(initialZoom);
      setOffsetX(0);
      setOffsetY(0);
    };
    img.src = imageSrc;
  }, [imageSrc, open]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;

    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
    ctx.beginPath();
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    const scaledW = img.width * zoom;
    const scaledH = img.height * zoom;
    const x = (CROP_SIZE - scaledW) / 2 + offsetX;
    const y = (CROP_SIZE - scaledH) / 2 + offsetY;

    ctx.drawImage(img, x, y, scaledW, scaledH);
  }, [zoom, offsetX, offsetY, imgLoaded]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  function handlePointerDown(e: React.PointerEvent) {
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setLastOffset({ x: offsetX, y: offsetY });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setOffsetX(lastOffset.x + dx);
    setOffsetY(lastOffset.y + dy);
  }

  function handlePointerUp() {
    setDragging(false);
  }

  function handleZoomIn() {
    setZoom((z) => Math.min(z * 1.2, 8));
  }

  function handleZoomOut() {
    setZoom((z) => Math.max(z / 1.2, 0.3));
  }

  function handleReset() {
    if (!imgRef.current) return;
    const minDim = Math.min(imgRef.current.width, imgRef.current.height);
    setZoom(CROP_SIZE / minDim);
    setOffsetX(0);
    setOffsetY(0);
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(Math.max(z * delta, 0.3), 8));
  }

  async function handleCrop() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setCropping(true);

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to create blob"));
          },
          "image/jpeg",
          0.92
        );
      });
      onCrop(blob);
    } catch {
      console.error("Crop failed");
    }
    setCropping(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-md rounded-2xl border border-gold/15 bg-base-900/95 p-6 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">
                Обрезать аватар
              </h3>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mb-3 text-xs text-slate-500">
              Перетаскивайте фото и используйте колёсико мыши для масштабирования
            </p>

            <div
              ref={containerRef}
              className="relative mx-auto mb-4 overflow-hidden rounded-full border-2 border-gold/30 bg-base-950"
              style={{ width: CROP_SIZE / 2, height: CROP_SIZE / 2 }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
            >
              <canvas
                ref={canvasRef}
                style={{ width: "100%", height: "100%", cursor: dragging ? "grabbing" : "grab" }}
              />
            </div>

            <div className="mb-4 flex items-center justify-center gap-2">
              <button
                onClick={handleZoomOut}
                className="grid h-9 w-9 place-items-center rounded-lg border border-gold/15 bg-base-800/60 text-slate-300 hover:bg-gold/10 hover:text-white transition-colors"
                title="Уменьшить"
              >
                <ZoomOut size={16} />
              </button>

              <div className="w-24">
                <input
                  type="range"
                  min={30}
                  max={800}
                  value={Math.round(zoom * 100)}
                  onChange={(e) => setZoom(Number(e.target.value) / 100)}
                  className="w-full accent-gold"
                />
              </div>

              <button
                onClick={handleZoomIn}
                className="grid h-9 w-9 place-items-center rounded-lg border border-gold/15 bg-base-800/60 text-slate-300 hover:bg-gold/10 hover:text-white transition-colors"
                title="Увеличить"
              >
                <ZoomIn size={16} />
              </button>

              <button
                onClick={handleReset}
                className="grid h-9 w-9 place-items-center rounded-lg border border-gold/15 bg-base-800/60 text-slate-300 hover:bg-gold/10 hover:text-white transition-colors"
                title="Сбросить"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={handleCrop}
                disabled={cropping || !imgLoaded}
                className="flex-1"
              >
                <Check size={14} />
                {cropping ? "Обработка…" : "Применить"}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Отмена
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
