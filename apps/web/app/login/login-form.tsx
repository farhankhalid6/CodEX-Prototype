"use client";

import { useState, type FormEvent } from "react";
import { IconArrowRight, IconCheck } from "@/components/icons";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;

    setStatus("sending");
    setError(null);

    try {
      const supabase = supabaseBrowser();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });
      if (authError) throw authError;
      setStatus("sent");
    } catch (caught) {
      setStatus("idle");
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not send the sign-in link. Check the Supabase settings.",
      );
    }
  }

  if (status === "sent") {
    return (
      <div className="card p-6 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-success/15 text-success">
          <IconCheck width={20} height={20} />
        </span>
        <h2 className="mt-4 text-lg font-semibold">Check your inbox</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We sent a sign-in link to <span className="text-fg">{email}</span>. Open it on this device
          to reach your dashboard.
        </p>
        <button
          type="button"
          className="btn btn-ghost mt-5 w-full"
          onClick={() => {
            setStatus("idle");
            setEmail("");
          }}
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form className="card p-6" onSubmit={submit}>
      <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Magic link only — no password to forget. Signed-in rooms are saved and get a dashboard with
        search and forks.
      </p>

      <div className="field mt-5">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={status === "sending"}
        />
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn btn-primary mt-5 w-full py-2.5"
        disabled={status === "sending"}
      >
        {status === "sending" ? "Sending…" : "Email me a link"}
        {status === "sending" ? null : <IconArrowRight width={16} height={16} />}
      </button>

      <p className="mt-4 text-center text-xs leading-relaxed text-muted">
        By signing in you agree to keep shared rooms free of abuse. Rate limits apply.
      </p>
    </form>
  );
}
