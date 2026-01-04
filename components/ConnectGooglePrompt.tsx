"use client";

import { signIn } from "next-auth/react";

export function ConnectGooglePrompt() {
  const handleSignIn = () => {
    void signIn("google");
  };

  return (
    <section className="card-surface flex flex-col gap-4 p-6 text-center">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Google Tasks</p>
        <h2 className="text-2xl font-semibold text-slate-900">Connect your account</h2>
      </div>
      <p className="text-sm text-slate-600">
        Sign in with your Google account to let TaskPulse sync and triage your tasks into the right
        lists with urgency insights.
      </p>
      <button
        type="button"
        onClick={handleSignIn}
        className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
      >
        Continue with Google
      </button>
    </section>
  );
}
