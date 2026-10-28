"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SurveyQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  position: number;
};

type SurveyResponse = {
  id: string;
  respondent_id: string;
  submitted_at: string;
};

type SurveyAnswer = {
  id: string;
  response_id: string;
  question_id: string;
  answer_text: string;
};

function SurveyResponsesContent() {
  const params = useParams();
  const surveyId = params.id as string;

  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [answers, setAnswers] = useState<SurveyAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadResponses() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Please sign in to view survey responses.");
        setLoading(false);
        return;
      }

      const { data: survey, error: surveyError } = await supabase
        .from("surveys")
        .select("id, title, owner_id")
        .eq("id", surveyId)
        .single();

      if (surveyError || !survey) {
        setError(
          "Survey not found, or you don't have permission to view it."
        );
        setLoading(false);
        return;
      }

      if (survey.owner_id !== user.id) {
        setError("Only the survey author can view these responses.");
        setLoading(false);
        return;
      }

      setTitle(survey.title);

      const { data: questionData, error: questionError } = await supabase
        .from("survey_questions")
        .select("id, question_text, question_type, position")
        .eq("survey_id", surveyId)
        .order("position", { ascending: true });

      if (questionError) {
        setError(
          "Couldn't load the survey questions: " + questionError.message
        );
        setLoading(false);
        return;
      }

      const { data: responseData, error: responseError } = await supabase
        .from("survey_responses")
        .select("id, respondent_id, submitted_at")
        .eq("survey_id", surveyId)
        .order("submitted_at", { ascending: false });

      if (responseError) {
        setError("Couldn't load responses: " + responseError.message);
        setLoading(false);
        return;
      }

      const responseIds = (responseData ?? []).map(
        (response) => response.id
      );

      let answerData: SurveyAnswer[] = [];

      if (responseIds.length > 0) {
        const { data, error: answerError } = await supabase
          .from("survey_answers")
          .select("id, response_id, question_id, answer_text")
          .in("response_id", responseIds);

        if (answerError) {
          setError("Couldn't load answers: " + answerError.message);
          setLoading(false);
          return;
        }

        answerData = data ?? [];
      }

      setQuestions(questionData ?? []);
      setResponses(responseData ?? []);
      setAnswers(answerData);
      setLoading(false);
    }

    if (surveyId) {
      void loadResponses();
    }
  }, [surveyId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F3EB] px-5 py-16 text-[#354638]">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#8A927B]">
            The Reading Nook
          </p>
          <h1 className="mt-5 font-serif text-3xl">
            Gathering your responses...
          </h1>
          <p className="mt-3 text-[#777568]">
            Just a moment while we open your survey journal.
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#F7F3EB] px-5 py-12 text-[#354638]">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#E5DCCB] bg-[#FFFCF6] p-7 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#B46D51]">
            The Reading Nook
          </p>
          <h1 className="mt-4 font-serif text-3xl">
            Responses unavailable
          </h1>
          <p className="mt-3 leading-7 text-[#777568]">{error}</p>
          <Link
            href={`/surveys/${surveyId}`}
            className="mt-6 inline-flex rounded-full bg-[#405543] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#304331]"
          >
            ← Back to survey
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F3EB] px-4 py-8 text-[#354638] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-9">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href={`/surveys/${surveyId}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#68765D] transition hover:text-[#354638]"
            >
              <span aria-hidden="true">←</span>
              Back to survey editor
            </Link>

            <span className="rounded-full border border-[#D9DFCF] bg-[#E9EDE2] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#52664D]">
              Author's journal
            </span>
          </div>

          <div className="mt-10 border-b border-[#DED5C5] pb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#B46D51]">
              The Reading Nook
            </p>

            <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
              Survey responses
            </h1>

            <p className="mt-4 max-w-2xl font-serif text-xl leading-relaxed text-[#777568]">
              {title}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#405543] font-serif text-2xl text-[#FFF9EF]">
                {responses.length}
              </div>

              <div>
                <p className="font-semibold text-[#354638]">
                  {responses.length === 1
                    ? "Reader's response"
                    : "Readers' responses"}
                </p>
                <p className="mt-1 text-sm text-[#777568]">
                  {responses.length === 0
                    ? "Your first response is still to come."
                    : `${responses.length} ${
                        responses.length === 1
                          ? "submission"
                          : "submissions"
                      } received`}
                </p>
              </div>
            </div>
          </div>
        </header>

        {responses.length === 0 ? (
          <section className="rounded-3xl border border-[#E5DCCB] bg-[#FFFCF6] px-6 py-14 text-center shadow-sm sm:px-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E9EDE2] text-3xl">
              ♡
            </div>

            <h2 className="mt-6 font-serif text-2xl">
              A fresh page awaits
            </h2>

            <p className="mx-auto mt-3 max-w-md leading-7 text-[#777568]">
              Nobody has responded to this survey yet. Share your survey
              link with readers, and their answers will find their way here.
            </p>

            <Link
              href={`/surveys/${surveyId}`}
              className="mt-7 inline-flex rounded-full bg-[#405543] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#304331]"
            >
              Return to your survey
            </Link>
          </section>
        ) : (
          <div className="space-y-7">
            {responses.map((response, index) => (
              <article
                key={response.id}
                className="overflow-hidden rounded-3xl border border-[#E4DACA] bg-[#FFFCF6] shadow-[0_5px_20px_rgba(64,60,43,0.04)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E9E1D4] bg-[#F0EEE4] px-5 py-5 sm:px-7">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#405543] font-serif text-xl text-white">
                      {responses.length - index}
                    </div>

                    <div>
                      <h2 className="font-serif text-xl text-[#354638]">
                        Response {responses.length - index}
                      </h2>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-[#8A806F]">
                        Reader submission
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#DED5C5] bg-[#FFFCF6] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#9A8B76]">
                      Submitted on
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#52664D]">
                      {new Date(response.submitted_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-5 px-5 py-6 sm:px-7 sm:py-7">
                  {questions.length === 0 ? (
                    <p className="text-sm italic text-[#777568]">
                      This survey has no questions to display.
                    </p>
                  ) : (
                    questions.map((question, questionIndex) => {
                      const answer = answers.find(
                        (item) =>
                          item.response_id === response.id &&
                          item.question_id === question.id
                      );

                      return (
                        <div key={question.id}>
                          <div className="mb-3 flex items-start gap-3">
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E9EDE2] text-xs font-semibold text-[#52664D]">
                              {questionIndex + 1}
                            </span>

                            <h3 className="pt-1 font-serif text-lg leading-snug text-[#354638]">
                              {question.question_text}
                            </h3>
                          </div>

                          <div className="ml-10 rounded-2xl border-l-[3px] border-[#B46D51] bg-[#F7F3EB] px-4 py-4 sm:px-5">
                            <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-[#625F52]">
                              {answer?.answer_text || "No answer provided"}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center gap-2 border-t border-[#E9E1D4] px-5 py-4 text-xs text-[#8A806F] sm:px-7">
                  <span className="text-[#B46D51]" aria-hidden="true">
                    ✦
                  </span>
                  <span>Thank you for taking the time to share your thoughts.</span>
                </div>
              </article>
            ))}
          </div>
        )}

        <footer className="py-10 text-center">
          <p className="font-serif text-lg italic text-[#8A806F]">
            Every reader has a story to tell.
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#A49A88]">
            The Reading Nook
          </p>
        </footer>
      </div>
    </main>
  );
}

export default function SurveyResponsesPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading survey...</main>}>
      <SurveyResponsesContent />
    </Suspense>
  );
}