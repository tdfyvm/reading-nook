"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type BookStatus = "Reading" | "Read" | "Want to read";

type Book = {
  id: string;
  title: string;
  author: string;
  status: BookStatus;
  reading_version: string | null;
  rating: number;
  genre: string | null;
  notes: string | null;
  coverId?: number | null;
  custom_cover_url?: string | null;
  custom_cover_path?: string | null;
  color: string;
  initials: string;
  total_pages: number | null;
  current_page: number;
};

const bookColors = ["#9DAF91", "#CDAA88", "#B68E8A", "#8C9D78", "#D4B77D", "#6F777F"];

function decorateBook(book: {
  id: string;
  title: string;
  author: string;
  status: BookStatus;
  reading_version: string | null;
  rating: number;
  genre: string | null;
  notes: string | null;
  coverId?: number | null;
  custom_cover_url?: string | null;
  custom_cover_path?: string | null;
  total_pages: number | null;
  current_page: number;
}): Book {
  return {
    ...book,
    color: bookColors[book.title.length % bookColors.length],
    initials: book.title
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0] ?? "")
      .join("")
      .toUpperCase(),
  };
}

export default function Home() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);

  const [coverSuggestions, setCoverSuggestions] = useState<
    Record<string, number[]>
    >({});
  const [savingCoverFor, setSavingCoverFor] = useState<string | null>(null);
  const [manualCoverUrl, setManualCoverUrl] = useState<Record<string, string>>({});
  const [uploadingCoverFor, setUploadingCoverFor] = useState<string | null>(null);

  const attemptedCoverLookups = useRef(new Set<string>());
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All books");
  
  const filteredBooks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return books.filter((book) => {
      const matchesSearch =
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query);

      const matchesStatus = filter === "All books" || book.status === filter;

      return matchesSearch && matchesStatus;
    });
  }, [books, search, filter]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newStatus, setNewStatus] =
    useState<BookStatus>("Want to read");
  const [newRating, setNewRating] = useState(0);
  const [newGenre, setNewGenre] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editStatus, setEditStatus] = useState<BookStatus>("Want to read");
  const [editRating, setEditRating] = useState(0);
  const [editTotalPages, setEditTotalPages] = useState("");
  const [editCurrentPage, setEditCurrentPage] = useState("0");

  const [editGenre, setEditGenre] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const loadBooks = useCallback(async (ownerId: string) => {
    setIsLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("books")
      .select("id, title, author, status, rating, genre, notes, cover_id, custom_cover_url, custom_cover_path, reading_version, total_pages, current_page")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Couldn't load your books: ${error.message}`);
      setIsLoading(false);
      return;
    }

    
const loadedBooks = await Promise.all(
  (data ?? []).map(async (book) => {
    let signedCoverUrl: string | null = null;

    if (book.custom_cover_path) {
      const { data: signedData, error: signedError } =
        await supabase.storage
          .from("book-covers")
          .createSignedUrl(book.custom_cover_path, 3600);

      if (!signedError) {
        signedCoverUrl = signedData.signedUrl;
      }
    }

    return decorateBook({
      id: book.id,
      title: book.title,
      author: book.author,
      status: book.status as BookStatus,
      reading_version: book.reading_version,
      rating: book.rating,
      genre: book.genre,
      coverId: book.cover_id,
      custom_cover_url: signedCoverUrl ?? book.custom_cover_url,
      custom_cover_path: book.custom_cover_path,
      notes: book.notes,
      total_pages: book.total_pages,
      current_page: book.current_page,
    });
  })
);

setBooks(loadedBooks);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error || !data.session) {
        router.replace("/login");
        return;
      }

      const currentUserId = data.session.user.id;
      setUserId(currentUserId);
      await loadBooks(currentUserId);
    }

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUserId(null);
        router.replace("/login");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadBooks, router]);

  
  
useEffect(() => {
  if (!userId || books.length === 0) return;

  let cancelled = false;

  async function findMissingCovers() {
    for (const book of books) {
      if (
        book.coverId != null ||
        attemptedCoverLookups.current.has(book.id)
      ) {
        continue;
      }

      attemptedCoverLookups.current.add(book.id);

      try {
        const params = new URLSearchParams({
          title: book.title,
          author:
            book.author === "Unknown author" ? "" : book.author,
          fields: "title,author_name,cover_i,language",
          limit: "10",
        });

        const response = await fetch(
          `https://openlibrary.org/search.json?${params.toString()}`
        );

        if (!response.ok) continue;

        const result: {
          docs?: {
            title?: string;
            author_name?: string[];
            cover_i?: number;
            language?: string[];
          }[];
        } = await response.json();

        const normalize = (value: string) =>
          value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

        const wantedTitle = normalize(book.title);
        const wantedAuthor = normalize(book.author);

        const candidates = (result.docs ?? []).filter((candidate) => {
          if (
            typeof candidate.cover_i !== "number" ||
            !candidate.title
          ) {
            return false;
          }

          const foundTitle = normalize(candidate.title);

          const titleMatches =
            foundTitle === wantedTitle ||
            foundTitle.includes(wantedTitle) ||
            wantedTitle.includes(foundTitle);

          if (!titleMatches) return false;

          if (book.author !== "Unknown author") {
            const authors = candidate.author_name ?? [];

            const authorMatches = authors.some((author) => {
              const foundAuthor = normalize(author);

              return (
                foundAuthor === wantedAuthor ||
                foundAuthor.includes(wantedAuthor) ||
                wantedAuthor.includes(foundAuthor)
              );
            });

            if (!authorMatches) return false;
          }

          return true;
        });

        // Prefer English editions, then show other matching editions.
const sortedCandidates = [...candidates].sort((a, b) => {
  const aEnglish = a.language?.includes("eng") ? 1 : 0;
  const bEnglish = b.language?.includes("eng") ? 1 : 0;
  return bEnglish - aEnglish;
});

const coverIds = Array.from(
  new Set(
    sortedCandidates
      .map((candidate) => candidate.cover_i)
      .filter((id): id is number => typeof id === "number")
  )
);

if (!cancelled && coverIds.length > 0) {
  setCoverSuggestions((current) => ({
    ...current,
    [book.id]: coverIds,
  }));
}
      } catch (error) {
        console.error("Couldn't look up book cover:", error);
      }
    }
  }

  void findMissingCovers();

  return () => {
    cancelled = true;
  };
}, [books, userId]);



async function approveCover(book: Book) {
  const coverId = coverSuggestions[book.id]?.[0];

  if (coverId == null || !userId || savingCoverFor !== null) return;

  setSavingCoverFor(book.id);
  setMessage("");

  try {
    const { error } = await supabase
      .from("books")
      .update({ cover_id: coverId })
      .eq("id", book.id)
      .eq("owner_id", userId);

    if (error) {
      setMessage(`Couldn't save the cover: ${error.message}`);
      return;
    }

    setBooks((current) =>
      current.map((item) =>
        item.id === book.id ? { ...item, coverId } : item
      )
    );

    setCoverSuggestions((current) => {
      const next = { ...current };
      delete next[book.id];
      return next;
    });

    setMessage(`Cover saved for "${book.title}".`);
  } finally {
    setSavingCoverFor(null);
  }
}


async function saveManualCoverUrl(book: Book) {
  const url = manualCoverUrl[book.id]?.trim();

  if (!url || !userId || savingCoverFor !== null) return;

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      setMessage("Please enter a valid image URL starting with http:// or https://.");
      return;
    }
  } catch {
    setMessage("Please enter a valid image URL.");
    return;
  }

  setSavingCoverFor(book.id);
  setMessage("");

  try {
    const { error } = await supabase
      .from("books")
      .update({
        custom_cover_url: url,
        custom_cover_path: null,
      })
      .eq("id", book.id)
      .eq("owner_id", userId);

    if (error) {
      setMessage(`Couldn't save the manual cover: ${error.message}`);
      return;
    }

    setBooks((current) =>
      current.map((item) =>
        item.id === book.id
          ? { ...item, custom_cover_url: url, custom_cover_path: null }
          : item
      )
    );

    setCoverSuggestions((current) => {
      const next = { ...current };
      delete next[book.id];
      return next;
    });

    setMessage(`Manual cover saved for "${book.title}".`);
  } finally {
    setSavingCoverFor(null);
  }
}


async function uploadBookCover(book: Book, file: File) {
  if (!userId || uploadingCoverFor !== null) return;

  if (!file.type.startsWith("image/")) {
    setMessage("Please choose an image file.");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setMessage("Please choose an image smaller than 5 MB.");
    return;
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExtension = /^[a-z0-9]+$/.test(extension) ? extension : "jpg";
  const path = `${userId}/${book.id}-${Date.now()}.${safeExtension}`;

  setUploadingCoverFor(book.id);
  setMessage("");

  try {
    const { error: uploadError } = await supabase.storage
      .from("book-covers")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      setMessage(`Couldn't upload the cover: ${uploadError.message}`);
      return;
    }

    const { error: updateError } = await supabase
      .from("books")
      .update({
        custom_cover_path: path,
        custom_cover_url: null,
      })
      .eq("id", book.id)
      .eq("owner_id", userId);

    if (updateError) {
      setMessage(`Image uploaded, but couldn't save it to the book: ${updateError.message}`);
      return;
    }

    
const { data: signedData, error: signedError } = await supabase.storage
  .from("book-covers")
  .createSignedUrl(path, 3600);

if (signedError) {
  setMessage(
    `Cover uploaded and saved, but couldn't display it yet: ${signedError.message}`
  );
  return;
}

setBooks((current) =>
  current.map((item) =>
    item.id === book.id
      ? {
          ...item,
          custom_cover_path: path,
          custom_cover_url: signedData.signedUrl,
        }
      : item
  )
);


    setCoverSuggestions((current) => {
      const next = { ...current };
      delete next[book.id];
      return next;
    });

    setMessage(`Cover uploaded for "${book.title}".`);
  } finally {
    setUploadingCoverFor(null);
  }
}


function skipCover(bookId: string) {
  setCoverSuggestions((current) => {
    const remaining = current[bookId] ?? [];

    if (remaining.length <= 1) {
      return current;
    }

    return {
      ...current,
      [bookId]: remaining.slice(1),
    };
  });
}


const readingVersionOptions = [
  "Physical copy",
  "Ebook",
  "Audiobook",
  "Library book",
  "Immersive reading",
];

async function saveReadingVersion(book: Book, version: string) {
  if (!userId) return;

  const { error } = await supabase
    .from("books")
    .update({ reading_version: version || null })
    .eq("id", book.id)
    .eq("owner_id", userId);

  if (error) {
    setMessage(`Couldn't save reading version: ${error.message}`);
    return;
  }

  setBooks((current) =>
    current.map((item) =>
      item.id === book.id
        ? { ...item, reading_version: version || null }
        : item
    )
  );

  setMessage(`Reading version updated for "${book.title}".`);
}


  const counts = {
    all: books.length,
    reading: books.filter((book) => book.status === "Reading").length,
    read: books.filter((book) => book.status === "Read").length,
    wishlist: books.filter((book) => book.status === "Want to read").length,
  };

  async function addBook(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!userId || isSaving) return;

  const title = newTitle.trim();
  const author = newAuthor.trim() || "Unknown author";

  if (!title) {
    setMessage("Please enter a book title.");
    return;
  }

  setIsSaving(true);
  setMessage("");

  const { data, error } = await supabase
    .from("books")
    .insert({
  owner_id: userId,
  title,
  author,
  status: newStatus,
  rating: newRating,
  genre: newGenre.trim() || null,
  notes: newNotes.trim() || null,
})
    .select("id, title, author, status, rating, genre, notes, cover_id, reading_version, total_pages, current_page")
    .single();

  setIsSaving(false);

  if (error) {
    setMessage(`Couldn't save your book: ${error.message}`);
    return;
  }

  setBooks((current) => [
    decorateBook({
      id: data.id,
      title: data.title,
      author: data.author,
      status: data.status as BookStatus,
      reading_version: data.reading_version,
      rating: data.rating,
      genre: data.genre,
      coverId: data.cover_id,
      notes: data.notes,
      total_pages: data.total_pages,
      current_page: data.current_page,
    }),
    ...current,
  ]);

  setFilter("All books");
  setSearch("");
  setNewTitle("");
  setNewAuthor("");
  setNewStatus("Want to read");
  setNewRating(0);
  setNewGenre("");
  setNewNotes("");
  setIsAddFormOpen(false);
  setMessage(`"${title}" was added to your bookshelf.`);
}

function startEditing(book: Book) {
  setEditingBookId(book.id);
  setEditTitle(book.title);
  setEditAuthor(book.author);
  setEditStatus(book.status);
  setEditRating(book.rating);
  
setEditTotalPages(
  book.total_pages == null ? "" : String(book.total_pages)
);
setEditCurrentPage(String(book.current_page ?? 0));
  setEditGenre(book.genre ?? "");
  setEditNotes(book.notes ?? "");
  setMessage("");
}

function cancelEditing() {
  setEditingBookId(null);
  setEditTitle("");
  setEditAuthor("");
  setEditStatus("Want to read");
  setEditRating(0);
  setEditGenre("");
  setEditNotes("");
}

async function saveBookEdits(
  event: React.FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  if (!editingBookId || !userId) return;

  const title = editTitle.trim();
  const author = editAuthor.trim() || "Unknown author";

  if (!title) {
    setMessage("Please enter a book title.");
    return;
  }

  setIsSaving(true);
  setMessage("");

  const { data, error } = await supabase
    .from("books")
    .update({
      title,
      author,
      status: editStatus,
      rating: editRating,
      genre: editGenre.trim() || null,
      notes: editNotes.trim() || null,
      total_pages:
       editTotalPages.trim() === ""
        ? null
        : Number(editTotalPages),
        current_page: Number(editCurrentPage || 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", editingBookId)
    .eq("owner_id", userId)
    .select("id, title, author, status, rating, genre, notes, cover_id, reading_version, total_pages, current_page")
    .single();

  setIsSaving(false);

  if (error) {
    setMessage(`Couldn't update your book: ${error.message}`);
    return;
  }

  
setBooks((current) =>
  current.map((book) =>
    book.id === data.id
      ? decorateBook({
          id: data.id,
          title: data.title,
          author: data.author,
          status: data.status as BookStatus,
          reading_version: data.reading_version,
          rating: data.rating,
          genre: data.genre,
          coverId: data.cover_id,
          notes: data.notes,
          total_pages: data.total_pages,
          current_page: data.current_page,
        })
      : book
  )
);


  cancelEditing();
  setMessage(`"${data.title}" was updated successfully.`);
}


  async function removeBook(book: Book) {
    if (!userId) return;

    const confirmed = window.confirm(
      `Remove "${book.title}" from your bookshelf?`
    );
    if (!confirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("books")
      .delete()
      .eq("id", book.id)
      .eq("owner_id", userId);

    if (error) {
      setMessage(`Couldn't remove the book: ${error.message}`);
      return;
    }

    setBooks((current) => current.filter((item) => item.id !== book.id));
    setMessage(`"${book.title}" was removed.`);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(`Couldn't sign out: ${error.message}`);
      return;
    }

    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-[#F8F5EE] text-[#453B32]">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-64 shrink-0 border-r border-[#E9E0D2] bg-[#F2EDE3] p-7 md:block">
          <div className="mb-12">
            <div className="mb-2 text-3xl">☕</div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">
              The Reading Nook
            </h1>
            <p className="mt-2 text-sm italic text-[#897A68]">
              A little home for your books
            </p>
          </div>

          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#A29481]">
            Your library
          </p>
          <nav className="space-y-2">
            {["All books", "Reading", "Read", "Want to read"].map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition ${
                  filter === item
                    ? "bg-[#E3D8C5] font-medium text-[#554533]"
                    : "text-[#827462] hover:bg-[#EAE2D5]"
                }`}
              >
                <span>
                  {item === "All books"
                    ? "▤"
                    : item === "Reading"
                      ? "◷"
                      : item === "Read"
                        ? "✓"
                        : "♡"}
                </span>
                {item}
              </button>
            ))}
          </nav>

          <div className="mt-12 rounded-2xl bg-[#E5DCCB] p-5">
            <div className="mb-3 text-2xl">🌿</div>
            <p className="font-serif text-lg">A room of your own</p>
            <p className="mt-2 text-sm leading-6 text-[#827462]">
              Every book holds a world. Keep the ones you love close.
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 p-5 sm:p-8 lg:p-12">
<header className="mb-10 flex flex-wrap items-start justify-between gap-4">
  <div>
    <p className="mb-2 text-sm text-[#9B866A]">
      YOUR PERSONAL LIBRARY
    </p>
    <h2 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">
      A shelf of stories.
    </h2>
    <p className="mt-3 text-[#8C7D6A]">
      A quiet place for every book and every thought.
    </p>
  </div>

  <div className="flex flex-wrap gap-2">
    <Link
      href="/surveys"
      className="rounded-full border border-[#D8CCBA] px-4 py-3 text-sm text-[#75634D] transition hover:bg-[#EEE6D9]"
      >
        My Book Surveys
      </Link>
    
    <button
      type="button"
      onClick={signOut}
      className="rounded-full border border-[#D8CCBA] px-4 py-3 text-sm text-[#75634D] transition hover:bg-[#EEE6D9]"
    >
      Sign out
    </button>

    <button
      type="button"
      onClick={() => setIsAddFormOpen(true)}
      disabled={isSaving || isLoading}
      className="rounded-full bg-[#75634D] px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[#5D4C39] disabled:opacity-60"
    >
      + Add a book
    </button>
  </div>
</header>


          <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total books" value={counts.all} icon="📚" />
            <StatCard label="Currently reading" value={counts.reading} icon="☕" />
            <StatCard label="Finished" value={counts.read} icon="✿" />
            <StatCard label="On your wishlist" value={counts.wishlist} icon="♡" />
          </div>

{isAddFormOpen && (
  <div className="mb-8 rounded-2xl border border-[#E4D9C8] bg-white/80 p-6 shadow-sm sm:p-8">
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm text-[#9B866A]">A NEW STORY</p>
        <h3 className="mt-1 font-serif text-2xl">Add a book to your shelf</h3>
        <p className="mt-2 text-sm text-[#8C7D6A]">
          Every great reading journey starts somewhere.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setIsAddFormOpen(false)}
        className="rounded-full px-3 py-1 text-sm text-[#837461] hover:bg-[#F0E9DC]"
      >
        Cancel
      </button>
    </div>

    <form onSubmit={addBook} className="space-y-5">
      <div>
        <label htmlFor="book-title" className="mb-2 block text-sm font-medium">
          Book title *
        </label>
        <input
          id="book-title"
          required
          autoFocus
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="e.g. The Secret Garden"
          className="w-full rounded-xl border border-[#E4D9C8] bg-[#FDFBF7] px-4 py-3 outline-none focus:border-[#9B866A]"
        />
      </div>

      <div>
        <label htmlFor="book-author" className="mb-2 block text-sm font-medium">
          Author
        </label>
        <input
          id="book-author"
          value={newAuthor}
          onChange={(event) => setNewAuthor(event.target.value)}
          placeholder="e.g. Frances Hodgson Burnett"
          className="w-full rounded-xl border border-[#E4D9C8] bg-[#FDFBF7] px-4 py-3 outline-none focus:border-[#9B866A]"
        />
      </div>

      
      <div>
        <label htmlFor="book-status" className="mb-2 block text-sm font-medium">
          Reading status
        </label>
        <select
          id="book-status"
          value={newStatus}
          onChange={(event) => setNewStatus(event.target.value as BookStatus)}
          className="w-full rounded-xl border border-[#E4D9C8] bg-[#FDFBF7] px-4 py-3 outline-none focus:border-[#9B866A]"
        >
          <option value="Want to read">Want to read</option>
          <option value="Reading">Currently reading</option>
          <option value="Read">Finished reading</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Your rating
        </label>
        <div className="flex gap-2" role="group" aria-label="Book rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setNewRating(star === newRating ? 0 : star)}
              aria-label={`${star} star${star === 1 ? "" : "s"}`}
              aria-pressed={newRating === star}
              className={`text-3xl transition hover:scale-110 ${
                star <= newRating ? "text-[#B68E4A]" : "text-[#D8CEBD]"
              }`}
            >
              ★
            </button>
          ))}
          <span className="self-center text-sm text-[#8C7D6A]">
            {newRating === 0 ? "Not rated" : `${newRating} out of 5`}
          </span>
        </div>
      </div>

      <div>
        <label htmlFor="book-genre" className="mb-2 block text-sm font-medium">
          Genre <span className="font-normal text-[#9B8B78]">(optional)</span>
        </label>
        <input
          id="book-genre"
          value={newGenre}
          onChange={(event) => setNewGenre(event.target.value)}
          placeholder="e.g. Fantasy, Mystery, Romance"
          className="w-full rounded-xl border border-[#E4D9C8] bg-[#FDFBF7] px-4 py-3 outline-none focus:border-[#9B866A]"
        />
      </div>

      <div>
        <label htmlFor="book-notes" className="mb-2 block text-sm font-medium">
          Personal notes <span className="font-normal text-[#9B8B78]">(optional)</span>
        </label>
        <textarea
          id="book-notes"
          value={newNotes}
          onChange={(event) => setNewNotes(event.target.value)}
          placeholder="Thoughts, favorite moments, or things you want to remember..."
          rows={4}
          className="w-full resize-y rounded-xl border border-[#E4D9C8] bg-[#FDFBF7] px-4 py-3 outline-none focus:border-[#9B866A]"
        />
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-full bg-[#75634D] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#5D4C39] disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save to my shelf"}
        </button>

        <button
          type="button"
          onClick={() => setIsAddFormOpen(false)}
          className="rounded-full border border-[#D8CCBA] px-6 py-3 text-sm text-[#75634D] hover:bg-[#EEE6D9]"
        >
          Cancel
        </button>
      </div>
    </form>
  </div>
)}

          {message && (
            <p
              role="status"
              className="mb-6 rounded-xl border border-[#E4D9C8] bg-white/70 p-4 text-sm"
            >
              {message}
            </p>
          )}

          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-2xl">Your bookshelf</h3>
              <p className="mt-1 text-sm text-[#9B8B78]">
                A collection that is yours alone.
              </p>
            </div>
            <label className="flex w-full max-w-xs items-center gap-2 rounded-full border border-[#E4D9C8] bg-white/70 px-4 py-3">
              <span className="text-[#A0917D]">⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a book or author..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#B0A392]"
              />
            </label>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {["All books", "Reading", "Read", "Want to read"].map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  filter === item
                    ? "border-[#75634D] bg-[#75634D] text-white"
                    : "border-[#E3D8C8] bg-white/50 text-[#837461] hover:bg-[#EEE6D9]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="rounded-2xl border border-dashed border-[#DCCFBD] p-12 text-center">
              <div className="mb-3 text-3xl">📖</div>
              <p className="font-serif text-xl">Opening your bookshelf...</p>
            </div>
          ) : filteredBooks.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredBooks.map((book) => (
                <article
                  key={book.id}
                  className="group rounded-2xl border border-[#EBE2D5] bg-white/70 p-4 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-[#6D5940]/5"
                >
                  
            <Link
              href={`/books/${book.id}`}
              className="flex h-48 items-center justify-center overflow-hidden rounded-xl shadow-inner"
              style={{ backgroundColor: book.color }}
            >
                    
{book.custom_cover_url ? (
  <img
    src={book.custom_cover_url}
    alt={`Cover of ${book.title}`}
    className="h-full w-full object-contain"
    loading="lazy"
  />
) : book.coverId != null ? (
  <img
    src={`https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`}
    alt={`Cover of ${book.title}`}
    className="h-full w-full object-contain"
    loading="lazy"
  />
) : (
  <div
    className="flex h-36 w-28 flex-col items-center justify-center border border-white/50 px-3 text-center text-white shadow-lg"
    style={{ backgroundColor: book.color }}
  >
    <span className="mb-3 text-xs tracking-[0.3em] opacity-80">
      ✦ ✦ ✦
    </span>
    <span className="font-serif text-3xl">
      {book.initials}
    </span>
    <span className="mt-3 text-xs tracking-widest opacity-80">
      A STORY
    </span>
  </div>
)}
</Link>

                   

{book.coverId == null &&
  !book.custom_cover_url &&
  !book.custom_cover_path && (
  <div className="mt-3 rounded-xl border border-[#DCCFBD] bg-[#FBF8F2] p-3">
    {(coverSuggestions[book.id]?.length ?? 0) > 0 && (
      <>
        <p className="mb-2 text-sm font-medium text-[#75634D]">
          Suggested cover — check the language and edition
        </p>

        <img
          src={`https://covers.openlibrary.org/b/id/${coverSuggestions[book.id][0]}-M.jpg`}
          alt={`Suggested cover for ${book.title}`}
          className="mb-3 h-36 w-auto rounded object-contain"
          loading="lazy"
        />

        <div className="relative z-10 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              skipCover(book.id);
            }}
            disabled={savingCoverFor !== null}
            className="cursor-pointer rounded-full border border-[#D8CCBA] bg-white px-4 py-2 text-sm text-[#75634D] hover:bg-[#EEE6D9] disabled:opacity-60"
          >
            Skip
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              approveCover(book);
            }}
            disabled={savingCoverFor !== null}
            className="cursor-pointer rounded-full bg-[#75634D] px-4 py-2 text-sm text-white hover:bg-[#5D4C39] disabled:opacity-60"
          >
            {savingCoverFor === book.id ? "Saving..." : "Use this cover"}
          </button>
        </div>
      </>
    )}

    <div className="mt-4 border-t border-[#DCCFBD] pt-3">
      <label
        htmlFor={`manual-cover-url-${book.id}`}
        className="mb-2 block text-sm font-medium text-[#75634D]"
      >
        { (coverSuggestions[book.id]?.length ?? 0) > 0
          ? "None of these covers is right? Paste an image URL"
          : "No suggested covers? Paste an image URL"}
      </label>

      <input
        id={`manual-cover-url-${book.id}`}
        type="url"
        value={manualCoverUrl[book.id] ?? ""}
        onChange={(event) =>
          setManualCoverUrl((current) => ({
            ...current,
            [book.id]: event.target.value,
          }))
        }
        placeholder="https://example.com/cover.jpg"
        className="w-full rounded-lg border border-[#D8CCBA] bg-white px-3 py-2 text-sm text-[#4A4035]"
      />

      <button
        type="button"
        onClick={() => saveManualCoverUrl(book)}
        disabled={
          !manualCoverUrl[book.id]?.trim() ||
          savingCoverFor !== null
        }
        className="mt-2 cursor-pointer rounded-full border border-[#D8CCBA] bg-white px-4 py-2 text-sm text-[#75634D] hover:bg-[#EEE6D9] disabled:opacity-60"
      >
        {savingCoverFor === book.id ? "Saving..." : "Save image URL"}
      </button>
    </div>

    <div className="mt-4 border-t border-[#DCCFBD] pt-3">
      <label
        htmlFor={`upload-cover-${book.id}`}
        className="mb-2 block text-sm font-medium text-[#75634D]"
      >
        Or upload a cover image from your computer
      </label>

      <input
        id={`upload-cover-${book.id}`}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            void uploadBookCover(book, file);
          }

          event.currentTarget.value = "";
        }}
        disabled={uploadingCoverFor !== null}
        className="block w-full text-sm text-[#75634D] file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-[#75634D] file:px-4 file:py-2 file:text-white disabled:opacity-60"
      />

      {uploadingCoverFor === book.id && (
        <p className="mt-2 text-sm text-[#75634D]">
          Uploading cover...
        </p>
      )}
    </div>
  </div>
)}


    

{book.total_pages != null && book.total_pages > 0 && (
  <div className="mt-3">
    <div className="mb-1 flex items-center justify-between text-xs text-[#786B5D]">
      <span>Reading progress</span>
      <span>
        {Math.round(
          (book.current_page / book.total_pages) * 100
        )}%
      </span>
    </div>

    <div className="h-2 overflow-hidden rounded-full bg-[#E8DFD2]">
      <div
        className="h-full rounded-full bg-[#8A9A78] transition-all"
        style={{
          width: `${Math.min(
            100,
            Math.round(
              (book.current_page / book.total_pages) * 100
            )
          )}%`,
        }}
      />
    </div>

    <p className="mt-1 text-xs text-[#786B5D]">
      Page {book.current_page} of {book.total_pages}
    </p>
  </div>
)}


                  <div className="px-1 pb-1 pt-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-[#F0E9DC] px-3 py-1 text-xs text-[#83715A]">
                        {book.status}
                      </span>
                      <button
                        onClick={() => removeBook(book)}
                        aria-label={`Remove ${book.title}`}
                        title="Remove book"
                        className="text-xs text-[#AA9A86] opacity-70 hover:text-red-700 hover:opacity-100"
                      >
                        Remove
                      </button>
                    </div>
                    <h4 className="font-serif text-xl font-medium">
                      {book.title}
                    </h4>
                    <p className="mt-1 text-sm text-[#968672]">
                      {book.author}
                    </p>

                    
<div className="mt-3">
  <label
    htmlFor={`reading-version-${book.id}`}
    className="mb-1 block text-sm font-medium text-[#75634D]"
  >
    Which version are you reading?
  </label>

  <select
    id={`reading-version-${book.id}`}
    value={book.reading_version ?? ""}
    onChange={(event) =>
      void saveReadingVersion(book, event.target.value)
    }
    className="w-full rounded-xl border border-[#DCCFBD] bg-white px-3 py-2 text-sm text-[#75634D] outline-none focus:border-[#9B866A]"
  >
    <option value="">Choose a version</option>
    {readingVersionOptions.map((version) => (
      <option key={version} value={version}>
        {version}
      </option>
    ))}
  </select>
</div>

                    
                    {book.genre && (
                      <span className="mt-3 inline-block rounded-full bg-[#E8E1D4] px-3 py-1 text-xs text-[#75634D]">
                        {book.genre}
                      </span>
                    )}

                    {book.notes && (
                      <div className="mt-3 rounded-xl bg-[#F8F5EE] p-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#9B866A]">
                          My reading notes
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-[#756B5D]">
                          {book.notes}
                        </p>
                      </div>
                    )}
                    
<div
  className="mt-3 flex items-center gap-1 text-sm text-[#AA8650]"
  aria-label={`${book.rating} out of 5 stars`}
>
  {Array.from({ length: 5 }, (_, index) => {
    const fill = Math.max(0, Math.min(1, book.rating - index));

    return (
      <span
        key={index}
        className="relative inline-block"
        aria-hidden="true"
      >
        <span className="text-[#D8CEBD]">★</span>
        <span
          className="absolute inset-y-0 left-0 overflow-hidden text-[#AA8650]"
          style={{ width: `${fill * 100}%` }}
        >
          ★
        </span>
      </span>
    );
  })}
</div>

                    
                    {editingBookId === book.id && (
                      <form
                        onSubmit={saveBookEdits}
                        className="mt-4 space-y-4 rounded-2xl border border-[#E9E0D2] bg-[#FBF8F2] p-4"
                      >
                        <h3 className="font-serif text-lg text-[#75634D]">
                          Edit your book
                        </h3>

                        <div>
                          <label className="mb-1 block text-sm text-[#75634D]">
                            Book title
                          </label>
                          <input
                            value={editTitle}
                            onChange={(event) =>
                              setEditTitle(event.target.value)
                            }
                            required
                            className="w-full rounded-xl border border-[#DCCFBD] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C8AE86]"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-sm text-[#75634D]">
                            Author
                          </label>
                          <input
                            value={editAuthor}
                            onChange={(event) =>
                              setEditAuthor(event.target.value)
                            }
                            className="w-full rounded-xl border border-[#DCCFBD] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C8AE86]"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-sm text-[#75634D]">
                            Reading status
                          </label>
                          <select
                            value={editStatus}
                            onChange={(event) =>
                              setEditStatus(event.target.value as BookStatus)
                            }
                            className="w-full rounded-xl border border-[#DCCFBD] bg-white px-3 py-2 text-sm"
                          >
                            <option value="Want to read">Want to read</option>
                            <option value="Reading">Reading</option>
                            <option value="Read">Read</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-sm text-[#75634D]">
                            Rating
                          </label>
                          <select
                            value={editRating}
                            onChange={(event) =>
                              setEditRating(Number(event.target.value))
                            }
                            className="w-full rounded-xl border border-[#DCCFBD] bg-white px-3 py-2 text-sm"
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
                        </div>


<div>
  <label className="mb-1 block text-sm font-medium">
    Total pages
  </label>
  <input
    type="number"
    min="1"
    value={editTotalPages}
    onChange={(event) =>
      setEditTotalPages(event.target.value)
    }
    placeholder="e.g. 320"
    className="w-full rounded-xl border border-[#DCCFBD] bg-white px-3 py-2 text-sm"
  />
</div>

<div>
  <label className="mb-1 block text-sm font-medium">
    Current page
  </label>
  <input
    type="number"
    min="0"
    value={editCurrentPage}
    onChange={(event) =>
      setEditCurrentPage(event.target.value)
    }
    placeholder="e.g. 126"
    className="w-full rounded-xl border border-[#DCCFBD] bg-white px-3 py-2 text-sm"
  />
</div>

                        <div>
                          <label className="mb-1 block text-sm text-[#75634D]">
                            Genre
                          </label>
                          <input
                            value={editGenre}
                            onChange={(event) =>
                              setEditGenre(event.target.value)
                            }
                            placeholder="e.g. Fantasy, Romance"
                            className="w-full rounded-xl border border-[#DCCFBD] bg-white px-3 py-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-sm text-[#75634D]">
                            My reading notes
                          </label>
                          <textarea
                            value={editNotes}
                            onChange={(event) =>
                              setEditNotes(event.target.value)
                            }
                            rows={4}
                            placeholder="Your thoughts about this book..."
                            className="w-full rounded-xl border border-[#DCCFBD] bg-white px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="rounded-xl bg-[#8B7355] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#75634D] disabled:opacity-50"
                          >
                            {isSaving ? "Saving..." : "Save changes"}
                          </button>

                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={isSaving}
                            className="rounded-xl border border-[#DCCFBD] px-4 py-2 text-sm text-[#75634D] transition hover:bg-[#F0E8DB]"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}


                    <button
                    type="button"
                    onClick={() => startEditing(book)}
                    className="mt-4 rounded-xl border border-[#DCCFBD] px-4 py-2 text-sm font-medium text-[#75634D] transition hover:bg-[#F0E8DB]"
                    >
                      ✏️ Edit book
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#DCCFBD] p-12 text-center">
              <div className="mb-3 text-3xl">📖</div>
              <p className="font-serif text-xl">
                {search || filter !== "All books"
                  ? "No books found"
                  : "Your shelf is waiting"}
              </p>
              <p className="mt-2 text-sm text-[#968672]">
                {search || filter !== "All books"
                  ? "Try another search or filter."
                  : "Add your first book to begin your collection."}
              </p>
            </div>
          )}

          <footer className="mt-16 border-t border-[#E7DDCF] py-6 text-center text-sm text-[#A0917E]">
            Made with a little warmth and a love of stories.
          </footer>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E9E0D2] bg-white/60 p-5">
      <div className="mb-4 text-xl">{icon}</div>
      <p className="text-sm text-[#93836F]">{label}</p>
      <p className="mt-1 font-serif text-3xl">{value}</p>
    </div>
  );
}