"use client";

import { useEffect, useState } from "react";

type CoverFieldProps = {
  title: string;
  customUrl: string | null;
  coverId: number | null;
  file: File | null;
  remove: boolean;
  onFileChange: (file: File | null) => void;
  onRemoveChange: (remove: boolean) => void;
};

export default function CoverField({
  title,
  customUrl,
  coverId,
  file,
  remove,
  onFileChange,
  onRemoveChange,
}: CoverFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const automaticUrl =
    coverId != null && coverId > 0
      ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
      : null;

  const shownUrl = previewUrl
    ? previewUrl
    : remove
      ? automaticUrl
      : (customUrl ?? automaticUrl);

  const source = previewUrl
    ? "New cover (not saved yet)"
    : !remove && customUrl
      ? "Your custom cover"
      : automaticUrl
        ? "Automatic cover"
        : "No cover";

  return (
    <div className="block text-sm">
      <p className="mb-1">Cover</p>

      <div className="flex items-center gap-4 rounded-lg border border-[#d9cbb8] bg-white p-3">
        <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-[#E8DDCC] text-center text-xs text-[#554536]">
          {shownUrl ? (
            <img
              src={shownUrl}
              alt={`Cover of ${title}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="p-1">No cover</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs text-[#806b55]">{source}</p>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              onFileChange(event.target.files?.[0] ?? null);
              onRemoveChange(false);
            }}
            className="block w-full text-xs"
          />

          <div className="flex flex-wrap gap-3 text-xs">
            {file && (
              <button
                type="button"
                onClick={() => onFileChange(null)}
                className="underline"
              >
                Undo new image
              </button>
            )}

            {customUrl && !file && !remove && (
              <button
                type="button"
                onClick={() => onRemoveChange(true)}
                className="text-red-700 underline"
              >
                Remove custom cover
              </button>
            )}

            {remove && (
              <button
                type="button"
                onClick={() => onRemoveChange(false)}
                className="underline"
              >
                Keep custom cover
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}