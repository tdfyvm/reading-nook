"use client";

import { useState } from "react";

type SurveyBookHeaderProps = {
  title: string | null;
  author: string | null;
  coverId: number | null;
};

export default function SurveyBookHeader({
  title,
  author,
  coverId,
}: SurveyBookHeaderProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!title) return null;

  const showCover = coverId != null && coverId > 0 && !imageFailed;

  return (
    <div className="mb-8 flex items-center gap-5 rounded-2xl border border-[#E5D8C5] bg-[#FFFDF8] p-5">
      <div className="h-32 w-20 shrink-0 overflow-hidden rounded-lg bg-[#E8DDCC] shadow-md">
        {showCover ? (
          <img
            src={`https://covers.openlibrary.org/b/id/${coverId}-M.jpg`}
            alt={`Cover of ${title}`}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center font-serif text-sm text-[#554536]">
            {title}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#9B8062]">
          This survey is about
        </p>
        <h2 className="mt-1 font-serif text-2xl text-[#4A3B2B]">{title}</h2>
        {author && <p className="mt-1 text-[#786956]">by {author}</p>}
      </div>
    </div>
  );
}