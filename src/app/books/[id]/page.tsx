"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CoverField from "@/components/CoverField";
import { uploadCover } from "@/lib/uploadCover";
import ReadingDates from "@/components/ReadingDates";
import BookFormatField from "@/components/Formats";

type BookStatus = "Reading" | "Rereading" | "Read" | "Want to read";

type Book = {
  id: string;
  title: string;
  author: string;
  status: BookStatus;
  rating: number;
  genre: string | null;
  description: string | null;
  notes: string | null;
  cover_id: number | null;
  custom_cover_url: string | null;
  total_pages: number | null;
  current_page: number;
};

type BookQuote = {
  id: string;
  quote_text: string;
  attribution: string | null;
  page_number: number | null;
  created_at: string;
};

function BookDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [quotes, setQuotes] = useState<BookQuote[]>([]);
  const [quoteText, setQuoteText] = useState("");
  const [quoteAttribution, setQuoteAttribution] = useState("");
  const [quotePage, setQuotePage] = useState("");
  const [savingQuote, setSavingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editStatus, setEditStatus] = useState<BookStatus>("Want to read");
  const [editRating, setEditRating] = useState(0);
  const [editTotalPages, setEditTotalPages] = useState("");
  const [editCurrentPage, setEditCurrentPage] = useState("0");
  const [editGenre, setEditGenre] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editRemoveCover, setEditRemoveCover] = useState(false);

  function fillEditFields(loadedBook: Book) {
    setEditTitle(loadedBook.title);
    setEditAuthor(loadedBook.author);
    setEditStatus(loadedBook.status);
    setEditRating(loadedBook.rating);
    setEditTotalPages(
      loadedBook.total_pages == null ? "" : String(loadedBook.total_pages)
    );
    setEditCurrentPage(String(loadedBook.current_page ?? 0));
    setEditGenre(loadedBook.genre ?? "");
    setEditDescription(loadedBook.description ?? "");
    setEditNotes(loadedBook.notes ?? "");

    setEditCoverFile(null);
    setEditRemoveCover(false);
  }

  async function loadQuotes(bookId: string) {
    setQuoteError("");

    const { data, error: loadError } = await supabase
      .from("book_quotes")
      .select("id, quote_text, attribution, page_number, created_at")
      .eq("book_id", bookId)
      .order("created_at", { ascending: false });

    if (loadError) {
      console.error("Couldn't load quotes:", loadError.message);
      setQuoteError("We couldn't load your quotes. Please refresh the page.");
      return;
    }

    setQuotes((data ?? []) as BookQuote[]);
  }

  async function addQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!book || !quoteText.trim()) return;

    const pageText = quotePage.trim();
    const parsedPage = pageText ? Number(pageText) : null;

    if (
      parsedPage !== null &&
      (!Number.isInteger(parsedPage) || parsedPage < 1)
    ) {
      setQuoteError("Please enter a valid page number, or leave it blank.");
      return;
    }

    setSavingQuote(true);
    setQuoteError("");
    setQuoteMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (sessionError || !user) {
        setQuoteError("Please sign in again before saving a quote.");
        return;
      }

      const { data, error: insertError } = await supabase
        .from("book_quotes")
        .insert({
          book_id: book.id,
          owner_id: user.id,
          quote_text: quoteText.trim(),
          attribution: quoteAttribution.trim() || null,
          page_number: parsedPage,
        })
        .select("id, quote_text, attribution, page_number, created_at")
        .single();

      if (insertError) {
        console.error("Couldn't save quote:", insertError.message);
        setQuoteError("Your quote couldn't be saved. Please try again.");
        return;
      }

      setQuotes((current) => [data as BookQuote, ...current]);
      setQuoteText("");
      setQuoteAttribution("");
      setQuotePage("");
      setQuoteMessage("Your favourite quote has been saved!");
    } catch (saveError) {
      console.error("Couldn't save quote:", saveError);
      setQuoteError("Something went wrong while saving your quote.");
    } finally {
      setSavingQuote(false);
    }
  }

  async function saveBookEdits() {
    if (!book) return;

    const totalPagesText = editTotalPages.trim();
    const totalPages = totalPagesText === "" ? null : Number(totalPagesText);
    const currentPage = Number(editCurrentPage || 0);

    if (!editTitle.trim() || !editAuthor.trim()) {
      window.alert("Please enter both a title and an author.");
      return;
    }

    if (
      totalPages !== null &&
      (!Number.isInteger(totalPages) || totalPages < 1)
    ) {
      window.alert("Total pages must be a whole number greater than zero.");
      return;
    }

    if (!Number.isInteger(currentPage) || currentPage < 0) {
      window.alert("Current page must be zero or a positive whole number.");
      return;
    }

    if (totalPages !== null && currentPage > totalPages) {
      window.alert("Current page cannot be greater than total pages.");
      return;
    }

    setSaving(true);

        let customCoverUrl: string | null = book.custom_cover_url ?? null;

    if (editRemoveCover) customCoverUrl = null;

    if (editCoverFile) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.alert("Please sign in again before saving.");
        setSaving(false);
        return;
      }

      try {
        customCoverUrl = await uploadCover(editCoverFile, user.id);
      } catch (uploadError) {
        window.alert(
          uploadError instanceof Error
            ? uploadError.message
            : "Couldn't upload the cover."
        );
        setSaving(false);
        return;
      }
    }

    try {
      const { data, error: updateError } = await supabase
        .from("books")
        .update({
          title: editTitle.trim(),
          author: editAuthor.trim(),
          status: editStatus,
          rating: editRating,
          genre: editGenre.trim() || null,
          description: editDescription.trim() || null,
          notes: editNotes.trim() || null,
          total_pages: totalPages,
          current_page: currentPage,
          custom_cover_url: customCoverUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", book.id)
        .select(
          "id, title, author, status, rating, genre, description, notes, cover_id, custom_cover_url, total_pages, current_page"
        )
        .single();

      if (updateError) {
        console.error("Book update failed:", updateError.message);
        window.alert("Couldn't save your changes. Please try again.");
        return;
      }

      const updatedBook = data as Book;
      setBook(updatedBook);
      fillEditFields(updatedBook);
      setIsEditing(false);
    } catch (saveError) {
      console.error("Book update failed:", saveError);
      window.alert("Something went wrong while saving your book.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadBook() {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (cancelled) return;

      if (sessionError || !sessionData.session) {
        router.replace("/login");
        return;
      }

      const { data, error: bookError } = await supabase
        .from("books")
        .select(
          "id, title, author, status, rating, genre, description, notes, cover_id, custom_cover_url, total_pages, current_page"
        )
        .eq("id", params.id)
        .maybeSingle();

      if (cancelled) return;

      if (bookError) {
        setError("We couldn't load this book. Please try again.");
      } else if (!data) {
        setError("We couldn't find this book in your library.");
      } else {
        const loadedBook = data as Book;
        setBook(loadedBook);
        fillEditFields(loadedBook);
        void loadQuotes(loadedBook.id);
      }

      setLoading(false);
    }

    void loadBook();

    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8f4ec] p-8 text-[#554536]">
        Opening your book...
      </main>
    );
  }

  if (error || !book) {
    return (
      <main className="min-h-screen bg-[#f8f4ec] p-8 text-[#554536]">
        <Link href="/" className="underline">
          ← Back to The Reading Nook
        </Link>
        <p className="mt-8">{error || "Book not found."}</p>
      </main>
    );
  }

  const progress =
    book.total_pages != null && book.total_pages > 0
      ? Math.min(100, Math.round((book.current_page / book.total_pages) * 100))
      : 0;

  return (
    <main className="min-h-screen bg-[#f8f4ec] px-6 py-10 text-[#554536]">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="text-sm text-[#806b55] transition hover:text-[#4b3828]"
        >
          ← Back to my bookshelf
        </Link>

        <div className="mt-8 grid gap-8 md:grid-cols-[240px_1fr]">
          <div>
            <div className="overflow-hidden rounded-xl bg-[#e8ddcc] shadow-lg">
              {book.custom_cover_url || book.cover_id != null ? (
                <img
                  src={
                    book.custom_cover_url ??
                    `https://covers.openlibrary.org/b/id/${book.cover_id}-L.jpg`
                  }
                  alt={`Cover of ${book.title}`}
                  className="w-full object-contain"
                />
              ) : (
                <div className="flex aspect-[2/3] items-center justify-center p-6 text-center font-serif text-3xl">
                  {book.title}
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[#9b8062]">
              Your reading journal
            </p>

            <h1 className="mt-3 font-serif text-4xl leading-tight">
              {book.title}
            </h1>

            <p className="mt-3 text-lg text-[#806b55]">by {book.author}</p>

            <div className="mt-6">
              {isEditing ? (
                <form
                  className="mt-4 space-y-4 rounded-2xl border border-[#e5d8c5] bg-[#fffdf8] p-6"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveBookEdits();
                  }}
                >
                  <h2 className="font-serif text-2xl">Edit your book</h2>

                  <label className="block text-sm">
                    Title
                    <input
                      className="mt-1 w-full rounded-lg border border-[#d9cbb8] bg-white p-3"
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      required
                    />
                  </label>

                  <label className="block text-sm">
                    Author
                    <input
                      className="mt-1 w-full rounded-lg border border-[#d9cbb8] bg-white p-3"
                      value={editAuthor}
                      onChange={(event) => setEditAuthor(event.target.value)}
                      required
                    />
                  </label>

                  <label className="block text-sm">
                    Reading status
                    <select
                      className="mt-1 w-full rounded-lg border border-[#d9cbb8] bg-white p-3"
                      value={editStatus}
                      onChange={(event) =>
                        setEditStatus(event.target.value as BookStatus)
                      }
                    >
                      <option value="Want to read">Want to read</option>
                      <option value="Reading">Reading</option>
                      <option value="Rereading">Rereading</option>
                      <option value="Read">Read</option>
                    </select>
                  </label>

                  <label className="block text-sm">
                    Rating
                    <select
                      className="mt-1 w-full rounded-lg border border-[#d9cbb8] bg-white p-3"
                      value={editRating}
                      onChange={(event) =>
                        setEditRating(Number(event.target.value))
                      }
                    >
                      <option value={0}>Not rated</option>
                      {Array.from({ length: 17 }, (_, index) => {
                        const rating = 1 + index / 4;
                        const ratingLabel = rating
                          .toFixed(2)
                          .replace(/0+$/, "")
                          .replace(/\.$/, "");

                        return (
                          <option key={rating} value={rating}>
                            {ratingLabel} {rating === 1 ? "star" : "stars"}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <CoverField
                    title={editTitle || book.title}
                    customUrl={book.custom_cover_url}
                    coverId={book.cover_id}
                    file={editCoverFile}
                    remove={editRemoveCover}
                    onFileChange={setEditCoverFile}
                    onRemoveChange={setEditRemoveCover}
                  />

                  <ReadingDates bookId={book.id} editable />
                  <BookFormatField bookId={book.id} />

                  <label className="block text-sm">
                    Genre
                    </label>

                  <label className="block text-sm">
                    Genre
                    <input
                      className="mt-1 w-full rounded-lg border border-[#d9cbb8] bg-white p-3"
                      value={editGenre}
                      onChange={(event) => setEditGenre(event.target.value)}
                      placeholder="e.g. Science fiction"
                    />
                  </label>

                  <label className="block text-sm">
                    Description
                    <textarea
                      className="mt-1 w-full rounded-lg border border-[#d9cbb8] bg-white p-3"
                      rows={3}
                      value={editDescription}
                      onChange={(event) =>
                        setEditDescription(event.target.value)
                      }
                      placeholder="What is this book about?"
                    />
                  </label>

                  <label className="block text-sm">
                    My reading notes
                    <textarea
                      className="mt-1 w-full rounded-lg border border-[#d9cbb8] bg-white p-3"
                      rows={5}
                      value={editNotes}
                      onChange={(event) => setEditNotes(event.target.value)}
                      placeholder="Your thoughts, favourite moments, quotes..."
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="block text-sm">
                      Total pages
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={editTotalPages}
                        onChange={(event) =>
                          setEditTotalPages(event.target.value)
                        }
                        placeholder="e.g. 320"
                        className="mt-1 w-full rounded-lg border border-[#d9cbb8] bg-white p-3"
                      />
                    </label>

                    <label className="block text-sm">
                      Current page
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editCurrentPage}
                        onChange={(event) =>
                          setEditCurrentPage(event.target.value)
                        }
                        placeholder="e.g. 126"
                        className="mt-1 w-full rounded-lg border border-[#d9cbb8] bg-white p-3"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-full bg-[#725640] px-5 py-2 text-sm text-white disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save changes"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        fillEditFields(book);
                        setIsEditing(false);
                      }}
                      className="rounded-full border border-[#d9cbb8] px-5 py-2 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-full bg-[#725640] px-5 py-2 text-sm text-white transition hover:bg-[#5b4432]"
                >
                  Edit book
                </button>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#e8ddcc] px-4 py-2 text-sm">
                {book.status}
              </span>
              {book.genre && (
                <span className="rounded-full bg-[#e8ddcc] px-4 py-2 text-sm">
                  {book.genre}
                </span>
              )}
            </div>

            <section className="mt-8">
              <h2 className="font-serif text-xl">Your rating</h2>
              <p className="mt-2 text-xl tracking-widest text-[#b17c3f]">
                {"★".repeat(Math.max(0, Math.min(5, Math.floor(book.rating))))}
                <span className="text-[#d9cdbb]">
                  {"☆".repeat(
                    Math.max(0, 5 - Math.min(5, Math.floor(book.rating)))
                  )}
                </span>
              </p>
              <p className="mt-1 text-sm text-[#806b55]">
                {book.rating} out of 5 stars
              </p>
            </section>

            {!isEditing && (
  <section className="mt-8">
    <ReadingDates bookId={book.id} />
  </section>
)}

            <section className="mt-8">
              <h2 className="font-serif text-xl">Reading progress</h2>
              {book.total_pages != null && book.total_pages > 0 ? (
                <>
                  <div className="mt-3 flex items-center justify-between text-sm text-[#806b55]">
                    <span>
                      Page {book.current_page} of {book.total_pages}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#e8ddcc]">
                    <div
                      className="h-full rounded-full bg-[#8a9a78] transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-[#806b55]">
                  Add your page count to start tracking your progress.
                </p>
              )}
            </section>

            {book.description && (
              <section className="mt-8">
                <h2 className="font-serif text-xl">About this book</h2>
                <p className="mt-3 whitespace-pre-wrap leading-7">
                  {book.description}
                </p>
              </section>
            )}

            <section className="mt-8 rounded-2xl border border-[#e5d8c5] bg-[#fffdf8] p-6">
              <h2 className="font-serif text-xl">My reading notes</h2>
              <p className="mt-3 whitespace-pre-wrap leading-7">
                {book.notes?.trim() ||
                  "No notes yet. Your thoughts can live here."}
              </p>
            </section>

            <section className="mt-8 rounded-2xl border border-[#e5d8c5] bg-[#fffdf8] p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-[#9b8062]">
                Little things worth remembering
              </p>
              <h2 className="mt-2 font-serif text-2xl">Favourite Quotes</h2>
              <p className="mt-2 text-sm leading-6 text-[#806b55]">
                Save the words that stay with you after you close the book.
              </p>

              <form onSubmit={addQuote} className="mt-6 space-y-4">
                <label className="block text-sm">
                  Your favourite quote
                  <textarea
                    className="mt-1 w-full rounded-lg border border-[#d9cbb8] bg-white p-3"
                    rows={4}
                    value={quoteText}
                    onChange={(event) => setQuoteText(event.target.value)}
                    placeholder="Write the passage you want to remember..."
                    required
                  />
                </label>

                <label className="block text-sm">
                  Who said it? (optional)
                  <input
                    className="mt-1 w-full rounded-lg border border-[#d9cbb8] bg-white p-3"
                    value={quoteAttribution}
                    onChange={(event) =>
                      setQuoteAttribution(event.target.value)
                    }
                    placeholder="Character or author"
                  />
                </label>

                <label className="block text-sm">
                  Page number (optional)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="mt-1 w-full rounded-lg border border-[#d9cbb8] bg-white p-3"
                    value={quotePage}
                    onChange={(event) => setQuotePage(event.target.value)}
                    placeholder="e.g. 127"
                  />
                </label>

                {quoteError && (
                  <p role="alert" className="text-sm text-red-700">
                    {quoteError}
                  </p>
                )}

                {quoteMessage && (
                  <p role="status" className="text-sm text-green-800">
                    {quoteMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={savingQuote || !quoteText.trim()}
                  className="rounded-full bg-[#725640] px-5 py-2 text-sm text-white transition hover:bg-[#5b4432] disabled:opacity-50"
                >
                  {savingQuote ? "Saving quote..." : "Save favourite quote"}
                </button>
              </form>

              <div className="mt-8 space-y-4">
                {quoteError ? null : quotes.length === 0 ? (
                  <p className="text-sm italic text-[#806b55]">
                    Your favourite lines will find a home here.
                  </p>
                ) : (
                  quotes.map((quote) => (
                    <article
                      key={quote.id}
                      className="rounded-xl border border-[#eee2d1] bg-[#faf5ed] p-5"
                    >
                      <span className="font-serif text-3xl text-[#b17c3f]">
                        “
                      </span>
                      <blockquote className="whitespace-pre-wrap font-serif text-lg leading-7">
                        {quote.quote_text}
                      </blockquote>
                      {quote.attribution && (
                        <p className="mt-3 text-sm text-[#806b55]">
                          — {quote.attribution}
                        </p>
                      )}
                      {quote.page_number && (
                        <p className="mt-2 text-xs text-[#9b8062]">
                          Page {quote.page_number}
                        </p>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
export default function BookDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f8f4ec] p-8 text-[#554536]">
          Opening your book...
        </main>
      }
    >
      <BookDetailContent />
    </Suspense>
  );
}
