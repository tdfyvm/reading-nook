"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ClubBook = {
  id: string;
  title: string;
  author: string | null;
  cover_id: number | null;
  status: "current" | "finished";
  started_on: string;
  finished_on: string | null;
  my_book_id: string | null;
};

type MyBook = { id: string; title: string; author: string };

type ReviewQuestion = {
  id: string;
  club_book_id: string;
  question: string;
  position: number;
};

type SearchResult = {
  key: string;
  title: string;
  author: string | null;
  cover_id: number | null;
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Cover({
  title,
  coverId,
  className,
}: {
  title: string;
  coverId: number | null;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  if (coverId == null || coverId <= 0 || failed) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-[#E8DDCC] p-2 text-center font-serif text-xs text-[#554536]`}
      >
        {title}
      </div>
    );
  }

  return (
    <img
      src={`https://covers.openlibrary.org/b/id/${coverId}-M.jpg`}
      alt={`Cover of ${title}`}
      referrerPolicy="no-referrer"
      className={`${className} object-cover`}
      onError={() => setFailed(true)}
    />
  );
}

function MemberActions({
  book,
  myBooks,
  busy,
  onAdd,
  onLink,
  onUnlink,
}: {
  book: ClubBook;
  myBooks: MyBook[];
  busy: boolean;
  onAdd: () => void;
  onLink: (bookId: string) => void;
  onUnlink: () => void;
}) {
  const [choice, setChoice] = useState("");
  const linked = myBooks.find((item) => item.id === book.my_book_id);

  if (book.my_book_id) {
    return (
      <div className="mt-3 text-sm">
        <span className="text-[#65795A]">✓ In your library</span>
        {linked && (
          <>
            {" "}
            <Link href={`/books/${linked.id}`} className="underline">
              Open
            </Link>
          </>
        )}{" "}
        <button
          type="button"
          onClick={onUnlink}
          disabled={busy}
          className="text-xs text-red-700 underline disabled:opacity-50"
        >
          Unlink
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={onAdd}
        disabled={busy}
        className="rounded-full bg-[#65795A] px-4 py-2 text-sm text-white hover:bg-[#536849] disabled:opacity-50"
      >
        Add to my library
      </button>

      {myBooks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            className="max-w-xs rounded-xl border border-[#DCCFBD] bg-white px-3 py-2 text-sm"
          >
            <option value="">Link a book I already own...</option>
            {myBooks.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} — {item.author}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => choice && onLink(choice)}
            disabled={busy || !choice}
            className="rounded-full border border-[#D8CCBA] px-4 py-2 text-sm disabled:opacity-50"
          >
            Link
          </button>
        </div>
      )}
    </div>
  );
}

export default function ClubBooks({
  clubId,
  isOwner,
}: {
  clubId: string;
  isOwner: boolean;
}) {
  const [books, setBooks] = useState<ClubBook[]>([]);
  const [myBooks, setMyBooks] = useState<MyBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [reviewQuestions, setReviewQuestions] = useState<ReviewQuestion[]>([]);
  const [newReviewQuestion, setNewReviewQuestion] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState("");

  const [selectedReviewBookId, setSelectedReviewBookId] = useState<string | null>(null);

  const [editingStartDate, setEditingStartDate] = useState(false);
  const [startDateDraft, setStartDateDraft] = useState("");

  const [editingFinishDate, setEditingFinishDate] = useState(false);
  const [finishDateDraft, setFinishDateDraft] = useState("");

  const [showSetter, setShowSetter] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc("get_club_books", {
      p_club_id: clubId,
    });

    if (loadError) {
      setError("Couldn't load the club's books: " + loadError.message);
      setLoading(false);
      return;
    }

    setBooks((data ?? []) as ClubBook[]);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: mine } = await supabase
        .from("books")
        .select("id, title, author")
        .eq("owner_id", user.id)
        .order("title", { ascending: true });

      setMyBooks((mine ?? []) as MyBook[]);
    }

    setLoading(false);
  }, [clubId]);

  useEffect(() => {
  void load();

  async function loadAllReviewQuestions() {
    const { data, error } = await supabase
      .from("club_books")
      .select("id")
      .eq("club_id", clubId)
      .eq("status", "finished");

    if (error) {
      setError("Couldn't load previous books: " + error.message);
      return;
    }

    for (const book of data ?? []) {
      await loadReviewQuestions(book.id);
    }
  }

  void loadAllReviewQuestions();
}, [load, clubId]);

  async function loadReviewQuestions(clubBookId: string) {
    const { data, error: questionsError } = await supabase.rpc(
    "get_book_review_questions",
    { p_club_book_id: clubBookId }
  );

  if (questionsError) {
    setError("Couldn't load review questions: " + questionsError.message);
    return;
  }

  setReviewQuestions((previous) => [
  ...previous.filter((question) => question.club_book_id !== clubBookId),
  ...((data ?? []) as ReviewQuestion[]),
]);
  }

  async function saveReviewQuestion(
  clubBookId: string,
  questionId: string | null,
  question: string,
  position: number
) {
  if (busy || !question.trim()) return;

  setBusy(true);
  setError("");
  setMessage("");

  const { error: saveError } = await supabase.rpc(
    "save_book_review_question",
    {
      p_club_book_id: clubBookId,
      p_question_id: questionId,
      p_question: question.trim(),
      p_position: position,
    }
  );

  setBusy(false);

  if (saveError) {
    setError(saveError.message);
    return;
  }

  setNewReviewQuestion("");
  setEditingQuestionId(null);
  setEditingQuestionText("");
  setMessage("Review question saved.");

  await loadReviewQuestions(clubBookId);
 }

 async function deleteReviewQuestion(
  questionId: string,
  clubBookId: string
) {
  if (busy) return;

  if (!window.confirm("Delete this review question?")) return;

  setBusy(true);
  setError("");
  setMessage("");

  const { error: deleteError } = await supabase.rpc(
    "delete_book_review_question",
    {
      p_question_id: questionId,
    }
  );

  setBusy(false);

  if (deleteError) {
    setError(deleteError.message);
    return;
  }

  setMessage("Review question deleted.");
  await loadReviewQuestions(clubBookId);
}

  async function run(
    action: () => PromiseLike<{ error: { message: string } | null }>,
    done: string
  ) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setMessage("");

    const { error: actionError } = await action();

    setBusy(false);

    if (actionError) {
      setError(actionError.message);
      return false;
    }

    setMessage(done);
    await load();
    return true;
  }

  async function search() {
    const text = query.trim();
    if (!text) return;

    setSearching(true);
    setSearched(false);
    setError("");

    try {
      const params = new URLSearchParams({
        q: text,
        fields: "key,title,author_name,cover_i",
        limit: "8",
      });

      const response = await fetch(
        `https://openlibrary.org/search.json?${params.toString()}`
      );

      if (!response.ok) throw new Error("Search failed");

      const json: {
        docs?: {
          key: string;
          title?: string;
          author_name?: string[];
          cover_i?: number;
        }[];
      } = await response.json();

      setResults(
        (json.docs ?? [])
          .filter((doc) => doc.title)
          .map((doc) => ({
            key: doc.key,
            title: doc.title as string,
            author: doc.author_name?.[0] ?? null,
            cover_id: doc.cover_i ?? null,
          }))
      );
      setSearched(true);
    } catch {
      setError("Couldn't search right now. Please try again in a moment.");
    } finally {
      setSearching(false);
    }
  }

  async function saveStartDate() {
  if (!current || !startDateDraft || busy) return;

  setBusy(true);
  setError("");
  setMessage("");

  const { error: updateError } = await supabase.rpc(
    "update_club_book_start_date",
    {
      p_club_book_id: current.id,
      p_started_on: startDateDraft,
    }
  );

  setBusy(false);

  if (updateError) {
    setError(updateError.message);
    return;
  }

  setEditingStartDate(false);
  setMessage("Reading start date updated.");
  await load();
 }

  async function saveFinishDate() {
  if (!current || !finishDateDraft || busy) return;

  setBusy(true);
  setError("");
  setMessage("");

  const { error: updateError } = await supabase.rpc(
    "update_club_book_finish_date",
    {
      p_club_book_id: current.id,
      p_finished_on: finishDateDraft,
    }
  );

  setBusy(false);

  if (updateError) {
    setError(updateError.message);
    return;
  }

  setEditingFinishDate(false);
  setMessage("Planned finish date updated.");
  await load();
 }

  async function setClubBook(result: SearchResult) {
    const ok = await run(
      () =>
        supabase.rpc("set_club_book", {
          p_club_id: clubId,
          p_title: result.title,
          p_author: result.author,
          p_cover_id: result.cover_id,
        }),
      "The club's book has been updated."
    );

    if (ok) {
      setShowSetter(false);
      setQuery("");
      setResults([]);
      setSearched(false);
    }
  }

  const current = books.find((book) => book.status === "current");
  const previous = books.filter((book) => book.status === "finished");

  function questionsFor(clubBookId: string) {
    return reviewQuestions.filter(
      (question) => question.club_book_id === clubBookId
    );
  }
  
  function actionsFor(book: ClubBook) {
    return (
      <MemberActions
        book={book}
        myBooks={myBooks}
        busy={busy}
        onAdd={() =>
          void run(
            () => supabase.rpc("add_club_book_to_library", { p_club_book_id: book.id }),
            "Added to your library and linked."
          )
        }
        onLink={(bookId) =>
          void run(
            () =>
              supabase.rpc("link_book_to_club_book", {
                p_club_book_id: book.id,
                p_book_id: bookId,
              }),
            "Linked to your library book."
          )
        }
        onUnlink={() =>
          void run(
            () => supabase.rpc("unlink_club_book", { p_club_book_id: book.id }),
            "Link removed."
          )
        }
      />
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-[#E4D9C8] bg-white/80 p-6">
      <h2 className="font-serif text-2xl">Currently reading</h2>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-green-800">
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-sm">Loading...</p>
      ) : current ? (
        <div className="mt-5 flex flex-wrap gap-5">
          <Cover
            title={current.title}
            coverId={current.cover_id}
            className="h-48 w-32 shrink-0 rounded-lg shadow-md"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-2xl">{current.title}</h3>
            {current.author && (
              <p className="mt-1 text-[#75634D]">by {current.author}</p>
            )}
            <p className="mt-1 text-xs text-[#8C7D6A]">
  Started {formatDate(current.started_on)}
</p>

{isOwner && (
  <div className="mt-2">
    {!editingStartDate ? (
      <button
        type="button"
        onClick={() => {
          setStartDateDraft(current.started_on);
          setEditingStartDate(true);
        }}
        className="text-xs underline"
      >
        Change start date
      </button>
    ) : (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={startDateDraft}
          onChange={(event) => setStartDateDraft(event.target.value)}
          className="rounded-lg border border-[#E4D9C8] bg-white px-3 py-2 text-sm"
        />

        <button
          type="button"
          onClick={() => void saveStartDate()}
          disabled={busy || !startDateDraft}
          className="rounded-lg bg-[#6B705C] px-3 py-2 text-xs text-white disabled:opacity-50"
        >
          Save date
        </button>

        <button
          type="button"
          onClick={() => setEditingStartDate(false)}
          className="px-2 py-2 text-xs underline"
        >
          Cancel
        </button>
      </div>
    )}
  </div>
)}

<p className="mt-1 text-xs text-[#8C7D6A]">
  Finishes {current.finished_on ? formatDate(current.finished_on) : "Not set"}
</p>

{isOwner && (
  <div className="mt-2">
    {!editingFinishDate ? (
      <button
        type="button"
        onClick={() => {
          setFinishDateDraft(current.finished_on ?? "");
          setEditingFinishDate(true);
        }}
        className="text-xs underline"
      >
        Change finish date
      </button>
    ) : (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={finishDateDraft}
          onChange={(event) => setFinishDateDraft(event.target.value)}
          className="rounded-lg border border-[#E4D9C8] bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void saveFinishDate()}
          disabled={busy || !finishDateDraft}
          className="rounded-lg bg-[#6B705C] px-3 py-2 text-xs text-white disabled:opacity-50"
        >
          Save date
        </button>
        <button
          type="button"
          onClick={() => setEditingFinishDate(false)}
          className="px-2 py-2 text-xs underline"
        >
          Cancel
        </button>
      </div>
    )}
  </div>
)}

            {actionsFor(current)}

            {isOwner && (
              <div className="mt-4 flex gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Mark this book as finished?")) {
                      void run(
                        () =>
                          supabase.rpc("finish_club_book", {
                            p_club_book_id: current.id,
                          }),
                        "Marked as finished."
                      );
                    }
                  }}
                  disabled={busy}
                  className="underline disabled:opacity-50"
                >
                  Mark as finished
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm italic text-[#8C7D6A]">
          The club isn&apos;t reading a book right now.
        </p>
      )}

      {isOwner && (
        <div className="mt-5">
          {!showSetter ? (
            <button
              type="button"
              onClick={() => setShowSetter(true)}
              className="rounded-full border border-[#D8CCBA] px-5 py-2 text-sm hover:bg-[#EEE6D9]"
            >
              {current ? "Choose a new book" : "+ Choose the club's book"}
            </button>
          ) : (
            <div className="rounded-xl border border-[#EEE2D1] bg-[#FAF5ED] p-4">
              {current && (
                <p className="mb-3 text-xs text-[#8C7D6A]">
                  The current book moves to &quot;Previously read&quot;.
                </p>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void search();
                    }
                  }}
                  placeholder="Search by title or author..."
                  className="w-full rounded-xl border border-[#DCCFBD] bg-white px-4 py-3 outline-none focus:border-[#8B6F47]"
                />
                <button
                  type="button"
                  onClick={() => void search()}
                  disabled={searching || !query.trim()}
                  className="rounded-xl bg-[#65795A] px-5 py-3 text-white disabled:opacity-50"
                >
                  {searching ? "Searching..." : "Search"}
                </button>
              </div>

              {searched && results.length === 0 && (
                <p className="mt-3 text-sm text-[#786956]">
                  No books found. Try a different title or author.
                </p>
              )}

              {results.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {results.map((result) => (
                    <li
                      key={result.key}
                      className="flex items-center gap-3 rounded-xl border border-[#EEE2D1] bg-white p-3"
                    >
                      <Cover
                        title={result.title}
                        coverId={result.cover_id}
                        className="h-16 w-11 shrink-0 rounded"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{result.title}</p>
                        {result.author && (
                          <p className="truncate text-sm text-[#786956]">
                            {result.author}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void setClubBook(result)}
                        disabled={busy}
                        className="rounded-lg border border-[#DCCFBD] px-3 py-2 text-sm hover:bg-[#F0E8DB] disabled:opacity-50"
                      >
                        Choose
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={() => setShowSetter(false)}
                className="mt-3 text-sm underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {previous.length > 0 && (
        <div className="mt-8">
          <h3 className="font-serif text-xl">Previously read</h3>
          <ul className="mt-3 space-y-3">
            {previous.map((book) => (
              <li
                key={book.id}
                className="flex gap-4 rounded-xl border border-[#EEE2D1] bg-[#FAF5ED] p-4"
              >
                <Cover
                  title={book.title}
                  coverId={book.cover_id}
                  className="h-24 w-16 shrink-0 rounded"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg">{book.title}</p>
                  {book.author && (
                    <p className="text-sm text-[#75634D]">by {book.author}</p>
                  )}
                  <p className="text-xs text-[#8C7D6A]">
                    {formatDate(book.started_on)}
                    {book.finished_on && ` → ${formatDate(book.finished_on)}`}
                  </p>

                  {actionsFor(book)}

                  {isOwner && (
  <div className="mt-4">
    <button
      type="button"
      onClick={() => {
        if (selectedReviewBookId === book.id) {
          setSelectedReviewBookId(null);
          setReviewQuestions([]);
          return;
        }

        setSelectedReviewBookId(book.id);
        setNewReviewQuestion("");
        setEditingQuestionId(null);
        setEditingQuestionText("");
        void loadReviewQuestions(book.id);
      }}
      className="text-sm font-medium underline"
    >
      {selectedReviewBookId === book.id
        ? "Close review questions"
        : "Manage review questions"}
    </button>

    {selectedReviewBookId === book.id && (
      <div className="mt-3 rounded-xl border border-[#E4D9C8] bg-white p-4">
        <h4 className="font-serif text-lg">
          Review questions for {book.title}
        </h4>

        {questionsFor(book.id).length === 0 && (
          <p className="mt-2 text-sm text-[#8C7D6A]">
            No custom questions yet. Add your first question below.
          </p>
        )}

        <ul className="mt-3 space-y-3">
          {questionsFor(book.id).map((question) => (
            <li key={question.id} className="rounded-lg bg-[#FAF5ED] p-3">
              {editingQuestionId === question.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editingQuestionText}
                    onChange={(event) =>
                      setEditingQuestionText(event.target.value)
                    }
                    rows={2}
                    className="w-full rounded-lg border border-[#DCCFBD] bg-white p-2 text-sm"
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        void saveReviewQuestion(
                          book.id,
                          question.id,
                          editingQuestionText,
                          question.position
                        )
                      }
                      disabled={busy || !editingQuestionText.trim()}
                      className="text-sm underline disabled:opacity-50"
                    >
                      Save changes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingQuestionId(null);
                        setEditingQuestionText("");
                      }}
                      className="text-sm underline"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="flex-1 text-sm">{question.question}</p>
                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingQuestionId(question.id);
                        setEditingQuestionText(question.question);
                      }}
                      className="underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void deleteReviewQuestion(question.id, book.id)
                      }
                      disabled={busy}
                      className="text-red-700 underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-2">
          <label className="block text-sm font-medium">
            Add a question
          </label>
          <textarea
            value={newReviewQuestion}
            onChange={(event) => setNewReviewQuestion(event.target.value)}
            rows={2}
            placeholder="Write a question specifically about this book..."
            className="w-full rounded-lg border border-[#DCCFBD] bg-white p-3 text-sm"
          />
          <button
            type="button"
            onClick={() =>
              void saveReviewQuestion(
                book.id,
                null,
                newReviewQuestion,
                questionsFor(book.id).length
              )
            }
            disabled={busy || !newReviewQuestion.trim()}
            className="rounded-full bg-[#65795A] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Add question
          </button>
        </div>
      </div>
    )}
  </div>
)}

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Remove this book from the club's history?")) {
                          void run(
                            () =>
                              supabase.rpc("remove_club_book", {
                                p_club_book_id: book.id,
                              }),
                            "Removed."
                          );
                        }
                      }}
                      disabled={busy}
                      className="mt-2 text-xs text-red-700 underline disabled:opacity-50"
                    >
                      Remove from history
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}