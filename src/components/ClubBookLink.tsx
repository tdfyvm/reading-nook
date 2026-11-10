"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Option = {
  club_book_id: string;
  club_id: string;
  club_name: string;
  title: string;
  status: string;
  my_book_id: string | null;
};

export default function ClubBookLink({ bookId }: { bookId: string }) {
  const [options, setOptions] = useState<Option[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc("get_my_club_books");

    if (loadError) {
      setError("Couldn't load your book clubs: " + loadError.message);
    } else {
      setOptions((data ?? []) as Option[]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const linked = options.find((option) => option.my_book_id === bookId);

  async function change(clubBookId: string) {
    setBusy(true);
    setError("");

    // A book is linked to one club book at a time, so remove the old link first.
    if (linked) {
      const { error: unlinkError } = await supabase.rpc("unlink_club_book", {
        p_club_book_id: linked.club_book_id,
      });

      if (unlinkError) {
        setError(unlinkError.message);
        setBusy(false);
        return;
      }
    }

    if (clubBookId) {
      const { error: linkError } = await supabase.rpc("link_book_to_club_book", {
        p_club_book_id: clubBookId,
        p_book_id: bookId,
      });

      if (linkError) {
        setError(linkError.message);
      }
    }

    await load();
    setBusy(false);
  }

  if (!loaded) return null;
  if (options.length === 0 && !error) return null;

  return (
    <div className={busy ? "opacity-60" : ""}>
      <p className="mb-1 block text-sm text-[#75634D]">Book club</p>
      <select
        value={linked?.club_book_id ?? ""}
        onChange={(event) => void change(event.target.value)}
        disabled={busy}
        className="w-full rounded-xl border border-[#DCCFBD] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6F47]"
      >
        <option value="">Not linked</option>
        {options.map((option) => (
          <option key={option.club_book_id} value={option.club_book_id}>
            {option.club_name} — {option.title}
            {option.status === "current" ? " (reading now)" : " (finished)"}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}