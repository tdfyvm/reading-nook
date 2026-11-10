"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type PollOption = {
  id: string;
  text: string;
  votes: number | null;
  voters: string[] | null;
};

type Poll = {
  id: string;
  question: string;
  closes_on: string | null;
  created_at: string;
  is_open: boolean;
  my_option_id: string | null;
  show_results: boolean;
  total_votes: number | null;
  options: PollOption[];
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function PollCard({
  poll,
  isOwner,
  choice,
  busy,
  onChoose,
  onVote,
  onClose,
  onDelete,
}: {
  poll: Poll;
  isOwner: boolean;
  choice: string;
  busy: boolean;
  onChoose: (optionId: string) => void;
  onVote: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const canVote = poll.is_open && poll.my_option_id === null;
  const total = poll.total_votes ?? 0;

  return (
    <article className="rounded-xl border border-[#EEE2D1] bg-[#FAF5ED] p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-serif text-lg">{poll.question}</h4>
        <span
          className={`rounded-full px-3 py-1 text-xs ${
            poll.is_open
              ? "bg-green-100 text-green-800"
              : "bg-[#E8E1D4] text-[#75634D]"
          }`}
        >
          {poll.is_open ? "Open" : "Closed"}
        </span>
      </div>

      {poll.closes_on && (
        <p className="mt-1 text-xs text-[#8C7D6A]">
          {poll.is_open ? "Closes" : "Closed"} on {formatDate(poll.closes_on)}
        </p>
      )}

      {canVote && (
        <div className="mt-4 space-y-2">
          {poll.options.map((option) => (
            <label key={option.id} className="flex items-center gap-3 text-sm">
              <input
                type="radio"
                name={`poll-${poll.id}`}
                checked={choice === option.id}
                onChange={() => onChoose(option.id)}
                className="accent-[#65795A]"
              />
              {option.text}
            </label>
          ))}

          <button
            type="button"
            onClick={onVote}
            disabled={busy || !choice}
            className="mt-2 rounded-full bg-[#65795A] px-4 py-2 text-sm text-white hover:bg-[#536849] disabled:opacity-50"
          >
            Submit my answer
          </button>
          <p className="text-xs text-[#8C7D6A]">
            You can&apos;t change your answer afterwards. The club owner can
            see who chose what.
          </p>
        </div>
      )}

      {poll.show_results && (
        <div className="mt-4 space-y-3">
          {poll.options.map((option) => {
            const votes = option.votes ?? 0;
            const percent = total > 0 ? Math.round((votes / total) * 100) : 0;

            return (
              <div key={option.id}>
                <div className="flex justify-between text-sm">
                  <span>
                    {option.text}
                    {poll.my_option_id === option.id && (
                      <span className="ml-2 text-xs text-[#65795A]">
                        (your answer)
                      </span>
                    )}
                  </span>
                  <span className="text-[#8C7D6A]">
                    {votes} ({percent}%)
                  </span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-[#E8DDCC]">
                  <div
                    className="h-full rounded-full bg-[#8A9A78]"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {isOwner && (
                  <p className="mt-1 text-xs text-[#8C7D6A]">
                    {option.voters && option.voters.length > 0
                      ? `Chosen by: ${option.voters.join(", ")}`
                      : "Nobody yet"}
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-xs text-[#8C7D6A]">
            {total} {total === 1 ? "answer" : "answers"} so far
          </p>
        </div>
      )}

      {!poll.show_results && !canVote && (
        <p className="mt-3 text-sm italic text-[#8C7D6A]">
          Results appear once the poll is closed.
        </p>
      )}

      {isOwner && (
        <div className="mt-4 flex gap-4 text-xs">
          {poll.is_open && (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="underline disabled:opacity-50"
            >
              Close poll now
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="text-red-700 underline disabled:opacity-50"
          >
            Delete poll
          </button>
        </div>
      )}
    </article>
  );
}

export default function ClubPolls({
  clubId,
  isOwner,
}: {
  clubId: string;
  isOwner: boolean;
}) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [optionTexts, setOptionTexts] = useState(["", ""]);
  const [closesOn, setClosesOn] = useState("");
  const [choices, setChoices] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc("get_club_polls", {
      p_club_id: clubId,
    });

    if (loadError) {
      setError("Couldn't load the polls: " + loadError.message);
    } else {
      setPolls((data ?? []) as Poll[]);
    }
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, done: string) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setMessage("");

    const { error: actionError } = await action();

    setBusy(false);

    if (actionError) {
      setError(actionError.message);
      await load();
      return false;
    }

    setMessage(done);
    await load();
    return true;
  }

  async function createPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const options = optionTexts.map((text) => text.trim()).filter(Boolean);

    if (!question.trim()) {
      setError("Please enter a question.");
      return;
    }

    if (options.length < 2) {
      setError("Please enter at least two options.");
      return;
    }

    const ok = await run(
      () =>
        supabase.rpc("create_club_poll", {
          p_club_id: clubId,
          p_question: question.trim(),
          p_options: options,
          p_closes_on: closesOn || null,
        }),
      "Poll started! Members will see it on their homepage."
    );

    if (ok) {
      setQuestion("");
      setOptionTexts(["", ""]);
      setClosesOn("");
      setShowForm(false);
    }
  }

  function removeOption(index: number) {
    setOptionTexts((current) => current.filter((_, i) => i !== index));
  }

  const openPolls = polls.filter((poll) => poll.is_open);
  const closedPolls = polls.filter((poll) => !poll.is_open);

  function renderCard(poll: Poll) {
    return (
      <PollCard
        key={poll.id}
        poll={poll}
        isOwner={isOwner}
        choice={choices[poll.id] ?? ""}
        busy={busy}
        onChoose={(optionId) =>
          setChoices((current) => ({ ...current, [poll.id]: optionId }))
        }
        onVote={() =>
          void run(
            () =>
              supabase.rpc("vote_in_poll", {
                p_poll_id: poll.id,
                p_option_id: choices[poll.id],
              }),
            "Thanks, your answer is saved."
          )
        }
        onClose={() => {
          if (window.confirm("Close this poll now? Nobody can answer afterwards.")) {
            void run(
              () => supabase.rpc("close_club_poll", { p_poll_id: poll.id }),
              "Poll closed."
            );
          }
        }}
        onDelete={() => {
          if (window.confirm("Delete this poll and all its answers? This cannot be undone.")) {
            void run(
              () => supabase.rpc("delete_club_poll", { p_poll_id: poll.id }),
              "Poll deleted."
            );
          }
        }}
      />
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-[#E4D9C8] bg-white/80 p-6">
      <h2 className="font-serif text-2xl">Polls</h2>

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

      {isOwner && (
        <div className="mt-4">
          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-full bg-[#65795A] px-5 py-3 text-sm text-white hover:bg-[#536849]"
            >
              + Start a poll
            </button>
          ) : (
            <form
              onSubmit={createPoll}
              className="space-y-4 rounded-xl border border-[#EEE2D1] bg-[#FAF5ED] p-5"
            >
              <label className="block text-sm font-medium">
                Question
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  maxLength={200}
                  placeholder="e.g. What should we read next?"
                  className="mt-1 w-full rounded-xl border border-[#DCCFBD] bg-white px-4 py-3 font-normal outline-none focus:border-[#8B6F47]"
                />
              </label>

              <div>
                <p className="text-sm font-medium">Options</p>
                <div className="mt-1 space-y-2">
                  {optionTexts.map((text, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        value={text}
                        onChange={(event) =>
                          setOptionTexts((current) =>
                            current.map((item, i) =>
                              i === index ? event.target.value : item
                            )
                          )
                        }
                        maxLength={100}
                        placeholder={`Option ${index + 1}`}
                        className="w-full rounded-xl border border-[#DCCFBD] bg-white px-4 py-2 text-sm outline-none focus:border-[#8B6F47]"
                      />
                      {optionTexts.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="text-xs text-red-700 underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {optionTexts.length < 10 && (
                  <button
                    type="button"
                    onClick={() => setOptionTexts((current) => [...current, ""])}
                    className="mt-2 text-sm underline"
                  >
                    + Add an option
                  </button>
                )}
              </div>

              <label className="block text-sm font-medium">
                Closing date (optional)
                <input
                  type="date"
                  value={closesOn}
                  onChange={(event) => setClosesOn(event.target.value)}
                  className="mt-1 block rounded-xl border border-[#DCCFBD] bg-white px-4 py-2 text-sm font-normal"
                />
              </label>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-[#65795A] px-5 py-2 text-sm text-white hover:bg-[#536849] disabled:opacity-50"
                >
                  {busy ? "Starting..." : "Start poll"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-full border border-[#D8CCBA] px-5 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm">Loading polls...</p>
      ) : polls.length === 0 ? (
        <p className="mt-6 text-sm italic text-[#8C7D6A]">
          No polls yet.
        </p>
      ) : (
        <>
          {openPolls.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="font-serif text-xl">Open polls</h3>
              {openPolls.map(renderCard)}
            </div>
          )}

          {closedPolls.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="font-serif text-xl">Closed polls</h3>
              {closedPolls.map(renderCard)}
            </div>
          )}
        </>
      )}
    </section>
  );
}