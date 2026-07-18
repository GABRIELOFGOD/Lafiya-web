"use client";

import Image from "next/image";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * Uploads directly to Supabase Storage from the browser on file select
 * (rather than routing the file through the Server Action), then hands the
 * resulting public URL to the rest of the form via a hidden input. Optional
 * — a patient can create a card with no photo.
 */
export function PhotoUploadField({
  userId,
  initialUrl,
  error: serverError,
}: {
  userId: string;
  initialUrl: string | null;
  error?: string;
}) {
  const [photoUrl, setPhotoUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const activeError = error || serverError;

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Photo must be a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Photo must be under 5 MB.");
      return;
    }

    setError(null);
    setIsUploading(true);

    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/jpeg"
          ? "jpg"
          : "webp";
    const path = `${userId}/photo.${extension}`;
    const supabase = createClient();

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      setIsUploading(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    // Cache-bust so the new photo shows immediately after an overwrite.
    setPhotoUrl(`${data.publicUrl}?updated=${Date.now()}`);
    setIsUploading(false);
  }

  return (
    <div>
      <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Photo (optional)
      </span>
      <input type="hidden" name="photoUrl" value={photoUrl ?? ""} readOnly />
      <div className="mt-2 flex items-center gap-4">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt=""
            width={64}
            height={64}
            unoptimized
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            No photo
          </div>
        )}
        <label className="cursor-pointer rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900">
          {isUploading ? "Uploading…" : photoUrl ? "Change photo" : "Add photo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            disabled={isUploading}
            aria-invalid={activeError ? "true" : undefined}
            aria-describedby={activeError ? "photoUrl-error" : undefined}
            className="hidden"
          />
        </label>
      </div>
      {activeError ? (
        <p id="photoUrl-error" role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {activeError}
        </p>
      ) : null}
    </div>
  );
}
