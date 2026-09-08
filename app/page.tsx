"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  checkWeatherConditions,
  type WeatherCheckResult,
} from "@/lib/agronomy";
import {
  createAttestation,
  DEFAULT_FAZENDA,
  DEFAULT_PRODUCER_NAME,
  DEFAULT_TALHAO,
  formatChuva,
  formatTemperatura,
  formatUmidade,
  formatVento,
  loadAttestations,
  loadProfile,
  saveAttestations,
  saveProfile,
} from "@/lib/attestations";
import { CULTURAS, OPERACOES, type Atestado, type Cultura, type OperacaoManejo } from "@/lib/types";
import { WalletButton } from "@/components/wallet-button";
import { CertificadoModal } from "@/components/CertificadoModal";
import { HistoricoManejos } from "@/components/HistoricoManejos";
import {
  NotarizationStepper,
  wait,
  type NotarizeStep,
} from "@/components/notarization-stepper";
import {
  buildNotarizationPayload,
  explorerTxUrl,
  sendNotarizationMemo,
} from "@/lib/solana";

type FarmLocation = {
  lat: number;
  lon: number;
};

/**
 * Tela principal: identificação, validação climática e notarização on-chain.
 */
export default function Home() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [cultura, setCultura] = useState<Cultura>("Soja");
  const [operacao, setOperacao] = useState<OperacaoManejo>("Pulverização");
  const [location, setLocation] = useState<FarmLocation | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<WeatherCheckResult | null>(null);
  const [notarizing, setNotarizing] = useState(false);
  const [notarizeStep, setNotarizeStep] = useState<NotarizeStep>(1);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [producerName, setProducerName] = useState(DEFAULT_PRODUCER_NAME);
  const [fazenda, setFazenda] = useState(DEFAULT_FAZENDA);
  const [talhao, setTalhao] = useState(DEFAULT_TALHAO);
  const [attestations, setAttestations] = useState<Atestado[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [certificadoAtivo, setCertificadoAtivo] = useState<Atestado | null>(null);

  const approved = result?.status === "APPROVED";
  const history = useMemo(
    () =>
      [...attestations].sort((a, b) =>
        (b.createdAt ?? b.recordedAt).localeCompare(a.createdAt ?? a.recordedAt),
      ),
    [attestations],
  );

  useEffect(() => {
    const profile = loadProfile();
    setProducerName(profile.producerName);
    setFazenda(profile.fazenda);
    setTalhao(profile.talhao);
    setAttestations(loadAttestations());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveProfile({ producerName, fazenda, talhao });
  }, [hydrated, producerName, fazenda, talhao]);

  useEffect(() => {
    if (!hydrated) return;
    saveAttestations(attestations);
  }, [hydrated, attestations]);

  /** Grava o atestado local após confirmação da transação. */
  function registerAttestation(txHash: string, weather: WeatherCheckResult) {
    const next = createAttestation({
      producerName,
      fazenda,
      talhao,
      operacao: weather.operacao,
      cultura: weather.cultura,
      vento: weather.current.wind_speed_10m,
      temperatura: weather.current.temperature_2m,
      umidade: weather.current.relative_humidity_2m,
      chuva: weather.current.precipitation_probability,
      txHash,
    });
    setHighlightId(next.id);
    setAttestations((current) => [
      next,
      ...current.filter((item) => item.txHash !== txHash),
    ]);
    return next;
  }

  const locationLabel = useMemo(() => {
    if (!location) return "Nenhuma coordenada capturada";
    return `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`;
  }, [location]);

  /** Captura latitude/longitude do talhão via Geolocation API. */
  function captureGps() {
    setError("");
    setTxSignature(null);
    setGpsStatus("");
    setNotarizeStep(1);

    if (!navigator.geolocation) {
      setError("Geolocalização não é suportada neste navegador.");
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        setLocation(nextLocation);
        setGpsStatus("GPS da fazenda capturado com sucesso.");
        setResult(null);
        setGpsLoading(false);
      },
      (geoError) => {
        setGpsLoading(false);
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Permissão de localização negada. Autorize o GPS para continuar."
            : "Não foi possível capturar o GPS da fazenda.",
        );
      },
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  }

  /** Consulta o clima e aplica o semáforo agronômico. */
  async function validateWeather() {
    setError("");
    setTxSignature(null);
    setNotarizeStep(1);

    if (!location) {
      setError("Capture o GPS da fazenda antes de validar o clima.");
      return;
    }

    setValidating(true);
    try {
      const weather = await checkWeatherConditions(
        location.lat,
        location.lon,
        cultura,
        operacao,
      );
      setResult(weather);
    } catch (caught) {
      setResult(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Falha ao validar as condições climáticas.",
      );
    } finally {
      setValidating(false);
    }
  }

  /** Notariza o manejo aprovado via /api/notarize (chave de demo). */
  async function finalizeOperation() {
    if (!approved || !result) return;

    setError("");
    setTxSignature(null);
    setNotarizing(true);
    setNotarizeStep(1);

    try {
      setNotarizeStep(1);
      await wait(450);
      setNotarizeStep(2);
      await wait(450);
      setNotarizeStep(3);

      const payload = buildNotarizationPayload(result);
      const response = await fetch("/api/notarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const data = (await response.json()) as {
        txSignature?: string;
        error?: string;
      };

      if (!response.ok || !data.txSignature) {
        throw new Error(data.error ?? "Falha ao notarizar na Solana Devnet.");
      }

      setNotarizeStep(4);
      await wait(500);
      setTxSignature(data.txSignature);
      registerAttestation(data.txSignature, result);
    } catch (caught) {
      setTxSignature(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Falha ao registrar o atestado na Solana.",
      );
    } finally {
      setNotarizing(false);
    }
  }

  /** Notariza com a carteira Phantom (auditoria opcional). */
  async function notarizeWithPhantom() {
    if (!approved || !result) return;

    if (!connected || !publicKey) {
      setError("Conecte a Phantom no cabeçalho para assinar manualmente.");
      return;
    }

    setError("");
    setTxSignature(null);
    setNotarizing(true);

    try {
      const payload = buildNotarizationPayload(result);
      const signature = await sendNotarizationMemo(
        connection,
        publicKey,
        sendTransaction,
        payload,
      );
      setTxSignature(signature);
      registerAttestation(signature, result);
    } catch (caught) {
      setTxSignature(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Falha ao assinar com a Phantom.",
      );
    } finally {
      setNotarizing(false);
    }
  }

  return (
    <>
    <div className="no-print min-h-full bg-[radial-gradient(circle_at_top,_#ecfdf3_0%,_var(--background)_42%)]">
      <header className="border-b border-emerald-900/10 bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-black/50">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-emerald-700 uppercase dark:text-emerald-400">
              AgTech
            </p>
            <h1 className="font-sans text-3xl font-semibold tracking-tight text-emerald-950 dark:text-emerald-50">
              Atmoswerka
            </h1>
          </div>
          <div className="flex flex-col items-start gap-2.5 sm:items-end">
            <span className="w-fit rounded-full border border-emerald-700/15 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-950 dark:text-emerald-200">
              Solana Devnet / AgTech
            </span>
            <WalletButton />
            <p className="flex max-w-xs items-start justify-end gap-2 text-right text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              <span className="relative mt-1 inline-flex h-2 w-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>
                Notarização Automática Ativa (Chave Demo) | Conexão de carteira opcional para auditoria.
              </span>
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
        <section className="rounded-2xl border border-emerald-900/10 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950/70">
          <h2 className="text-lg font-semibold text-emerald-950 dark:text-emerald-50">
            Identificação do Produtor
          </h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-3">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nome do Produtor
              </span>
              <input
                value={producerName}
                onChange={(event) => setProducerName(event.target.value)}
                placeholder="Mari Werka"
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nome da Fazenda
              </span>
              <input
                value={fazenda}
                onChange={(event) => setFazenda(event.target.value)}
                placeholder="Fazenda Nunes"
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Talhão
              </span>
              <input
                value={talhao}
                onChange={(event) => setTalhao(event.target.value)}
                placeholder="Talhão 1"
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-900/10 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950/70">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Cultura
              </span>
              <select
                value={cultura}
                onChange={(event) => {
                  setCultura(event.target.value as Cultura);
                  setResult(null);
                  setTxSignature(null);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {CULTURAS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Operação
              </span>
              <select
                value={operacao}
                onChange={(event) => {
                  setOperacao(event.target.value as OperacaoManejo);
                  setResult(null);
                  setTxSignature(null);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {OPERACOES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 rounded-xl bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
            <p className="font-medium">Coordenadas da fazenda</p>
            <p className="mt-1 font-mono text-xs tracking-wide">{locationLabel}</p>
            {gpsStatus ? <p className="mt-1 text-emerald-700 dark:text-emerald-300">{gpsStatus}</p> : null}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={captureGps}
              disabled={gpsLoading}
              className="flex-1 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {gpsLoading ? "Capturando GPS..." : "Capturar GPS da Fazenda"}
            </button>
            <button
              type="button"
              onClick={() => void validateWeather()}
              disabled={validating}
              className="flex-1 rounded-xl border border-emerald-800 px-4 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-400 dark:text-emerald-200 dark:hover:bg-emerald-950"
            >
              {validating ? "Validando..." : "Validar Condições Climáticas"}
            </button>
          </div>
        </section>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
            {error}
          </p>
        ) : null}

        {result ? (
          <section
            className={`rounded-2xl border p-6 shadow-sm ${
              result.semaforo === "GREEN"
                ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                : result.semaforo === "YELLOW"
                  ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
                  : "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] uppercase text-zinc-500">
                  Semáforo agronômico
                </p>
                <p
                  className={`text-2xl font-bold tracking-wide ${
                    result.semaforo === "GREEN"
                      ? "text-emerald-700 dark:text-emerald-300"
                      : result.semaforo === "YELLOW"
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {result.semaforo === "GREEN"
                    ? "VERDE"
                    : result.semaforo === "YELLOW"
                      ? "AMARELO"
                      : "VERMELHO"}
                  <span className="ml-2 text-base font-semibold">
                    {approved ? "APROVADO" : "REPROVADO"}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1.5" aria-hidden>
                <span
                  className={`h-3.5 w-3.5 rounded-full ${
                    result.semaforo === "GREEN" ? "bg-emerald-500 ring-2 ring-emerald-300" : "bg-emerald-200 dark:bg-emerald-950"
                  }`}
                />
                <span
                  className={`h-3.5 w-3.5 rounded-full ${
                    result.semaforo === "YELLOW" ? "bg-amber-400 ring-2 ring-amber-300" : "bg-amber-200 dark:bg-amber-950"
                  }`}
                />
                <span
                  className={`h-3.5 w-3.5 rounded-full ${
                    result.semaforo === "RED" ? "bg-red-500 ring-2 ring-red-300" : "bg-red-200 dark:bg-red-950"
                  }`}
                />
              </div>
            </div>

            <p className="mt-4 rounded-xl bg-white/80 px-4 py-3 text-sm font-medium leading-relaxed text-zinc-800 dark:bg-black/20 dark:text-zinc-100">
              {result.motivoDetalhado}
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-3">
              <Metric
                label="Vento"
                value={formatVento(result.current.wind_speed_10m)}
                alert={result.metricAlerts.wind}
              />
              <Metric
                label="Umidade"
                value={formatUmidade(result.current.relative_humidity_2m)}
                alert={result.metricAlerts.humidity}
              />
              <Metric
                label="Temperatura"
                value={formatTemperatura(result.current.temperature_2m)}
                alert={result.metricAlerts.temperature}
              />
              <Metric
                label="Chuva"
                value={formatChuva(result.current.precipitation_probability)}
                alert={result.metricAlerts.rain}
              />
            </dl>
          </section>
        ) : null}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void finalizeOperation()}
            disabled={!approved || notarizing}
            className={`inline-flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
              notarizing
                ? "cursor-wait bg-violet-700"
                : "bg-violet-700 hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            }`}
          >
            {notarizing ? (
              <>
                <span
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden
                />
                Notarizando e Gerando Atestado...
              </>
            ) : (
              "Declaro Manejo Concluído e Emitir Atestado On-Chain"
            )}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Ao clicar, você confirma a execução da operação no talhão e registra o comprovante na Solana.
          </p>
          {connected ? (
            <button
              type="button"
              onClick={() => void notarizeWithPhantom()}
              disabled={!approved || notarizing}
              className="text-sm font-medium text-violet-700 underline decoration-violet-300 underline-offset-4 hover:text-violet-500 disabled:cursor-not-allowed disabled:no-underline disabled:text-zinc-400 dark:text-violet-300"
            >
              Assinar manualmente com Phantom
            </button>
          ) : null}
        </div>

        {notarizing || notarizeStep === 4 ? (
          <NotarizationStepper step={notarizeStep} />
        ) : null}

        {txSignature ? (
          <section className="rounded-2xl border border-violet-300 bg-violet-50 p-6 shadow-sm dark:border-violet-800 dark:bg-violet-950/40">
            <p className="text-xs font-semibold tracking-[0.18em] text-violet-700 uppercase dark:text-violet-300">
              Assinatura Automática de Demo
            </p>
            <h2 className="mt-1 text-2xl font-bold text-violet-950 dark:text-violet-50">
              Certificado Digital de Manejo
            </h2>
            <p className="mt-2 text-sm text-violet-800 dark:text-violet-200">
              Atestado de {result?.operacao} em {result?.cultura} gravado no Memo Program da Solana Devnet.
            </p>
            <div className="mt-4 rounded-xl bg-white/80 px-4 py-3 dark:bg-black/20">
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Hash da transação
              </p>
              <p className="mt-1 break-all font-mono text-sm">{txSignature}</p>
            </div>
            <a
              href={explorerTxUrl(txSignature)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex text-sm font-semibold text-violet-700 underline decoration-violet-400 underline-offset-4 hover:text-violet-500 dark:text-violet-300"
            >
              Ver no Solana Explorer
            </a>
          </section>
        ) : null}

        <HistoricoManejos
          atestados={history}
          highlightId={highlightId}
          onVerCertificado={setCertificadoAtivo}
        />
      </main>
    </div>

    {certificadoAtivo ? (
      <CertificadoModal
        atestado={certificadoAtivo}
        onClose={() => setCertificadoAtivo(null)}
      />
    ) : null}
    </>
  );
}

/**
 * Card de métrica do semáforo (vento, temperatura, umidade ou chuva).
 */
function Metric({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert: "ok" | "warning" | "alert";
}) {
  const outOfRange = alert !== "ok";

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white/80 px-4 py-3 dark:bg-black/20 ${
        alert === "alert"
          ? "border-red-300 dark:border-red-800"
          : alert === "warning"
            ? "border-amber-300 dark:border-amber-800"
            : "border-emerald-200 dark:border-emerald-900"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2 overflow-hidden">
        <dt className="min-w-0 truncate text-xs font-semibold tracking-wider text-zinc-400 uppercase">
          {label}
        </dt>
        {outOfRange ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              alert === "alert"
                ? "bg-red-600 text-white"
                : "bg-amber-500 text-amber-950"
            }`}
          >
            {alert === "alert" ? "Fora do padrão" : "Atenção"}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
            Aprovado
          </span>
        )}
      </div>
      <dd className="mt-1 truncate text-lg font-semibold">{value}</dd>
    </div>
  );
}
