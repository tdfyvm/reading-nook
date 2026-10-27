
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SupabaseTestPage() {
  const [message, setMessage] = useState("Checking database...");
  
  useEffect(() => {
    async function checkDatabase() {
      const { error } = await supabase
        .from("books")
        .select("id")
        .limit(1);

      if (error) {
        setMessage(`Database returned an error: ${error.message}`);
      } else {
        setMessage("Success! Supabase responded to our books query.");
      }
    }

    checkDatabase();
  }, []);

  return (
    <main className="min-h-screen bg-[#F8F5EE] p-8 text-[#453B32]">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-8">
        <h1 className="font-serif text-3xl">The Reading Nook</h1>
        <h2 className="mt-4 text-xl">Database connection test</h2>
        <p className="mt-4 break-words">{message}</p>
        <a href="/" className="mt-6 inline-block underline">
          Return to bookshelf
        </a>
      </div>
    </main>
  );
}
