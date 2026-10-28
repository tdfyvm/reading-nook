"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SurveyBookHeader from "@/components/SurveyBookHeader";

type SummaryQuestion = {
  id: string;
  question_text: string;
  question_type: "text" | "multiple_choice";
  options: string[];
  answers: string[];
};

type Summary = {
  total_responses: number;
  questions: SummaryQuestion[];
};

type SurveyInfo = {
  title: string;
  description: string | null;
  book_title: string | null;
  book_author: string | null;
  book_cover_id: number | null;
};

function SummaryContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const surveyId = params.id;

  const [summary, setSummary] = useState<Summary | null>(null);
  const [survey, setSurvey] = useState<SurveyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

      const { data, error: rpcError } = await supabase.rpc(
        "get_survey_summary",
        { p_survey_id: surveyId }
      );

      if (cancelled) return;

      if (rpcError || !data) {
        setError(
          "You can only see the summary of surveys you have answered."
        );
        setLoading(false);
        return;
      }

      setSummary(data as Summary);

      const { data: surveyData } = await supabase
        .from("surveys")
        .select("title, description, book_title, book_author, book_cover_id")
        .eq("id", surveyId)
        .maybeSingle();

      if (cancelled) return;

      setSurvey((surveyData as SurveyInfo | null) ?? null);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router, surveyId]);

  return (
    <main className="min-h-screen bg-[#F8F3EA] px-6 py-12 text-[#4A3B2B]">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/surveys"
          className="text-sm text-[#8B6F47] hover:underline"
        >
          ← Back to my surveys
        </Link>

        {loading ? (
          <p className="mt-8">Loading summary...</p>
        ) : error || !summary ? (
          <p role="alert" className="mt-8 text-red-700">
            {error || "Summary unavailable."}
          </p>
        ) : (
          <>
            {survey && (
              <div className="mt-6">
                <SurveyBookHeader
                  title={survey.book_title}
                  author={survey.book_author}
                  coverId={survey.book_cover_id}
                />
              </div>
            )}

            <header className="mb-8 mt-6">
              <p className="mb-2 text-sm uppercase tracking-[0.2em] text-[#8B6F47]">
                The Reading Nook · Survey summary
              </p>
              <h1 className="font-serif text-4xl">
                {survey?.title ?? "Survey summary"}
              </h1>
              <p className="mt-3 text-[#786956]">
                {summary.total_responses}{" "}
                {summary.total_responses === 1 ? "person has" : "people have"}{" "}
                answered this survey. All answers are anonymous.
              </p>
            </header>

            <div className="space-y-5">
              {summary.questions.map((question, index) => (
                <section
                  key={question.id}
                  className="rounded-2xl border border-[#E5D8C5] bg-white/80 p-6"
                >
                  <p className="text-xs uppercase tracking-wider text-[#8B6F47]">
                    Question {index + 1}
                  </p>
                  <h2 className="mt-2 font-medium">
                    {question.question_text}
                  </h2>

                  {question.question_type === "multiple_choice" ? (
                    <div className="mt-4 space-y-3">
                      {question.options.map((option) => {
                        const count = question.answers.filter(
                          (answer) => answer === option
                        ).length;
                        const percent =
                          question.answers.length > 0
                            ? Math.round(
                                (count / question.answers.length) * 100
                              )
                            : 0;

                        return (
                          <div key={option}>
                            <div className="flex justify-between text-sm">
                              <span>{option}</span>
                              <span className="text-[#786956]">
                                {count} ({percent}%)
                              </span>
                            </div>
                            <div className="mt-1 h-3 overflow-hidden rounded-full bg-[#E8DDCC]">
                              <div
                                className="h-full rounded-full bg-[#8A9A78]"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : question.answers.length === 0 ? (
                    <p className="mt-3 text-sm italic text-[#786956]">
                      No answers yet.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {question.answers.map((answer, answerIndex) => (
                        <li
                          key={answerIndex}
                          className="whitespace-pre-wrap rounded-xl border border-[#EEE2D1] bg-[#FAF5ED] p-4 text-sm leading-6"
                        >
                          {answer}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function SurveySummaryPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading summary...</main>}>
      <SummaryContent />
    </Suspense>
  );
}