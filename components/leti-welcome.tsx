"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Play, RotateCcw, SkipForward, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const LETI_WELCOME_PHRASES = [
  "Olá! Eu sou a Leti.",
  "Seja bem-vindo ao Sistema Leti!",
  "Aqui você acompanha pedidos, lojas e relatórios.",
  "Vamos começar?",
] as const;

export const LETI_WELCOME_AVATAR_SRC = "/leti-avatar.png";
export const LETI_WELCOME_STORAGE_KEY = "leti-welcome-seen";
export const LETI_WELCOME_STEP_MS = 1800;

const CONFETTI_COLORS = ["#f59e0b", "#34d399", "#60a5fa", "#f472b6", "#a78bfa", "#fbbf24"];

function LetiAvatarFallback() {
  return (
    <svg
      viewBox="0 0 360 460"
      role="img"
      aria-label="Leti, avatar do Sistema Leti comemorando"
      className="h-full w-full"
    >
      <rect width="360" height="460" fill="#fff7eb" />
      <g fill="#f59e0b" opacity="0.85">
        <circle cx="52" cy="72" r="5" />
        <circle cx="310" cy="60" r="6" />
        <circle cx="300" cy="300" r="5" />
        <circle cx="60" cy="330" r="4" />
      </g>
      <g stroke="#f472b6" strokeWidth="5" strokeLinecap="round">
        <path d="M118 188 L78 96" />
        <path d="M242 188 L286 92" />
      </g>
      <g fill="#8a5a3b">
        <circle cx="180" cy="150" r="86" />
        <circle cx="112" cy="196" r="34" />
        <circle cx="248" cy="196" r="34" />
        <circle cx="118" cy="252" r="26" />
        <circle cx="242" cy="252" r="26" />
        <circle cx="132" cy="112" r="28" />
        <circle cx="228" cy="112" r="28" />
      </g>
      <ellipse cx="180" cy="158" rx="52" ry="58" fill="#c68642" />
      <path d="M128 128 Q180 74 232 128 Q180 104 128 128 Z" fill="#5b3a29" />
      <g fill="#1f1207">
        <circle cx="158" cy="158" r="7" />
        <circle cx="202" cy="158" r="7" />
      </g>
      <g fill="#ffffff">
        <circle cx="160" cy="155" r="2.4" />
        <circle cx="204" cy="155" r="2.4" />
      </g>
      <path d="M158 186 Q180 206 202 186 Q190 214 180 214 Q170 214 158 186 Z" fill="#7f1d1d" />
      <path d="M166 192 Q180 202 194 192 Q188 206 180 206 Q172 206 166 192 Z" fill="#ffffff" />
      <circle cx="138" cy="180" r="9" fill="#e5988a" opacity="0.8" />
      <circle cx="222" cy="180" r="9" fill="#e5988a" opacity="0.8" />
      <circle cx="226" cy="172" r="6" fill="none" stroke="#d4af37" strokeWidth="4" />
      <path d="M142 258 L218 258 L210 342 L150 342 Z" fill="#ffffff" />
      <g stroke="#e5d5c5" strokeWidth="3">
        <path d="M158 262 L156 338" />
        <path d="M180 262 L180 338" />
        <path d="M202 262 L204 338" />
      </g>
      <path d="M150 342 L210 342 L204 438 L156 438 Z" fill="#5b84b8" />
      <path d="M180 342 L180 438" stroke="#466a96" strokeWidth="4" />
      <ellipse cx="162" cy="444" rx="26" ry="9" fill="#f4a259" />
      <ellipse cx="204" cy="414" rx="26" ry="9" fill="#f4a259" />
    </svg>
  );
}

export const LETI_WELCOME_OPEN_EVENT = "leti-welcome:open";

export function LetiWelcome() {
  const [visible, setVisible] = useState(true);
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState<string>(LETI_WELCOME_PHRASES[0]);
  const [finished, setFinished] = useState(false);
  const [imageError, setImageError] = useState(false);
  const timerRef = useRef<number | null>(null);

  const phrase = LETI_WELCOME_PHRASES[step] ?? LETI_WELCOME_PHRASES[0];

  const confetti = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: `${(i * 37 + 9) % 96}%`,
        delay: `${((i * 13) % 40) / 10}s`,
        duration: `${2.6 + ((i * 7) % 20) / 10}s`,
        size: 5 + ((i * 5) % 7),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: i % 3 === 0,
      })),
    []
  );

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  const start = useCallback(() => {
    setStep(0);
    setTyped("");
    setFinished(false);
    setVisible(true);
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setStep(LETI_WELCOME_PHRASES.length - 1);
      setTyped(LETI_WELCOME_PHRASES[LETI_WELCOME_PHRASES.length - 1]);
      setFinished(true);
    }
  }, []);

  useEffect(() => {
    function onOpen() {
      start();
    }
    window.addEventListener(LETI_WELCOME_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(LETI_WELCOME_OPEN_EVENT, onOpen);
  }, [start]);

  useEffect(() => {
    if (!visible || finished) return;
    setTyped("");
    let char = 0;
    const typeTimer = window.setInterval(() => {
      char += 1;
      setTyped(phrase.slice(0, char));
    }, 34);
    const stepTimer = window.setTimeout(() => {
      if (step < LETI_WELCOME_PHRASES.length - 1) {
        setStep((prev) => prev + 1);
      } else {
        setTyped(phrase);
        setFinished(true);
      }
    }, LETI_WELCOME_STEP_MS);
    timerRef.current = stepTimer;
    return () => {
      window.clearInterval(typeTimer);
      window.clearTimeout(stepTimer);
    };
  }, [visible, step, finished, phrase]);

  useEffect(() => {
    if (!visible) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, close]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Boas-vindas da Leti no Sistema Leti"
      data-testid="leti-welcome"
    >
      <button
        type="button"
        aria-label="Fechar boas-vindas"
        onClick={close}
        className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="w-full max-w-[400px] overflow-hidden rounded-3xl border border-amber-400/40 bg-[#fff7eb] shadow-[0_24px_80px_rgba(245,158,11,0.35)]">
        <div className="flex items-center gap-2 px-4 pt-4" aria-hidden="true">
          {LETI_WELCOME_PHRASES.map((item, index) => (
            <span
              key={item}
              className={cn(
                "h-1.5 flex-1 overflow-hidden rounded-full bg-black/10",
                index < step || finished ? "bg-amber-500" : ""
              )}
            >
              <span
                className={cn(
                  "block h-full rounded-full bg-amber-500 transition-all duration-1000",
                  index === step && !finished ? "w-full" : index < step || finished ? "w-full" : "w-0"
                )}
              />
            </span>
          ))}
        </div>

        <div className="relative mx-4 mt-3 aspect-[4/5] overflow-hidden rounded-2xl bg-[#fff7eb]">
          <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
            {confetti.map((piece) => (
              <span
                key={piece.id}
                className="leti-confetti"
                style={{
                  left: piece.left,
                  width: piece.size,
                  height: piece.size * 1.8,
                  backgroundColor: piece.color,
                  animationDelay: piece.delay,
                  animationDuration: piece.duration,
                  borderRadius: piece.round ? "999px" : "2px",
                }}
              />
            ))}
          </div>

          <div className="leti-avatar-stage absolute inset-0 flex items-end justify-center">
            {imageError ? (
              <LetiAvatarFallback />
            ) : (
              <Image
                src={LETI_WELCOME_AVATAR_SRC}
                alt="Leti, avatar do Sistema Leti comemorando"
                width={400}
                height={500}
                className="leti-avatar h-full w-full object-contain object-bottom"
                onError={() => setImageError(true)}
              />
            )}
          </div>

          <div className="leti-speech absolute inset-x-4 bottom-4 z-20 rounded-2xl bg-white/95 px-4 py-3 text-center shadow-lg">
            <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
              <Sparkles className="h-3.5 w-3.5" />
              Sistema Leti
            </p>
            <p aria-live="polite" className="mt-1 min-h-[3rem] text-base font-bold leading-snug text-zinc-900">
              {typed}
              {!finished && <span className="leti-caret" aria-hidden="true">|</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-4">
          {finished ? (
            <>
              <button
                type="button"
                onClick={start}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                <RotateCcw className="h-4 w-4" />
                Ver de novo
              </button>
              <button
                type="button"
                onClick={close}
                className="inline-flex flex-[2] items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400"
              >
                <Play className="h-4 w-4" />
                Entrar no sistema
              </button>
            </>
          ) : (
            <>
              <span className="flex-1 text-center text-xs font-semibold text-zinc-500">
                A Leti está a chamar…
              </span>
              <button
                type="button"
                onClick={close}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                <SkipForward className="h-4 w-4" />
                Pular
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

