"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";

/** One chat image attachment: raw base64 (no data: prefix) + MIME type. */
export interface ChatImage {
  data: string;
  mediaType: string;
  /** Size in bytes after client-side compression, shown in the staging preview. */
  compressedSize?: number;
}

export const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/gif,image/webp";
const ALLOWED_TYPES = ACCEPTED_IMAGE_TYPES.split(",");
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // pre-compression cap on the picked file
const MAX_IMAGES_PER_MESSAGE = 4;
const COMPRESS_MAX_DIMENSION = 1200;
const COMPRESS_QUALITY = 0.85;

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}

/** Resize to fit within COMPRESS_MAX_DIMENSION and re-encode as JPEG.
 *  GIFs are skipped (canvas export would freeze them on one frame). */
async function compressImage(file: File): Promise<{ dataUrl: string; mediaType: string; bytes: number }> {
  if (file.type === "image/gif") {
    const dataUrl = await readAsDataURL(file);
    return { dataUrl, mediaType: file.type, bytes: file.size };
  }
  const original = await readAsDataURL(file);
  const img = await loadImage(original);
  const scale = Math.min(1, COMPRESS_MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { dataUrl: original, mediaType: file.type, bytes: file.size };
  }
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", COMPRESS_QUALITY);
  const bytes = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
  return { dataUrl, mediaType: "image/jpeg", bytes };
}

/** Validate + compress + base64-encode a picked file. Throws Error with a
 *  user-facing message. */
export async function fileToChatImage(file: File): Promise<ChatImage> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Only PNG, JPEG, GIF, or WebP images are supported");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Image is too large (max 10MB)");
  }
  const { dataUrl, mediaType, bytes } = await compressImage(file);
  return {
    data: dataUrl.slice(dataUrl.indexOf(",") + 1),
    mediaType,
    compressedSize: bytes,
  };
}

/** Image files from a drop event, filtered to accepted types. */
export function imageFilesFromDrop(e: React.DragEvent): File[] {
  return Array.from(e.dataTransfer.files ?? []).filter((f) => ALLOWED_TYPES.includes(f.type));
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}

export function AttachImageButton({
  onSelect,
  onError,
  disabled = false,
  remainingSlots = MAX_IMAGES_PER_MESSAGE,
}: {
  onSelect: (images: ChatImage[]) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  /** How many more images can be staged for this message. */
  remainingSlots?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    const picked = Array.from(files ?? []).slice(0, Math.max(0, remainingSlots));
    if (picked.length === 0) return;
    try {
      const images = await Promise.all(picked.map(fileToChatImage));
      onSelect(images);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not attach image");
    }
    // Allow re-picking the same file after removing it.
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled || remainingSlots <= 0}
        aria-label="Attach image"
        title={remainingSlots <= 0 ? `Max ${MAX_IMAGES_PER_MESSAGE} images per message` : "Attach image"}
        className="px-3 py-3 rounded-xl border transition-colors duration-150 shrink-0 disabled:cursor-not-allowed"
        style={{ background: "#111111", borderColor: "#1f1f1f", color: disabled || remainingSlots <= 0 ? "#3f3f46" : "#71717a" }}
        onMouseEnter={(e) => {
          if (!disabled && remainingSlots > 0) (e.currentTarget as HTMLButtonElement).style.color = "#f59e0b";
        }}
        onMouseLeave={(e) => {
          if (!disabled && remainingSlots > 0) (e.currentTarget as HTMLButtonElement).style.color = "#71717a";
        }}
      >
        <Paperclip size={16} />
      </button>
    </>
  );
}

/** Row of thumbnails for images staged in the compose box, each removable. */
export function ImagePreviewRow({
  images,
  onRemove,
}: {
  images: ChatImage[];
  onRemove: (index: number) => void;
}) {
  if (images.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {images.map((image, index) => (
        <div key={index} className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URI, next/image adds nothing */}
          <img
            src={`data:${image.mediaType};base64,${image.data}`}
            alt="Attachment preview"
            className="h-20 rounded-lg border object-cover"
            style={{ borderColor: "#2a2a2a" }}
          />
          {image.compressedSize !== undefined && (
            <div
              className="absolute bottom-0.5 left-0.5 right-0.5 text-center text-[9px] px-1 py-0.5 rounded"
              style={{ background: "rgba(0,0,0,0.7)", color: "#e4e4e7" }}
            >
              Compressed to {formatSize(image.compressedSize)}
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label="Remove image"
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center border transition-colors duration-150"
            style={{ background: "#1a1a1a", borderColor: "#2a2a2a", color: "#f5f5f5" }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Image inside a chat message: 240px-max thumbnail, click to expand. */
export default function ImageAttachment({
  data,
  mediaType,
}: {
  data: string;
  mediaType: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const src = `data:${mediaType};base64,${data}`;

  useEffect(() => {
    if (!expanded) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URI, next/image adds nothing */}
      <img
        src={src}
        alt="Attached image"
        onClick={() => setExpanded(true)}
        className="rounded-lg mb-2 cursor-zoom-in border"
        style={{ maxWidth: "240px", width: "100%", borderColor: "#2a2a2a" }}
      />
      {expanded && (
        <div
          className="modal-overlay fixed inset-0 z-40 flex items-center justify-center p-8 cursor-zoom-out"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setExpanded(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URI, next/image adds nothing */}
          <img src={src} alt="Attached image (full size)" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </>
  );
}

/** Renders every image attached to a message, in order. */
export function ImageAttachmentGroup({
  images,
}: {
  images: { data: string; mediaType: string }[];
}) {
  if (images.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {images.map((image, index) => (
        <ImageAttachment key={index} data={image.data} mediaType={image.mediaType} />
      ))}
    </div>
  );
}

export { MAX_IMAGES_PER_MESSAGE };
