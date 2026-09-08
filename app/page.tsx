"use client";

import { useMemo, useState } from "react";
import {
  checkWeatherConditions,
  type WeatherCheckResult,
} from "@/lib/agronomy";

const CULTURAS = ["Soja", "Milho", "Trigo"] as const;
const OPERACOES = ["Pulverização", "Adubação"] as const;

type Cultura = (typeof CULTURAS)[number];
type Operacao = (typeof OPERACOES)[number];

type FarmLocation = {
  lat: number;
  lon: number;
};

export default function Home() {
  const [cultura, setCultura] = useState<Cultura>("Soja");
  const [operacao, setOperacao] = useState<Operacao>("Pulverização");
  const [location, setLocation] = useState<FarmLocation | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<WeatherCheckResult | null>(null);
  const [solanaNote, setSolanaNote] = useState("");

  const approved = result?.status === "APPROVED";

  const locationLabel = useMemo(() => {
    if (!location) return "Nenhuma coordenada capturada";
    return `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`;
  }, [location]);

  function captureGps() {
    setError("");
    setSolanaNote("");
    setGpsStatus("");

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

  async function validateWeather() {
    setError("");
    setSolanaNote("");

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

  function registerOnSolana() {
    if (!approved || !result) return;
    setSolanaNote(
      `Atestado de ${result.operacao} em ${result.cultura} pronto para registro na Solana Devnet.`,
    );
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_#ecfdf3_0%,_var(--background)_42%)]">
      <header className="border-b border-emerald-900/10 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-black/40">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-emerald-700 uppercase dark:text-emerald-400">
              AgTech
            </p>
            <h1 className="font-sans text-3xl font-semibold tracking-tight text-emerald-950 dark:text-emerald-50">
              Atmoswerka
            </h1>
          </div>
          <span className="w-fit rounded-full border border-emerald-700/20 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-950 dark:text-emerald-200">
            Solana Devnet / AgTech
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
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
                  setSolanaNote("");
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
                  setOperacao(event.target.value as Operacao);
                  setResult(null);
                  setSolanaNote("");
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
              approved
                ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                : "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p
                className={`text-2xl font-bold tracking-wide ${
                  approved ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
                }`}
              >
                {approved ? "APROVADO" : "REPROVADO"}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">{result.motivo}</p>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric
                label="Vento"
                value={`${result.current.wind_speed_10m.toFixed(1)} km/h`}
                approved={approved}
              />
              <Metric
                label="Umidade"
                value={`${result.current.relative_humidity_2m.toFixed(0)}%`}
                approved={approved}
              />
              <Metric
                label="Temperatura"
                value={`${result.current.temperature_2m.toFixed(1)} °C`}
                approved={approved}
              />
            </dl>
          </section>
        ) : null}

        <button
          type="button"
          onClick={registerOnSolana}
          disabled={!approved}
          className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
        >
          Registrar Atestado na Solana
        </button>

        {solanaNote ? (
          <p className="text-center text-sm text-violet-800 dark:text-violet-300">{solanaNote}</p>
        ) : null}
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  approved,
}: {
  label: string;
  value: string;
  approved: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white/80 px-4 py-3 dark:bg-black/20 ${
        approved
          ? "border-emerald-200 dark:border-emerald-900"
          : "border-red-200 dark:border-red-900"
      }`}
    >
      <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}
