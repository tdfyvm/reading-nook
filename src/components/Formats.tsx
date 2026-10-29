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
export function FormatsRead() {
  const [rows, setRows] = useState<{ format: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const chartColors = [
    "#899B78",
    "#C98F9D",
    "#D7B46A",
    "#9AACC0",
    "#B7A6C9",
  ];

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        if (!cancelled) {
          setError("Couldn't identify your account: " + userError.message);
          setLoading(false);
        }
        return;
      }

      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

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
        setError(
          "Couldn't load reading versions: " +
            (booksError ?? readingsError)?.message
        );
        setLoading(false);
        return;
      }

      const versionById = new Map<string, string>();

      (books ?? []).forEach((book) => {
        const version = book.reading_version as string | null;
        if (version) versionById.set(book.id as string, version);
      });

      const counts: Record<string, number> = {};

      for (const reading of readings ?? []) {
        const version = versionById.get(reading.book_id as string);
        if (!version) continue;

        counts[version] = (counts[version] ?? 0) + 1;
      }

      const ordered = FORMATS
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

  if (loading) {
    return (
      <section className="mb-10 rounded-2xl border border-[#E9E0D2] bg-white/60 p-5">
        <p className="text-sm text-[#93836F]">Loading reading formats...</p>
      </section>
    );
  }

  if (error) {
    return (
      <p role="alert" className="mb-10 text-sm text-red-700">
        {error}
      </p>
    );
  }

  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <section className="mb-10 rounded-2xl border border-[#E9E0D2] bg-white/70 p-5 sm:p-7">
      <div className="mb-6">
        <h3 className="font-serif text-xl text-[#493D32]">Formats read</h3>
        <p className="mt-1 text-sm text-[#93836F]">
          Your reading journey, by format
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl bg-[#F8F3EB] p-4 text-sm italic text-[#93836F]">
          Finish a book with an end date and set its reading version to see your chart here.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-7 sm:flex-row sm:gap-10">
          <div className="w-full max-w-[230px] shrink-0">
            <svg
              viewBox="0 0 180 180"
              role="img"
              aria-label={`Donut chart showing ${total} finished reads by reading format`}
              className="mx-auto w-full"
            >
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="#EEE6DB"
                strokeWidth="19"
              />

              <g transform="rotate(-90 90 90)">
                {rows.map((row, index) => {
                  const length = (row.count / total) * circumference;
                  const segment = (
                    <circle
                      key={row.format}
                      cx="90"
                      cy="90"
                      r={radius}
                      fill="none"
                      stroke={chartColors[index % chartColors.length]}
                      strokeWidth="19"
                      strokeDasharray={`${Math.max(0, length - 2)} ${circumference}`}
                      strokeDashoffset={-offset}
                      strokeLinecap="round"
                    />
                  );

                  offset += length;
                  return segment;
                })}
              </g>

              <text
                x="90"
                y="85"
                textAnchor="middle"
                className="fill-[#493D32]"
                fontSize="31"
                fontWeight="600"
              >
                {total}
              </text>
              <text
                x="90"
                y="104"
                textAnchor="middle"
                className="fill-[#93836F]"
                fontSize="10"
              >
                finished reads
              </text>
            </svg>
          </div>

          <div className="w-full flex-1 space-y-4">
            {rows.map((row, index) => (
              <div key={row.format}>
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        chartColors[index % chartColors.length],
                    }}
                  />
                  <span className="min-w-0 flex-1 text-sm text-[#493D32]">
                    {row.format}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-[#493D32]">
                    {row.count}
                  </span>
                  <span className="w-10 text-right text-xs text-[#93836F]">
                    {Math.round((row.count / total) * 100)}%
                  </span>
                </div>

                <div className="ml-6 mt-2 h-1.5 overflow-hidden rounded-full bg-[#EEE6DB]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(row.count / max) * 100}%`,
                      backgroundColor:
                        chartColors[index % chartColors.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}