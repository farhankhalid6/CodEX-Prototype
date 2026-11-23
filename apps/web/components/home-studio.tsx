"use client";

import { useState } from "react";
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from "@codex/shared";
import { CreateRoomForm } from "@/components/create-room-form";
import { JoinRoomForm } from "@/components/join-room-form";

interface Props {
  signedIn: boolean;
  defaultName?: string | null;
}

export function HomeStudio({ signedIn, defaultName }: Props) {
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);

  return (
    <main id="top" className="flex flex-1 items-center">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-14">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <section className="flex flex-col gap-6 lg:col-span-5">
            <div className="flex flex-col gap-2">
              <h1 className="font-display text-[32px] leading-[1.1] tracking-tight text-studio-fg text-balance md:text-[48px]">
                Code together in seconds.
              </h1>
              <p className="max-w-prose text-[15px] leading-relaxed text-studio-muted text-pretty">
                Spin up an ephemeral room in {LANGUAGES.length} languages, chat with your team, and
                push or pull code when you are ready.
              </p>
            </div>

            <JoinRoomForm />
          </section>

          <section className="lg:col-span-7">
            <CreateRoomForm
              signedIn={signedIn}
              defaultName={defaultName}
              language={language}
              onLanguageChange={setLanguage}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
