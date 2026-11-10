"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const FORMATS = ["Physical copy", "Ebook", "Audiobook", "Library book", "Immersive Reading"];

const selectClass =
  "w-full rounded-xl border border-[#DCCFBD] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6F47]";

/* Controlled dropdown, for the "Add a book" form. */
export function FormatPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={selectClass}
    >
      <option value="">Not set</option>
      {FORMATS.map((format) => (
        <option key={format} value={format}>
          {format}
        </option>
      ))}
    </select>
  );
}

/* For an existing book: loads its format and saves a change straight away. */
export default function BookFormatField({ bookId }: { bookId: string }) {
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error: loadError } = await supabase
        .from("books")
        .select("format")
        .eq("id", bookId)
        .maybeSingle();

      if (cancelled) return;

      if (loadError) {
        setError("Couldn't load the format: " + loadError.message);
      } else {
        setValue((data?.format as string | null) ?? "");
      }
      setLoaded(true);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  async function change(next: string) {
    setSaving(true);
    setError("");

    const { error: updateError } = await supabase
      .from("books")
      .update({ format: next || null })
      .eq("id", bookId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setValue(next);
  }

  if (!loaded) return null;

  return (
    <div className={saving ? "opacity-60" : ""}>
      <p className="mb-1 block text-sm text-[#75634D]">Format</p>
      <select
        value={value}
        onChange={(event) => void change(event.target.value)}
        disabled={saving}
        className={selectClass}
      >
        <option value="">Not set</option>
        {FORMATS.map((format) => (
          <option key={format} value={format}>
            {format}
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

/* The stat: completed reading entries grouped by the book's reading version. */
const READING_VERSIONS = [
  "Physical copy",
  "Ebook",
  "Audiobook",
  "Library book",
  "Immersive reading",
];

export function FormatsRead() {
  const [rows, setRows] = useState<{ format: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: books, error: booksError } = await supabase
        .from("books")
        .select("id, reading_version")
        .eq("owner_id", user.id);

      const { data: readings, error: readingsError } = await supabase
        .from("book_readings")
        .select("book_id")
        .eq("owner_id", user.id)
        .not("end_date", "is", null);

      if (cancelled) return;

      if (booksError || readingsError) {
        setError("Couldn't load formats: " + (booksError ?? readingsError)?.message);
        setLoading(false);
        return;
      }

      const versionById = new Map<string, string>();
      (books ?? []).forEach((book) =>
        versionById.set(
          book.id as string,
          (book.reading_version as string | null) ?? ""
        )
      );

      const counts: Record<string, number> = {};
      for (const reading of readings ?? []) {
        const version = versionById.get(reading.book_id as string);
        if (version === undefined) continue;
        const label = version || "No version set";
        counts[label] = (counts[label] ?? 0) + 1;
      }

      const known = [...READING_VERSIONS, "No version set"];
      const extra = Object.keys(counts).filter((label) => !known.includes(label));

      const ordered = [...known, ...extra]
        .filter((label) => (counts[label] ?? 0) > 0)
        .map((label) => ({ format: label, count: counts[label] }));

      setRows(ordered);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || error) {
    return error ? (
      <p role="alert" className="mb-10 text-sm text-red-700">
        {error}
      </p>
    ) : null;
  }

  const max = Math.max(1, ...rows.map((row) => row.count));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="mb-10 rounded-2xl border border-[#E9E0D2] bg-white/60 p-5">
      <h3 className="font-serif text-xl">Formats read</h3>
      <p className="mt-1 text-sm text-[#93836F]">
        {total} finished {total === 1 ? "read" : "reads"}
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm italic text-[#93836F]">
          Finish a book with an end date and it will show up here.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.format}>
              <div className="flex justify-between text-sm">
                <span>{row.format}</span>
                <span className="text-[#93836F]">{row.count}</span>
              </div>
              <div className="mt-1 h-3 overflow-hidden rounded-full bg-[#E8DFD2]">
                <div
                  className="h-full rounded-full bg-[#8A9A78]"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}