
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { RecommendationsEditor } from "@/components/Recommendations";

type Survey = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  book_id: string | null;
  book_title: string | null;
  book_author: string | null;
  book_cover_id: number | null;
};

type LibraryBook = {
  id: string;
  title: string;
  author: string;
  cover_id: number | null;
}

type QuestionType = "text" | "multiple_choice";

type SurveyQuestion = {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  position: number;
};

function SurveyDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const surveyId = params.id;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [libraryBooks, setLibraryBooks] = useState<LibraryBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [savingBook, setSavingBook] = useState(false);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] =
    useState<QuestionType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editType, setEditType] = useState<QuestionType>("text");
  const [editOptionsText, setEditOptionsText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [updatingShare, setUpdatingShare] = useState(false);
  const loadSurvey = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/login");
      return;
    }

    const { data: surveyData, error: surveyError } = await supabase
      .from("surveys")
      .select("id, owner_id, title, description, is_public, book_id, book_title, book_author, book_cover_id")
      .eq("id", surveyId)
      .single();

    if (surveyError || !surveyData) {
      setErrorMessage("Survey not found, or you don't have permission to view it.");
      setIsLoading(false);
      return;
    }

     if (surveyData.owner_id !== user.id) {
      router.replace(`/surveys/${surveyId}/respond`);
      return;
    }

    setSurvey(surveyData);
    setSelectedBookId(surveyData.book_id ?? "");

    const {data: booksData, error: booksError} = await supabase
      .from("books")
      .select("id, title, author, cover_id")
      .eq("owner_id", user.id)
      .order("title", {ascending: true});

    if (booksError) {
      setErrorMessage(
        "Could not load your library books: " + booksError.message
      );
    } else {
      setLibraryBooks((booksData ?? []) as LibraryBook[]);
    }

    const { data: questionData, error: questionError } = await supabase
      .from("survey_questions")
      .select("id, question_text, question_type, options, position")
      .eq("survey_id", surveyId)
      .order("position", { ascending: true });

    if (questionError) {
      setErrorMessage(questionError.message);
    } else {
      setQuestions((questionData ?? []) as SurveyQuestion[]);
    }

    setIsLoading(false);
  }, [router, surveyId]);

  useEffect(() => {
    void loadSurvey();
  }, [loadSurvey]);
  async function saveLinkedBook() {
  if (!survey || savingBook) return;

  setSavingBook(true);
  setErrorMessage("");
  setSuccessMessage("");

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    setErrorMessage("Please log in again.");
    setSavingBook(false);
    return;
  }

  const selectedBook = libraryBooks.find(
    (book) => book.id === selectedBookId
  );

  const { data, error } = await supabase
    .from("surveys")
    .update({
      book_id: selectedBook?.id ?? null,
      book_title: selectedBook?.title ?? null,
      book_author: selectedBook?.author ?? null,
      book_cover_id: selectedBook?.cover_id ?? null,
    })
    .eq("id", surveyId)
    .eq("owner_id", user.id)
    .select("id, owner_id, title, description, is_public, book_id, book_title, book_author, book_cover_id")
    .single();

  if (error || !data) {
    setErrorMessage(
      error?.message ?? "Could not save the linked book."
    );
    setSavingBook(false);
    return;
  }

  setSurvey(data as Survey);
  setSuccessMessage(
    selectedBookId
      ? "Book linked to your survey!"
      : "Book removed from your survey."
  );
  setSavingBook(false);
}
  async function toggleSharing() {
  if (!survey || updatingShare) return;

  setUpdatingShare(true);
  setErrorMessage("");
  setSuccessMessage("");

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    setErrorMessage("Please log in again.");
    setUpdatingShare(false);
    return;
  }

  const nextIsPublic = !survey.is_public;

  const { error } = await supabase
    .from("surveys")
    .update({ is_public: nextIsPublic })
    .eq("id", surveyId)
    .eq("owner_id", user.id);

  if (error) {
    setErrorMessage(error.message);
    setUpdatingShare(false);
    return;
  }

  setSurvey({
    ...survey,
    is_public: nextIsPublic,
  });

  setSuccessMessage(
    nextIsPublic
      ? "Survey shared! Logged-in users with the link can respond."
      : "Survey is private again."
  );

  setUpdatingShare(false);
}

async function copySurveyLink() {
  const link = `${window.location.origin}/surveys/${surveyId}/respond`;

  try {
    await navigator.clipboard.writeText(link);
    setSuccessMessage("Survey link copied! You can now share it.");
    setErrorMessage("");
  } catch {
    setErrorMessage(
      "Could not copy automatically. Please copy the survey URL from your browser."
    );
  }
}

  function parseOptions(value: string) {
    return value
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean);
  }

  function validateOptions(options: string[]) {
    if (options.length < 2) {
      return "Please enter at least two answer options, one per line.";
    }

    if (
      new Set(options.map((option) => option.toLowerCase())).size !==
      options.length
    ) {
      return "Please remove duplicate answer options.";
    }

    return "";
  }

  async function addQuestion(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const text = questionText.trim();

    if (!text) {
      setErrorMessage("Please enter a question.");
      return;
    }

    const options =
      questionType === "multiple_choice"
        ? parseOptions(optionsText)
        : [];

    if (questionType === "multiple_choice") {
      const validationError = validateOptions(options);
      if (validationError) {
        setErrorMessage(validationError);
        return;
      }
    }

    setSaving(true);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setErrorMessage("Please log in again.");
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("survey_questions")
      .insert({
        survey_id: surveyId,
        owner_id: user.id,
        question_text: text,
        question_type: questionType,
        options,
        position: questions.length,
      })
      .select("id, question_text, question_type, options, position")
      .single();

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setQuestions((current) =>
      [...current, data as SurveyQuestion].sort(
        (a, b) => a.position - b.position
      )
    );

    setQuestionText("");
    setOptionsText("");
    setQuestionType("text");
    setSuccessMessage("Question added successfully!");
    setSaving(false);
  }

  function startEditing(question: SurveyQuestion) {
    setEditingId(question.id);
    setEditText(question.question_text);
    setEditType(question.question_type);
    setEditOptionsText(question.options.join("\n"));
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function saveEdit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editingId) return;

    const text = editText.trim();

    if (!text) {
      setErrorMessage("Please enter a question.");
      return;
    }

    const options =
      editType === "multiple_choice"
        ? parseOptions(editOptionsText)
        : [];

    if (editType === "multiple_choice") {
      const validationError = validateOptions(options);
      if (validationError) {
        setErrorMessage(validationError);
        return;
      }
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { data, error } = await supabase
      .from("survey_questions")
      .update({
        question_text: text,
        question_type: editType,
        options,
      })
      .eq("id", editingId)
      .eq("survey_id", surveyId)
      .select("id, question_text, question_type, options, position")
      .single();

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setQuestions((current) =>
      current.map((question) =>
        question.id === editingId
          ? (data as SurveyQuestion)
          : question
      )
    );

    setEditingId(null);
    setSuccessMessage("Question updated successfully!");
    setSaving(false);
  }

  async function deleteQuestion(question: SurveyQuestion) {
    const confirmed = window.confirm(
      `Delete this question?\n\n"${question.question_text}"\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    setErrorMessage("");
    setSuccessMessage("");
    setSaving(true);

    const { error } = await supabase
      .from("survey_questions")
      .delete()
      .eq("id", question.id)
      .eq("survey_id", surveyId);

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    const remaining = questions
      .filter((item) => item.id !== question.id)
      .map((item, index) => ({ ...item, position: index }));

    const results = await Promise.all(
      remaining.map((item) =>
        supabase
          .from("survey_questions")
          .update({ position: item.position })
          .eq("id", item.id)
          .eq("survey_id", surveyId)
      )
    );

    const failedUpdate = results.find((result) => result.error);

    setQuestions(remaining);
    setEditingId(null);

    if (failedUpdate?.error) {
      setErrorMessage(
        "Question deleted, but the question order could not be fully updated. Please refresh the page."
      );
    } else {
      setSuccessMessage("Question deleted.");
    }

    setSaving(false);
  }

  async function moveQuestion(index: number, direction: -1 | 1) {
    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= questions.length || saving) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setSaving(true);

    const reordered = [...questions];
    [reordered[index], reordered[newIndex]] = [
      reordered[newIndex],
      reordered[index],
    ];

    const updated = reordered.map((question, position) => ({
      ...question,
      position,
    }));

    const results = await Promise.all(
      updated.map((question) =>
        supabase
          .from("survey_questions")
          .update({ position: question.position })
          .eq("id", question.id)
          .eq("survey_id", surveyId)
      )
    );

    const failedUpdate = results.find((result) => result.error);

    if (failedUpdate?.error) {
      setErrorMessage(
        "Could not save the new order. Refresh the page to reload your saved questions."
      );
    } else {
      setQuestions(updated);
      setSuccessMessage("Question order saved.");
    }

    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-[#F8F3EA] px-6 py-12 text-[#4A3B2B]">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/surveys"
          className="text-sm text-[#8B6F47] hover:underline"
        >
          ← Back to my surveys
        </Link>

        {isLoading ? (
          <p className="mt-8">Loading survey...</p>
        ) : !survey ? (
          <div className="mt-8 rounded-2xl border border-[#E5D8C5] bg-white/80 p-6">
            <p>{errorMessage || "Survey could not be loaded."}</p>
          </div>
        ) : (
          <>
            <header className="mb-8 mt-6">
              <p className="mb-2 text-sm uppercase tracking-[0.2em] text-[#8B6F47]">
                The Reading Nook · Survey editor
              </p>
              <h1 className="font-serif text-4xl">{survey.title}</h1>
              {survey.description && (
                <p className="mt-3 text-[#786956]">
                  {survey.description}
                </p>
              )}
            {survey.book_id && (() => {
  const book = libraryBooks.find(
    (item) => item.id === survey.book_id
  );

  if (!book) return null;

  return (
    <div className="mt-5 flex items-center gap-4 rounded-xl bg-[#F0E7D9] p-4">
      {book.cover_id ? (
        <img
          src={`https://covers.openlibrary.org/b/id/${book.cover_id}-M.jpg`}
          alt={`Cover of ${book.title}`}
          className="h-28 w-20 rounded-md object-cover shadow"
        />
      ) : (
        <div className="flex h-28 w-20 items-center justify-center rounded-md bg-[#DCCFBD] text-3xl">
          📚
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-wider text-[#8B6F47]">
          Book linked to this survey
        </p>
        <h2 className="mt-1 font-serif text-xl">{book.title}</h2>
        <p className="mt-1 text-sm text-[#786956]">
          by {book.author}
        </p>
      </div>
    </div>
  );
 })()}
            </header>
            <section className="mb-8 rounded-2xl border border-[#E5D8C5] bg-white/80 p-6">
  <h2 className="font-serif text-2xl">Connect a book</h2>

  <p className="mt-2 text-sm text-[#786956]">
    Choose a book from your personal library to associate
    with this survey. You can change it whenever you like.
  </p>

  <label
    htmlFor="linkedBook"
    className="mt-5 block text-sm font-medium"
  >
    Select a book
  </label>

  <select
    id="linkedBook"
    value={selectedBookId}
    onChange={(event) => setSelectedBookId(event.target.value)}
    className="mt-2 w-full rounded-xl border border-[#DCCFBD] bg-white px-4 py-3"
  >
    <option value="">No book linked</option>

    {libraryBooks.map((book) => (
      <option key={book.id} value={book.id}>
        {book.title} — {book.author}
      </option>
    ))}
  </select>

  {libraryBooks.length === 0 && (
    <p className="mt-2 text-sm text-[#786956]">
      No books were found in your library yet.
    </p>
  )}

  <button
    type="button"
    onClick={() => void saveLinkedBook()}
    disabled={savingBook}
    className="mt-4 rounded-xl bg-[#6D5940] px-5 py-3 font-medium text-white disabled:opacity-50"
  >
    {savingBook ? "Saving..." : "Save linked book"}
  
  </button>
</section>

{libraryBooks.find((book) => book.id === selectedBookId) && (
  <section className="mb-8 rounded-2xl border border-[#E5D8C5] bg-white/80 p-6">
    <h2 className="font-serif text-2xl">Linked book</h2>

    {(() => {
      const book = libraryBooks.find(
        (item) => item.id === selectedBookId
      )!;

      return (
        <div className="mt-4 flex items-start gap-4">
          {book.cover_id ? (
            <img
              src={`https://covers.openlibrary.org/b/id/${book.cover_id}-M.jpg`}
              alt={`Cover of ${book.title}`}
              className="h-36 w-24 rounded-lg object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-36 w-24 items-center justify-center rounded-lg bg-[#EFE5D6] p-2 text-center text-sm text-[#786956]">
              No cover available
            </div>
          )}

          <div>
            <h3 className="font-serif text-xl">{book.title}</h3>
            <p className="mt-1 text-[#786956]">{book.author}</p>
          </div>
        </div>
      );
    })()}
  </section>
)}

<section className="mb-8 rounded-2xl border border-[#E5D8C5] bg-white/80 p-6">
  <h2 className="font-serif text-2xl">Survey sharing</h2>


  <p className="mt-2 text-sm text-[#786956]">
    Your survey is private until you choose to share it.
    Only logged-in users with the link can respond.
  </p>

  <div className="mt-5 flex flex-wrap items-center gap-3">
    <button
      type="button"
      onClick={() => void toggleSharing()}
      disabled={updatingShare}
      className={`rounded-xl px-5 py-3 font-medium text-white disabled:opacity-50 ${
        survey.is_public
          ? "bg-[#8B6F47]"
          : "bg-[#6D5940]"
      }`}
    >
      {updatingShare
        ? "Saving..."
        : survey.is_public
          ? "Make survey private"
          : "Share survey"}
    </button>

    <span
      className={`rounded-full px-3 py-1 text-sm ${
        survey.is_public
          ? "bg-green-100 text-green-800"
          : "bg-[#F0E7D9] text-[#6D5940]"
      }`}
    >
      {survey.is_public ? "Shared" : "Private"}
    </span>
  </div>

  {survey.is_public && (
    <div className="mt-5 rounded-xl bg-[#F8F3EA] p-4">
      <p className="font-medium">Your respondent link</p>

      <p className="mt-2 break-all text-sm text-[#786956]">
        {typeof window !== "undefined"
          ? `${window.location.origin}/surveys/${surveyId}/respond`
          : ""}
      </p>

      <button
        type="button"
        onClick={() => void copySurveyLink()}
        className="mt-3 rounded-lg border border-[#DCCFBD] px-4 py-2 text-sm hover:bg-white"
      >
        Copy survey link
      </button>
            <Link
        href={`/surveys/${surveyId}/responses`}
        className="mt-3 ml-2 inline-block rounded-lg bg-[#6B705C] px-4 py-2 text-sm text-white hover:bg-[#555949]"
      >
        View Responses
      </Link>
    </div>
  )}
 </section>

            <RecommendationsEditor surveyId={surveyId} />

            <section className="mb-8 rounded-2xl border border-[#E5D8C5] bg-white/80 p-6">
              <h2 className="mb-4 font-serif text-2xl">
                Add a question
              </h2>

              <form onSubmit={addQuestion} className="space-y-4">
                <div>
                  <label htmlFor="questionText" className="mb-1 block text-sm font-medium">
                    Your question
                  </label>
                  <textarea
                    id="questionText"
                    value={questionText}
                    onChange={(event) => setQuestionText(event.target.value)}
                    required
                    maxLength={1000}
                    rows={3}
                    placeholder="e.g. What did you think of this book?"
                    className="w-full rounded-xl border border-[#DCCFBD] px-4 py-3 outline-none focus:border-[#8B6F47]"
                  />
                </div>

                <div>
                  <label htmlFor="questionType" className="mb-1 block text-sm font-medium">
                    Answer type
                  </label>
                  <select
                    id="questionType"
                    value={questionType}
                    onChange={(event) =>
                      setQuestionType(event.target.value as QuestionType)
                    }
                    className="w-full rounded-xl border border-[#DCCFBD] bg-white px-4 py-3"
                  >
                    <option value="text">Written answer</option>
                    <option value="multiple_choice">Multiple choice</option>
                  </select>
                </div>

                {questionType === "multiple_choice" && (
                  <div>
                    <label htmlFor="optionsText" className="mb-1 block text-sm font-medium">
                      Answer options (one per line)
                    </label>
                    <textarea
                      id="optionsText"
                      value={optionsText}
                      onChange={(event) => setOptionsText(event.target.value)}
                      required
                      rows={4}
                      placeholder={"Loved it\nIt was okay\nDidn't enjoy it"}
                      className="w-full rounded-xl border border-[#DCCFBD] px-4 py-3"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#6D5940] px-5 py-3 font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Add question"}
                </button>
              </form>
            </section>

            <section>
              <h2 className="mb-4 font-serif text-2xl">
                Your questions ({questions.length})
              </h2>

              {questions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DCCFBD] p-8 text-center">
                  <p className="text-3xl">📝</p>
                  <p className="mt-3">No questions yet. Add your first one above!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <article
                      key={question.id}
                      className="rounded-2xl border border-[#E5D8C5] bg-white/70 p-5"
                    >
                      {editingId === question.id ? (
                        <form onSubmit={saveEdit} className="space-y-4">
                          <label className="block text-sm font-medium">
                            Edit question
                            <textarea
                              value={editText}
                              onChange={(event) => setEditText(event.target.value)}
                              required
                              maxLength={1000}
                              rows={3}
                              className="mt-1 w-full rounded-xl border border-[#DCCFBD] px-4 py-3"
                            />
                          </label>

                          <label className="block text-sm font-medium">
                            Answer type
                            <select
                              value={editType}
                              onChange={(event) =>
                                setEditType(event.target.value as QuestionType)
                              }
                              className="mt-1 w-full rounded-xl border border-[#DCCFBD] bg-white px-4 py-3"
                            >
                              <option value="text">Written answer</option>
                              <option value="multiple_choice">Multiple choice</option>
                            </select>
                          </label>

                          {editType === "multiple_choice" && (
                            <label className="block text-sm font-medium">
                              Answer options (one per line)
                              <textarea
                                value={editOptionsText}
                                onChange={(event) =>
                                  setEditOptionsText(event.target.value)
                                }
                                required
                                rows={4}
                                className="mt-1 w-full rounded-xl border border-[#DCCFBD] px-4 py-3"
                              />
                            </label>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="submit"
                              disabled={saving}
                              className="rounded-xl bg-[#6D5940] px-4 py-2 text-white disabled:opacity-50"
                            >
                              {saving ? "Saving..." : "Save changes"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-xl border border-[#DCCFBD] px-4 py-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <p className="text-xs uppercase tracking-wider text-[#8B6F47]">
                            Question {index + 1}
                          </p>
                          <h3 className="mt-2 font-medium">
                            {question.question_text}
                          </h3>
                          <p className="mt-2 text-sm text-[#786956]">
                            {question.question_type === "text"
                              ? "Written answer"
                              : "Multiple choice"}
                          </p>

                          {question.question_type === "multiple_choice" && (
                            <ul className="mt-3 list-inside list-disc space-y-1 text-sm">
                              {question.options.map((option, optionIndex) => (
                                <li key={`${option}-${optionIndex}`}>{option}</li>
                              ))}
                            </ul>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEditing(question)}
                              disabled={saving}
                              className="rounded-lg border border-[#DCCFBD] px-3 py-2 text-sm hover:bg-[#F8F3EA] disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void moveQuestion(index, -1)}
                              disabled={index === 0 || saving}
                              className="rounded-lg border border-[#DCCFBD] px-3 py-2 text-sm disabled:opacity-40"
                            >
                              ↑ Move up
                            </button>
                            <button
                              type="button"
                              onClick={() => void moveQuestion(index, 1)}
                              disabled={index === questions.length - 1 || saving}
                              className="rounded-lg border border-[#DCCFBD] px-3 py-2 text-sm disabled:opacity-40"
                            >
                              ↓ Move down
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteQuestion(question)}
                              disabled={saving}
                              className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            {(errorMessage || successMessage) && (
              <div className="mt-5" aria-live="polite">
                {errorMessage && (
                  <p role="alert" className="text-sm text-red-700">
                    {errorMessage}
                  </p>
                )}
                {successMessage && (
                  <p className="mt-1 text-sm text-green-800">
                    {successMessage}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function SurveyDetailPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading survey...</main>}>
      <SurveyDetailContent />
    </Suspense>
  );
}