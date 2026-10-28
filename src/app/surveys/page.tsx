
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Survey = {
  id: string;
  title: string;
  description: string | null;
  book_id: string | null;
  is_public: boolean;
  created_at: string;
};

export default function SurveysPage() {
  const router = useRouter();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyDescription, setSurveyDescription] = useState("");
  const [savingSurvey, setSavingSurvey] = useState(false);
  const [formError, setFormError] = useState("");
  const [answeredSurveys, setAnsweredSurveys] = useState<Survey[]>([]);


  const loadSurveys = useCallback(async () => {
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

        const { data, error } = await supabase
      .from("surveys")
      .select("id, title, description, book_id, is_public, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    const mySurveys = data ?? [];
    setSurveys(mySurveys);

    const { data: responseRows } = await supabase
      .from("survey_responses")
      .select("survey_id")
      .eq("respondent_id", user.id);

    const answeredIds = (responseRows ?? [])
      .map((row) => row.survey_id as string)
      .filter((id) => !mySurveys.some((survey) => survey.id === id));

    if (answeredIds.length > 0) {
      const { data: answeredData } = await supabase
        .from("surveys")
        .select("id, title, description, book_id, is_public, created_at")
        .in("id", answeredIds)
        .order("created_at", { ascending: false });

      setAnsweredSurveys(answeredData ?? []);
    } else {
      setAnsweredSurveys([]);
    }

    setIsLoading(false);
  }, [router]);
  
 async function createSurvey(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setFormError("");

  const title = surveyTitle.trim();

  if (!title) {
    setFormError("Please enter a survey title.");
    return;
  }

  setSavingSurvey(true);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    setFormError("Please log in again before creating a survey.");
    setSavingSurvey(false);
    return;
  }

  const { data, error } = await supabase
    .from("surveys")
    .insert({
      owner_id: user.id,
      title,
      description: surveyDescription.trim() || null,
      is_public: false,
    })
    .select("id, title, description, book_id, is_public, created_at")
    .single();

  if (error) {
    setFormError(error.message);
    setSavingSurvey(false);
    return;
  }

  setSurveys((current) => [data, ...current]);
  setSurveyTitle("");
  setSurveyDescription("");
  setShowCreateForm(false);
  setSavingSurvey(false);
 }


  useEffect(() => {
    void loadSurveys();
  }, [loadSurveys]);

  return (
    <main className="min-h-screen bg-[#F8F3EA] px-6 py-12 text-[#4A3B2B]">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="text-sm text-[#8B6F47] hover:underline"
        >
          ← Back to my bookshelf
        </Link>

        <header className="mb-8 mt-6">
          <p className="mb-2 text-sm uppercase tracking-[0.2em] text-[#8B6F47]">
            The Reading Nook
          </p>
          <h1 className="font-serif text-4xl">My Book Surveys</h1>
          <p className="mt-3 max-w-xl text-[#786956]">
            A little corner for bookish questions, reading
            discussions, and sharing thoughts about stories.
          </p>
        </header>

        
<div className="mb-6">
  <button
    type="button"
    onClick={() => {
      setShowCreateForm((current) => !current);
      setFormError("");
    }}
    className="rounded-xl bg-[#6D5940] px-5 py-3 font-medium text-white transition hover:bg-[#584630]"
  >
    {showCreateForm ? "Cancel" : "+ Create a survey"}
  </button>
</div>

{showCreateForm && (
  <form
    onSubmit={createSurvey}
    className="mb-6 space-y-4 rounded-2xl border border-[#E5D8C5] bg-white/80 p-6"
  >
    <h2 className="font-serif text-2xl">New survey</h2>

    <div>
      <label
        htmlFor="surveyTitle"
        className="mb-1 block text-sm font-medium"
      >
        Survey title
      </label>
      <input
        id="surveyTitle"
        value={surveyTitle}
        onChange={(event) => setSurveyTitle(event.target.value)}
        required
        maxLength={150}
        placeholder="e.g. My favourite fantasy books"
        className="w-full rounded-xl border border-[#DCCFBD] px-4 py-3 outline-none focus:border-[#8B6F47]"
      />
    </div>

    <div>
      <label
        htmlFor="surveyDescription"
        className="mb-1 block text-sm font-medium"
      >
        Description (optional)
      </label>
      <textarea
        id="surveyDescription"
        value={surveyDescription}
        onChange={(event) => setSurveyDescription(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Tell readers what your survey is about..."
        className="w-full rounded-xl border border-[#DCCFBD] px-4 py-3 outline-none focus:border-[#8B6F47]"
      />
    </div>

    {formError && (
      <p role="alert" className="text-sm text-red-700">
        {formError}
      </p>
    )}

    <button
      type="submit"
      disabled={savingSurvey}
      className="rounded-xl bg-[#6D5940] px-5 py-3 font-medium text-white disabled:opacity-50"
    >
      {savingSurvey ? "Saving..." : "Save survey"}
    </button>
  </form>
  )}

        {isLoading ? (
          <div className="rounded-2xl border border-[#E5D8C5] bg-white/70 p-8 text-center">
            Loading your surveys...
          </div>
        ) : errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-white p-6">
            <p className="font-medium">Couldn't load your surveys.</p>
            <p className="mt-2 text-sm">{errorMessage}</p>
            <button
              onClick={() => void loadSurveys()}
              className="mt-4 rounded-xl bg-[#6D5940] px-4 py-2 text-white"
            >
              Try again
            </button>
          </div>
        ) : surveys.length === 0 ? (
          <section className="rounded-2xl border border-[#E5D8C5] bg-white/70 p-8 text-center">
            <div className="mb-4 text-4xl">📝</div>
            <h2 className="font-serif text-2xl">
              Your survey collection starts here
            </h2>
            <p className="mt-3 text-[#786956]">
              No surveys yet. We'll add the survey creator next!
            </p>
          </section>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {surveys.map((survey) => (
              <Link
                key={survey.id}
                href={`/surveys/${survey.id}`}
                className="block rounded-2xl border border-[#E5D8C5] bg-white/80 p-5 transition hover:border-[#8B6F47] hover:shadow-md"
              >
                <h2 className="font-serif text-xl">{survey.title}</h2>
                {survey.description && (
                  <p className="mt-2 text-sm text-[#786956]">
                    {survey.description}
                  </p>
                )}
                <p className="mt-3 text-sm text-[#8B6F47]">
                  Open survey →
                </p>
              </Link>
            ))}
          </div>
        )}
      

        {!isLoading && !errorMessage && answeredSurveys.length > 0 && (
          <section className="mt-12">
            <h2 className="font-serif text-2xl">Surveys I&apos;ve answered</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {answeredSurveys.map((survey) => (
                <Link
                  key={survey.id}
                  href={`/surveys/${survey.id}/respond`}
                  className="block rounded-2xl border border-[#E5D8C5] bg-white/80 p-5 transition hover:border-[#8B6F47] hover:shadow-md"
                >
                  <h3 className="font-serif text-xl">{survey.title}</h3>
                  {survey.description && (
                    <p className="mt-2 text-sm text-[#786956]">
                      {survey.description}
                    </p>
                  )}
                  <p className="mt-3 text-sm text-[#8B6F47]">View survey →</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
