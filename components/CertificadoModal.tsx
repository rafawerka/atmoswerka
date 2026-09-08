"use client";

import { useEffect, useState } from "react";
import type { Atestado } from "@/lib/types";
import { explorerTxUrl, formatTxHash } from "@/lib/solana";

/**
 * Modal do certificado imutável de boas práticas (impressão A4).
 */
export function CertificadoModal({
  atestado,
  onClose,
}: {
  atestado: Atestado;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  async function copyHash() {
    try {
      await navigator.clipboard.writeText(atestado.txHash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const vento = atestado.vento.toFixed(1) + " km/h";
  const temperatura = atestado.temperatura.toFixed(1) + "°C";
  const umidade = atestado.umidade.toFixed(0) + "%";
  const chuva =
    typeof atestado.chuva === "number"
      ? atestado.chuva.toFixed(0) + "%"
      : "Não registrada";

  return (
    <div
      id="modal-certificado-print"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="certificate-title"
        className="font-sans max-h-[min(92vh,900px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#30363d] bg-[#161b22] text-[#c9d1d9] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-6 py-7 sm:px-10">
          <div className="no-print flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#14F195]/40 bg-[#14F195]/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-[#14F195] uppercase">
              <LockIcon />
              Verificado On-Chain na Solana
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm text-[#c9d1d9] hover:bg-zinc-800"
            >
              Fechar
            </button>
          </div>

          <p className="mt-6 text-[11px] font-medium tracking-[0.22em] text-[#8b949e] uppercase">
            Conformidade agronômica
          </p>
          <h2
            id="certificate-title"
            className="mt-2 text-2xl leading-snug font-semibold text-white sm:text-[1.65rem]"
          >
            Certificado Imutável de Boas Práticas - Atmoswerka
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#14F195] px-2.5 py-0.5 text-[11px] font-semibold text-zinc-950">
              Aprovado
            </span>
            <span className="text-sm text-[#c9d1d9]">
              {atestado.operacao} em {atestado.cultura}
            </span>
          </div>

          <dl className="mt-8 grid gap-4 border-y border-[#30363d] py-5 sm:grid-cols-2">
            <Field label="Nome do produtor" value={atestado.producerName} />
            <Field label="Fazenda" value={atestado.fazenda} />
            <Field label="Talhão" value={atestado.talhao} />
            <Field label="Data / Hora" value={atestado.recordedAt} />
          </dl>

          <p className="text-[11px] font-medium tracking-[0.18em] text-[#8b949e] uppercase">
            Métricas auditadas
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCell label="Vento" value={vento} />
            <MetricCell label="Temperatura" value={temperatura} />
            <MetricCell label="Umidade" value={umidade} />
            <MetricCell label="Prob. de chuva" value={chuva} />
          </dl>

          <div className="mt-8 rounded-xl border border-[#14F195] bg-zinc-950/50 px-4 py-4">
            <p className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] text-[#14F195] uppercase">
              <LockIcon />
              Chave criptográfica
            </p>
            <p className="mt-2 font-mono text-lg tracking-wide text-white">
              {formatTxHash(atestado.txHash)}
            </p>
            <p
              className="mt-1 font-mono text-[10px] text-[#8b949e]"
              style={{ wordBreak: "break-all" }}
            >
              {atestado.txHash}
            </p>
            <div className="no-print mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyHash()}
                className="rounded-lg bg-[#14F195] px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-[#3dffb0]"
              >
                {copied ? "Hash copiada" : "Copiar Hash"}
              </button>
              <a
                href={explorerTxUrl(atestado.txHash)}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-[#30363d] px-3 py-2 text-xs font-semibold text-[#c9d1d9] hover:border-[#14F195] hover:text-white"
              >
                Abrir no Solana Explorer
              </a>
            </div>
          </div>

          <div className="no-print mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border border-[#30363d] px-5 py-2.5 text-sm font-semibold text-white hover:border-[#14F195]"
            >
              Baixar / Imprimir Certificado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium tracking-[0.16em] text-[#8b949e] uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-white">{value}</dd>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#30363d] bg-zinc-950/40 px-3 py-3">
      <dt className="text-[10px] font-medium tracking-wide text-[#8b949e] uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-white">{value}</dd>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
