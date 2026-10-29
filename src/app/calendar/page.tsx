"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CalBook = {
  id: string;
  title: string;
  cover_id: number | null;
  custom_cover_url: string | null;
};

type Entry = { id: string; book_id: string; end_date: string };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function coverUrl(book: CalBook) {
  if (book.custom_cover_url) return book.custom_cover_url;
  if (book.cover_id != null && book.cover_id > 0) {
    return `https://covers.openlibrary.org/b/id/${book.cover_id}-M.jpg`;
  }
  return null;
}

function Tile({ book }: { book: CalBook }) {
  const src = coverUrl(book);

  return (
    <Link
      href={`/books/${book.id}`}
      title={book.title}
      className="block h-full w-full overflow-hidden rounded bg-[#E8DDCC]"
    >
      {src ? (
        <img
          src={src}
          alt={`Cover of ${book.title}`}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full items-center justify-center p-1 text-center text-[10px] leading-tight text-[#554536]">
          {book.title}
        </span>
      )}
    </Link>
  );
}

function CalendarContent() {
  const router = useRouter();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [books, setBooks] = useState<CalBook[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [bookQuery, setBookQuery] = useState("");
  const [chosenBookId, setChosenBookId] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const { data: bookData, error: bookError } = await supabase
        .from("books")
        .select("id, title, cover_id, custom_cover_url")
        .eq("owner_id", user.id)
        .order("title", { ascending: true });

      const { data: readingData, error: readingError } = await supabase
        .from("book_readings")
        .select("id, book_id, end_date")
        .eq("owner_id", user.id)
        .not("end_date", "is", null);

      if (cancelled) return;

      if (bookError || readingError) {
        setError(
          "Couldn't load your calendar: " +
            (bookError?.message ?? readingError?.message)
        );
      } else {
        setBooks((bookData ?? []) as CalBook[]);
        setEntries((readingData ?? []) as Entry[]);
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const booksById = useMemo(() => {
    const map = new Map<string, CalBook>();
    books.forEach((book) => map.set(book.id, book));
    return map;
  }, [books]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalBook[]>();

    for (const entry of entries) {
      const book = booksById.get(entry.book_id);
      if (!book) continue;

      const list = map.get(entry.end_date) ?? [];
      if (!list.some((item) => item.id === book.id)) list.push(book);
      map.set(entry.end_date, list);
    }

    return map;
  }, [entries, booksById]);

  const finishedThisYear = useMemo(() => {
    const ids = new Set<string>();
    entries.forEach((entry) => {
      if (entry.end_date.startsWith(`${year}-`)) ids.add(entry.book_id);
    });
    return ids.size;
  }, [entries, year]);

  const filteredChoices = useMemo(() => {
    const query = bookQuery.trim().toLowerCase();
    return books.filter((book) => book.title.toLowerCase().includes(query));
  }, [books, bookQuery]);

  function openDay(day: string) {
    setSelectedDay(day);
    setBookQuery("");
    setChosenBookId("");
    setModalError("");
  }

  async function addBookToDay() {
    if (!selectedDay || !userId || saving) return;

    if (!chosenBookId) {
      setModalError("Please choose a book.");
      return;
    }

    const already = (entriesByDate.get(selectedDay) ?? []).some(
      (book) => book.id === chosenBookId
    );

    if (already) {
      setModalError("That book is already on this day.");
      return;
    }

    setSaving(true);
    setModalError("");

    const { data, error: insertError } = await supabase
      .from("book_readings")
      .insert({
        book_id: chosenBookId,
        owner_id: userId,
        start_date: selectedDay,
        end_date: selectedDay,
      })
      .select("id, book_id, end_date")
      .single();

    setSaving(false);

    if (insertError || !data) {
      setModalError(insertError?.message ?? "Couldn't save that.");
      return;
    }

    setEntries((current) => [...current, data as Entry]);
    setSelectedDay(null);
  }

  function jumpToCurrentMonth() {
    setYear(today.getFullYear());
    setTimeout(() => {
      document
        .getElementById(`month-${today.getMonth()}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <main className="min-h-screen bg-[#F8F5EE] px-4 py-10 text-[#453B32] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="text-sm text-[#806b55] transition hover:text-[#4b3828]"
        >
          ← Back to my bookshelf
        </Link>

        <header className="mb-8 mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.2em] text-[#9B866A]">
              The Reading Nook
            </p>
            <h1 className="font-serif text-4xl">My reading calendar</h1>
            <p className="mt-2 text-sm text-[#8C7D6A]">
              {finishedThisYear}{" "}
              {finishedThisYear === 1 ? "book" : "books"} finished in {year}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setYear((current) => current - 1)}
              className="rounded-full border border-[#D8CCBA] px-4 py-2 text-sm hover:bg-[#EEE6D9]"
            >
              ← {year - 1}
            </button>
            <span className="px-2 font-serif text-xl">{year}</span>
            <button
              type="button"
              onClick={() => setYear((current) => current + 1)}
              className="rounded-full border border-[#D8CCBA] px-4 py-2 text-sm hover:bg-[#EEE6D9]"
            >
              {year + 1} →
            </button>
            <button
              type="button"
              onClick={jumpToCurrentMonth}
              className="rounded-full bg-[#75634D] px-4 py-2 text-sm text-white hover:bg-[#5D4C39]"
            >
              Today
            </button>
          </div>
        </header>

        {loading ? (
          <p>Opening your calendar...</p>
        ) : error ? (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        ) : (
          <div className="space-y-12">
            {MONTHS.map((monthName, month) => {
              const offset = (new Date(year, month, 1).getDay() + 6) % 7;
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const cells: (number | null)[] = [
                ...Array.from({ length: offset }, () => null),
                ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
              ];

              return (
                <section key={monthName} id={`month-${month}`} className="scroll-mt-6">
                  <h2 className="mb-3 font-serif text-2xl">
                    {monthName} {year}
                  </h2>

                  <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {WEEKDAYS.map((weekday) => (
                      <div
                        key={weekday}
                        className="pb-1 text-center text-xs font-medium uppercase tracking-wider text-[#A0917D]"
                      >
                        {weekday}
                      </div>
                    ))}

                    {cells.map((day, index) => {
                      if (day === null) return <div key={`blank-${index}`} />;

                      const key = dateKey(year, month, day);
                      const dayBooks = entriesByDate.get(key) ?? [];
                      const isToday = key === todayKey;

                      return (
                        <div
                          key={key}
                          className={`relative flex aspect-[3/4] flex-col overflow-hidden rounded-lg border p-1 ${
                            isToday
                              ? "border-[#75634D] bg-[#F0E8DB]"
                              : "border-[#E9E0D2] bg-white/60"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-[11px] text-[#8C7D6A]">{day}</span>
                            <button
                              type="button"
                              onClick={() => openDay(key)}
                              aria-label={`Add a book on ${key}`}
                              title="Add a book"
                              className="rounded px-1 text-sm leading-none text-[#9B866A] hover:bg-[#E3D8C5]"
                            >
                              +
                            </button>
                          </div>

                          {dayBooks.length > 0 && (
                            <div
                              className={`mt-1 min-h-0 flex-1 gap-1 ${
                                dayBooks.length === 1
                                  ? "grid grid-cols-1"
                                  : "grid grid-cols-2"
                              }`}
                            >
                              {dayBooks.slice(0, 4).map((book) => (
                                <Tile key={book.id} book={book} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-[#FFFDF8] p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="font-serif text-2xl">Finished a book on {selectedDay}</h3>

            <input
              value={bookQuery}
              onChange={(event) => setBookQuery(event.target.value)}
              placeholder="Search your books..."
              className="mt-4 w-full rounded-xl border border-[#DCCFBD] px-4 py-3 outline-none focus:border-[#8B6F47]"
            />

            <select
              value={chosenBookId}
              onChange={(event) => setChosenBookId(event.target.value)}
              size={6}
              className="mt-3 w-full rounded-xl border border-[#DCCFBD] bg-white p-2 text-sm"
            >
              {filteredChoices.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>

            {filteredChoices.length === 0 && (
              <p className="mt-2 text-sm text-[#8C7D6A]">No books found.</p>
            )}

            {modalError && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {modalError}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void addBookToDay()}
                disabled={saving}
                className="rounded-full bg-[#75634D] px-5 py-2 text-sm text-white hover:bg-[#5D4C39] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Add to calendar"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="rounded-full border border-[#D8CCBA] px-5 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
        </div>
    </div>
    )}
    </main>
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F8F5EE] p-8 text-[#453B32]">
          Opening your calendar...
        </main>
      }
    >
      <CalendarContent />
    </Suspense>
  );
}