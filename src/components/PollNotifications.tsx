"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type OpenPoll = {
  poll_id: string;
  club_id: string;
  club_name: string;
  question: string;
  closes_on: string | null;
};

export default function PollNotifications() {
  const [polls, setPolls] = useState<OpenPoll[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase.rpc("get_my_open_polls");
      if (cancelled || error) return;
      setPolls((data ?? []) as OpenPoll[]);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (polls.length === 0) return null;

  return (
    <section className="mb-8 rounded-2xl border border-[#D9C9A8] bg-[#FFFAEE] p-5">
      <h3 className="font-serif text-xl">
        {polls.length === 1 ? "A poll is waiting" : `${polls.length} polls are waiting`}
      </h3>
      <ul className="mt-3 space-y-2">
        {polls.map((poll) => (
          <li
            key={poll.poll_id}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span>
              <strong>{poll.club_name}:</strong> {poll.question}
            </span>
            <Link
              href={`/book-clubs/${poll.club_id}`}
              className="rounded-full bg-[#65795A] px-4 py-2 text-white hover:bg-[#536849]"
            >
              Answer →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}