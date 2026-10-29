"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type DraftReading = { start_date: string; end_date: string | null };

type Reading = { id: string; start_date: string; end_date: string | null };

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function validatePair(start: string, end: string) {
  if (!start) {
    return "Please choose a start date.";
  }
  if (end && end < start) {
    return "The end date can't be before the start date.";
  }
  return "";
}

function ReadingLabel({ reading }: { reading: DraftReading }) {
  return (
    <span>
      {formatDate(reading.start_date)} →{" "}
      {reading.end_date ? (
        formatDate(reading.end_date)
      ) : (
        <em className="text-[#8C7D6A]">still reading</em>
      )}
    </span>
  );
}

/* Start date (required) + end date (optional) with an "Add" button.
   onAdd returns an error message, or "" on success. */
function AddPair({
  onAdd,
  busy,
}: {
  onAdd: (start: string, end: string | null) => Promise<string>;
  busy: boolean;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    const problem = validatePair(start, end);
    if (problem) {
      setError(problem);
      return;
    }

    const result = await onAdd(start, end || null);
    if (result) {
      setError(result);
      return;
    }

    setStart("");
    setEnd("");
    setError("");
  }

  // Enter adds the pair instead of submitting the surrounding form.
  function handleEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div className="rounded-xl border border-[#DCCFBD] bg-[#FDFBF7] p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs text-[#75634D]">
          Start date
          <input
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            onKeyDown={handleEnter}
            className="mt-1 w-full rounded-lg border border-[#DCCFBD] bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs text-[#75634D]">
          End date (optional)
          <input
            type="date"
            value={end}
            min={start || undefined}
            onChange={(event) => setEnd(event.target.value)}
            onKeyDown={handleEnter}
            className="mt-1 w-full rounded-lg border border-[#DCCFBD] bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>

      <p className="mt-2 text-xs text-[#8C7D6A]">
        Still reading? Leave the end date empty and add it when you finish.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {start && !error && (
        <p className="mt-2 text-xs text-[#9B6A1F]">
          Not added yet. Click &quot;+ Add reading dates&quot; to keep this.
        </p>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy}
        className={`mt-3 rounded-lg border px-3 py-2 text-sm disabled:opacity-50 ${
          start
            ? "border-[#75634D] bg-[#75634D] text-white hover:bg-[#5D4C39]"
            : "border-[#DCCFBD] text-[#75634D] hover:bg-[#F0E8DB]"
        }`}
      >
        + Add reading dates
      </button>
    </div>
  );
}

/* Shown under a reading that has no end date yet (edit mode only). */
function FinishRow({
  reading,
  busy,
  onSetEnd,
}: {
  reading: Reading;
  busy: boolean;
  onSetEnd: (reading: Reading, end: string) => Promise<string>;
}) {
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");

  async function save() {
    if (!end) {
      setError("Please choose the date you finished.");
      return;
    }
    const result = await onSetEnd(reading, end);
    if (result) setError(result);
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <label className="text-xs text-[#75634D]">
        Finished on{" "}
        <input
          type="date"
          value={end}
          min={reading.start_date}
          onChange={(event) => setEnd(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            }
          }}
          className="ml-1 rounded-lg border border-[#DCCFBD] bg-white px-2 py-1 text-xs"
        />
      </label>
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="rounded-lg border border-[#DCCFBD] px-2 py-1 text-xs text-[#75634D] hover:bg-[#F0E8DB] disabled:opacity-50"
      >
        Save end date
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}

function Heading() {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-[#9B866A]">
      Reading dates
    </p>
  );
}

/* ---------- For an existing book: shows the dates, or edits them live ---------- */

export default function ReadingDates({
  bookId,
  editable = false,
}: {
  bookId: string;
  editable?: boolean;
}) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("book_readings")
      .select("id, start_date, end_date")
      .eq("book_id", bookId)
      .order("start_date", { ascending: true });

    if (loadError) {
      setError("Couldn't load reading dates: " + loadError.message);
    } else {
      setReadings((data ?? []) as Reading[]);
    }
    setLoaded(true);
  }, [bookId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(start: string, end: string | null) {
    setBusy(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setBusy(false);
      return "Please log in again.";
    }

    const { data, error: insertError } = await supabase
      .from("book_readings")
      .insert({
        book_id: bookId,
        owner_id: user.id,
        start_date: start,
        end_date: end,
      })
      .select("id, start_date, end_date")
      .single();

    setBusy(false);

    if (insertError || !data) {
      return insertError?.message ?? "Couldn't save those dates.";
    }

    setReadings((current) =>
      [...current, data as Reading].sort((a, b) =>
        a.start_date.localeCompare(b.start_date)
      )
    );
    return "";
  }

  async function setEnd(reading: Reading, end: string) {
    if (end < reading.start_date) {
      return "The end date can't be before the start date.";
    }

    setBusy(true);
    setError("");

    const { data, error: updateError } = await supabase
      .from("book_readings")
      .update({ end_date: end })
      .eq("id", reading.id)
      .select("id, start_date, end_date")
      .single();

    setBusy(false);

    if (updateError || !data) {
      return updateError?.message ?? "Couldn't save the end date.";
    }

    setReadings((current) =>
      current.map((item) => (item.id === reading.id ? (data as Reading) : item))
    );
    return "";
  }

  async function remove(reading: Reading) {
    setBusy(true);
    setError("");

    const { error: deleteError } = await supabase
      .from("book_readings")
      .delete()
      .eq("id", reading.id);

    setBusy(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setReadings((current) => current.filter((item) => item.id !== reading.id));
  }

  if (!loaded) return null;
  if (!editable && readings.length === 0 && !error) return null;

  return (
    <div className={editable ? "space-y-3" : "mt-3"}>
      <Heading />

      {readings.length > 0 && (
        <ul className="mt-2 space-y-2">
          {readings.map((reading) => (
            <li key={reading.id} className="text-sm text-[#756B5D]">
              <div className="flex items-center justify-between gap-3">
                <ReadingLabel reading={reading} />
                {editable && (
                  <button
                    type="button"
                    onClick={() => void remove(reading)}
                    disabled={busy}
                    className="text-xs text-red-700 underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>

              {editable && !reading.end_date && (
                <FinishRow reading={reading} busy={busy} onSetEnd={setEnd} />
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && readings.length === 0 && (
        <p className="text-sm italic text-[#8C7D6A]">No reading dates yet.</p>
      )}

      {editable && <AddPair onAdd={add} busy={busy} />}

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------- For the "Add a book" form: collects pairs before the book exists ---------- */

export function ReadingDatesDraft({
  value,
  onChange,
}: {
  value: DraftReading[];
  onChange: (next: DraftReading[]) => void;
}) {
  async function add(start: string, end: string | null) {
    onChange(
      [...value, { start_date: start, end_date: end }].sort((a, b) =>
        a.start_date.localeCompare(b.start_date)
      )
    );
    return "";
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((reading, index) => (
            <li
              key={`${reading.start_date}-${reading.end_date ?? "open"}-${index}`}
              className="flex items-center justify-between gap-3 text-sm text-[#756B5D]"
            >
              <ReadingLabel reading={reading} />
              <button
                type="button"
                onClick={() =>
                  onChange(value.filter((_, itemIndex) => itemIndex !== index))
                }
                className="text-xs text-red-700 underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <AddPair onAdd={add} busy={false} />
    </div>
  );
}