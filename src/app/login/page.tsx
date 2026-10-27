"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [isSigningUp, setIsSigningUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      if (isSigningUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setMessage(
            "Your account has been created! Check your email for a confirmation link, then return here to sign in."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push("/");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F5EE] px-4 py-12 text-[#453B32]">
      <div className="mx-auto max-w-md">
        <a href="/" className="text-sm text-[#7A6A58] hover:underline">
          ← Back to the bookshelf
        </a>

        <section className="mt-8 rounded-3xl border border-[#E8DFD1] bg-[#FFFEFA] p-8 shadow-sm sm:p-10">
          <div className="mb-6 text-center">
            <div className="mb-3 text-4xl" aria-hidden="true">
              📚
            </div>
            <p className="text-sm uppercase tracking-[0.2em] text-[#947B60]">
              The Reading Nook
            </p>
            <h1 className="mt-3 font-serif text-3xl">
              {isSigningUp ? "Create your nook" : "Welcome back"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#7A6A58]">
              {isSigningUp
                ? "Make a little space for all the stories you love."
                : "Your books, notes, and reading journey are waiting."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[#DED3C3] bg-white px-4 py-3 outline-none transition focus:border-[#92785C] focus:ring-2 focus:ring-[#92785C]/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={isSigningUp ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded-xl border border-[#DED3C3] bg-white px-4 py-3 outline-none transition focus:border-[#92785C] focus:ring-2 focus:ring-[#92785C]/20"
              />
            </div>

            {message && (
              <p
                role="status"
                className="rounded-xl bg-[#F3EDE2] p-3 text-sm leading-6"
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-[#6D7857] px-4 py-3 font-medium text-white transition hover:bg-[#596448] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading
                ? "Please wait..."
                : isSigningUp
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#7A6A58]">
            {isSigningUp ? "Already have an account?" : "New to the Nook?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsSigningUp(!isSigningUp);
                setMessage("");
              }}
              className="font-semibold text-[#596448] underline underline-offset-4"
            >
              {isSigningUp ? "Sign in" : "Create an account"}
            </button>
          </p>
        </section>

        <p className="mt-6 text-center text-xs leading-5 text-[#947B60]">
          A quiet little corner for your reading life.
        </p>
      </div>
    </main>
  );
}