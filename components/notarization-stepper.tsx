"use client";

export type NotarizeStep = 1 | 2 | 3 | 4;

const STEPS = [
  "Validando Telemetria Climática e GPS",
  "Gerando Hash do Payload Criptográfico",
  "Registrando no Bloco Solana Devnet",
] as const;

/**
 * Stepper visual das 3 etapas de notarização na Solana.
 */
export function NotarizationStepper({
  step,
}: {
  step: NotarizeStep;
}) {
  return (
    <section className="rounded-2xl border border-[#30363d] bg-[#161b22] p-5 text-[#c9d1d9] shadow-sm">
      <p className="text-[11px] font-medium tracking-[0.18em] text-[#8b949e] uppercase">
        Progresso da notarização
      </p>
      <ol className="mt-4 flex flex-col gap-3">
        {STEPS.map((label, index) => {
          const number = (index + 1) as 1 | 2 | 3;
          const complete = step === 4 || step > number;
          const active = step === number && step < 4;

          return (
            <li key={label} className="flex items-center gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  complete
                    ? "check-pop border-[#14F195] bg-[#14F195] text-zinc-950"
                    : active
                      ? "border-[#14F195] text-[#14F195]"
                      : "border-[#30363d] text-[#8b949e]"
                }`}
              >
                {complete ? (
                  <CheckIcon />
                ) : active ? (
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#14F195]/25 border-t-[#14F195]"
                    aria-hidden
                  />
                ) : (
                  number
                )}
              </span>
              <span
                className={`text-sm ${
                  complete
                    ? "font-medium text-white"
                    : active
                      ? "text-white"
                      : "text-[#8b949e]"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      {step === 4 ? (
        <p className="check-pop mt-4 text-sm font-medium text-[#14F195]">
          Atestado registrado on-chain.
        </p>
      ) : null}
    </section>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

/** Aguarda `ms` no cliente para animar o stepper. */
export function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
