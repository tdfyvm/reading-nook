
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SurveyBookHeader from "@/components/SurveyBookHeader";
import { RecommendationsList } from "@/components/Recommendations";


type Question = {
  id: string;
  question_text: string;
  question_type: "text" | "multiple_choice";
  options: string[];
  position: number;
};

type Survey = {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
  is_public: boolean;
  book_title: string |null;
  book_author: string |null;
  book_cover_id: number | null;
};

function RespondToSurveyContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const surveyId = params.id;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const loadSurvey = useCallback(async () => {
    setLoading(true);
    setError("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/login");
      return;
    }

    setUserId(user.id);

    const { data: surveyData, error: surveyError } = await supabase
      .from("surveys")
      .select("id, title, description, owner_id, is_public, book_title, book_author, book_cover_id")
      .eq("id", surveyId)
      .single();

    if (surveyError || !surveyData) {
      setError("Survey not found or you don't have permission to view it.");
      setLoading(false);
      return;
    }

    const surveyRecord = surveyData as Survey;
    setSurvey(surveyRecord);

    if (!surveyRecord.is_public) {
      setError("This survey has not been shared by its creator yet.");
      setLoading(false);
      return;
    }

    const { data: existingResponse, error: responseError } =
      await supabase
        .from("survey_responses")
        .select("id")
        .eq("survey_id", surveyId)
        .eq("respondent_id", user.id)
        .maybeSingle();

    if (responseError) {
      setError(responseError.message);
      setLoading(false);
      return;
    }

    if (existingResponse) {
      setAlreadySubmitted(true);
      setLoading(false);
      return;
    }

    const { data: questionData, error: questionError } = await supabase
      .from("survey_questions")
      .select("id, question_text, question_type, options, position")
      .eq("survey_id", surveyId)
      .order("position", { ascending: true });

    if (questionError) {
      setError(questionError.message);
    } else {
      setQuestions((questionData ?? []) as Question[]);
    }

    setLoading(false);
  }, [router, surveyId]);

  useEffect(() => {
    void loadSurvey();
  }, [loadSurvey]);

  async function submitAnswers(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    if (!survey || !userId) return;

    if (questions.some((question) => !answers[question.id]?.trim())) {
      setError("Please answer every question before submitting.");
      return;
    }

    for (const question of questions) {
      if (
        question.question_type === "multiple_choice" &&
        !question.options.includes(answers[question.id])
      ) {
        setError("Please select a valid option for each multiple-choice question.");
        return;
      }
    }

    setSubmitting(true);

    const { data: response, error: responseError } = await supabase
      .from("survey_responses")
      .insert({
        survey_id: survey.id,
        respondent_id: userId,
      })
      .select("id")
      .single();

    if (responseError || !response) {
      setError(
        responseError?.code === "23505"
          ? "You have already submitted a response to this survey."
          : responseError?.message ?? "Could not save your response."
      );
      setSubmitting(false);
      return;
    }

    const answerRows = questions.map((question) => ({
      response_id: response.id,
      question_id: question.id,
      answer_text: answers[question.id].trim(),
    }));

    const { error: answersError } = await supabase
      .from("survey_answers")
      .insert(answerRows);

    if (answersError) {
      // Avoid leaving a partial submission behind.
      await supabase
        .from("survey_responses")
        .delete()
        .eq("id", response.id);

      setError(
        "Your answers could not be saved. Please try submitting again. " +
          answersError.message
      );
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
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

        {loading ? (
          <p className="mt-8">Loading survey...</p>
        ) : error && !survey ? (
          <p role="alert" className="mt-8 text-red-700">{error}</p>
        ) : survey && !survey.is_public ? (
          <p role="alert" className="mt-8">{error}</p>
        ) : survey && alreadySubmitted ? (
          <section className="mt-8 rounded-2xl border border-[#E5D8C5] bg-white/80 p-8 text-center">
            <h1 className="font-serif text-3xl">Already completed</h1>
            <p className="mt-3">You've already submitted a response to this survey.</p>
            <Link
  href={`/surveys/${surveyId}/summary`}
  className="mt-5 inline-block rounded-xl bg-[#6D5940] px-5 py-3 font-medium text-white"
>
  See all responses
</Link>
          </section>
        ) : survey && success ? (
          <section className="mt-8 rounded-2xl border border-[#E5D8C5] bg-white/80 p-8 text-center">
            <p className="text-4xl">📚</p>
            <h1 className="mt-3 font-serif text-3xl">Thank you!</h1>
            <p className="mt-3">Your answers have been saved successfully.</p>
            <Link
  href={`/surveys/${surveyId}/summary`}
  className="mt-5 inline-block rounded-xl bg-[#6D5940] px-5 py-3 font-medium text-white"
>
  See all responses
</Link>
          </section>
        ) : survey ? (
          <>

            <div className="mt-6">
              <SurveyBookHeader
                title={survey.book_title}
                author={survey.book_author}
                coverId={survey.book_cover_id}
                />
            </div>

            <header className="mb-8 mt-6">
              <p className="mb-2 text-sm uppercase tracking-[0.2em] text-[#8B6F47]">
                The Reading Nook · Survey
              </p>
              <h1 className="font-serif text-4xl">{survey.title}</h1>
              {survey.description && (
                <p className="mt-3 text-[#786956]">{survey.description}</p>
              )}
            </header>

            {error && (
              <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>
            )}

            {questions.length === 0 ? (
              <p>This survey doesn't have any questions yet.</p>
            ) : (
              <form onSubmit={submitAnswers} className="space-y-5">
                {questions.map((question, index) => (
                  <section
                    key={question.id}
                    className="rounded-2xl border border-[#E5D8C5] bg-white/80 p-6"
                  >
                    <label className="block font-medium">
                      <span className="mb-2 block text-xs uppercase tracking-wider text-[#8B6F47]">
                        Question {index + 1}
                      </span>
                      {question.question_text}
                    </label>

                    {question.question_type === "text" ? (
                      <textarea
                        value={answers[question.id] ?? ""}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [question.id]: event.target.value,
                          }))
                        }
                        required
                        maxLength={5000}
                        rows={4}
                        className="mt-3 w-full rounded-xl border border-[#DCCFBD] px-4 py-3 outline-none focus:border-[#8B6F47]"
                        placeholder="Write your answer..."
                      />
                    ) : (
                      <div className="mt-4 space-y-3">
                        {question.options.map((option, optionIndex) => (
                          <label
                            key={`${question.id}-${optionIndex}`}
                            className="flex items-center gap-3"
                          >
                            <input
                              type="radio"
                              name={question.id}
                              value={option}
                              checked={answers[question.id] === option}
                              onChange={() =>
                                setAnswers((current) => ({
                                  ...current,
                                  [question.id]: option,
                                }))
                              }
                              required
                              className="accent-[#6D5940]"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    )}
                  </section>
                ))}

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#6D5940] px-6 py-3 font-medium text-white disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit answers"}
                </button>
              </form>
            )}

            <RecommendationsList surveyId={surveyId} />
          </>
        ) : (
          <p className="mt-8">Survey unavailable.</p>
        )}
      </div>
    </main>
  );
}

export default function RespondToSurveyPage() {
  return(
    <Suspense fallback={<main className="p-8">Loading survey...</main>}>
      <RespondToSurveyContent />
    </Suspense>
  );
}