"use client";

import {
  formatTemperatura,
  formatUmidade,
  formatVento,
} from "@/lib/attestations";
import type { Atestado } from "@/lib/types";

/**
 * Lista de atestados notarizados, do mais recente para o mais antigo.
 */
export function HistoricoManejos({
  atestados,
  highlightId,
  onVerCertificado,
}: {
  atestados: Atestado[];
  highlightId: string | null;
  onVerCertificado: (atestado: Atestado) => void;
}) {
  return (
    <section className="rounded-2xl border border-emerald-900/10 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950/70">
      <h2 className="text-lg font-semibold text-emerald-950 dark:text-emerald-50">
        Histórico de Manejos
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Atestados notarizados neste navegador, do mais recente para o mais antigo.
      </p>

      {atestados.length === 0 ? (
        <p className="mt-5 rounded-xl bg-emerald-50/80 px-4 py-4 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          Nenhum atestado registrado ainda. Finalize uma operação aprovada para gerar o primeiro comprovante.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {atestados.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-left dark:border-emerald-900 dark:bg-emerald-950/30 ${
                item.id === highlightId ? "attestation-fade-in" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                    {item.operacao} · {item.cultura}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    {item.producerName} · {item.fazenda} · {item.talhao}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold tracking-wide text-white">
                  ATESTADO VÁLIDO
                </span>
              </div>

              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                    Data / Hora
                  </dt>
                  <dd>{item.recordedAt}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                    Status
                  </dt>
                  <dd>{item.status}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                    Vento
                  </dt>
                  <dd>{formatVento(item.vento)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                    Temperatura
                  </dt>
                  <dd>{formatTemperatura(item.temperatura)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                    Umidade
                  </dt>
                  <dd>{formatUmidade(item.umidade)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                    Hash
                  </dt>
                  <dd className="break-all font-mono text-xs">{item.txHash}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => onVerCertificado(item)}
                className="mt-4 inline-flex rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Ver Certificado
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
