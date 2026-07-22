"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";

/** One chat image attachment: raw base64 (no data: prefix) + MIME type. */
export interface ChatImage {
  data: string;
  mediaType: string;
}

export const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/gif,image/webp";
const ALLOWED_TYPES = ACCEPTED_IMAGE_TYPES.split(",");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // Anthropic's per-image API limit

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

/** Validate + base64-encode a picked file. Throws Error with a user-facing message. */
export async function fileToChatImage(file: File): Promise<ChatImage> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Only PNG, JPEG, GIF, or WebP images are supported");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large (max 5MB)");
  }
  const dataUrl = await readAsDataURL(file);
  return { data: dataUrl.slice(dataUrl.indexOf(",") + 1), mediaType: file.type };
}

export function AttachImageButton({
  onSelect,
  onError,
  disabled = false,
}: {
  onSelect: (image: ChatImage) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      onSelect(await fileToChatImage(file));
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
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled}
        aria-label="Attach image"
        title="Attach image"
        className="px-3 py-3 rounded-xl border transition-colors duration-150 shrink-0 disabled:cursor-not-allowed"
        style={{ background: "#111111", borderColor: "#1f1f1f", color: disabled ? "#3f3f46" : "#71717a" }}
        onMouseEnter={(e) => {
          if (!disabled) (e.currentTarget as HTMLButtonElement).style.color = "#f59e0b";
        }}
        onMouseLeave={(e) => {
          if (!disabled) (e.currentTarget as HTMLButtonElement).style.color = "#71717a";
        }}
      >
        <Paperclip size={16} />
      </button>
    </>
  );
}

/** Thumbnail shown above the input while an attachment is staged. */
export function ImagePreview({ image, onRemove }: { image: ChatImage; onRemove: () => void }) {
  return (
    <div className="relative inline-block mb-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URI, next/image adds nothing */}
      <img
        src={`data:${image.mediaType};base64,${image.data}`}
        alt="Attachment preview"
        className="h-20 rounded-lg border object-cover"
        style={{ borderColor: "#2a2a2a" }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove image"
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center border transition-colors duration-150"
        style={{ background: "#1a1a1a", borderColor: "#2a2a2a", color: "#f5f5f5" }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

/** Image inside a chat message: 400px-max thumbnail, click to expand. */
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
        style={{ maxWidth: "400px", width: "100%", borderColor: "#2a2a2a" }}
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
