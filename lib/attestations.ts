import type { Atestado, ProdutorInfo } from "@/lib/types";

const PROFILE_KEY = "atmoswerka.profile";
const ATTESTATIONS_KEY = "atmoswerka.attestations";

export const DEFAULT_PRODUCER_NAME = "Mari Werka";
export const DEFAULT_FAZENDA = "Fazenda Nunes";
export const DEFAULT_TALHAO = "Talhão 1";

export type ProducerProfile = ProdutorInfo;
export type RegisteredAttestation = Atestado;

type StoredProfile = Partial<ProdutorInfo> & { farmName?: string };
type StoredAttestation = Atestado & {
  farmName?: string;
  fazenda?: string;
  talhao?: string;
};

function canUseStorage() {
  return typeof window !== "undefined";
}

/**
 * Separa fazenda e talhão de registros antigos no formato "Fazenda - Talhão".
 */
export function splitFarmAndPlot(farmName: string) {
  const parts = farmName.split(/\s[-–—]\s/);
  if (parts.length >= 2) {
    return { farm: parts[0], plot: parts.slice(1).join(" - ") };
  }
  return { farm: farmName, plot: DEFAULT_TALHAO };
}

function defaultProfile(): ProdutorInfo {
  return {
    producerName: DEFAULT_PRODUCER_NAME,
    fazenda: DEFAULT_FAZENDA,
    talhao: DEFAULT_TALHAO,
  };
}

function normalizeProfile(parsed: StoredProfile): ProdutorInfo {
  if (parsed.fazenda && parsed.talhao) {
    return {
      producerName: parsed.producerName || DEFAULT_PRODUCER_NAME,
      fazenda: parsed.fazenda,
      talhao: parsed.talhao,
    };
  }

  if (parsed.farmName) {
    const split = splitFarmAndPlot(parsed.farmName);
    return {
      producerName: parsed.producerName || DEFAULT_PRODUCER_NAME,
      fazenda: split.farm,
      talhao: split.plot,
    };
  }

  return {
    producerName: parsed.producerName || DEFAULT_PRODUCER_NAME,
    fazenda: DEFAULT_FAZENDA,
    talhao: DEFAULT_TALHAO,
  };
}

/**
 * Garante fazenda e talhão em atestados salvos em versões anteriores.
 */
export function normalizeAttestation(item: StoredAttestation): Atestado {
  const split = splitFarmAndPlot(item.farmName || "");
  return {
    ...item,
    producerName: item.producerName || DEFAULT_PRODUCER_NAME,
    fazenda: item.fazenda || split.farm || DEFAULT_FAZENDA,
    talhao: item.talhao || split.plot || DEFAULT_TALHAO,
  };
}

/** Lê o perfil do produtor no localStorage. */
export function loadProfile(): ProdutorInfo {
  if (!canUseStorage()) return defaultProfile();

  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return defaultProfile();
    return normalizeProfile(JSON.parse(raw) as StoredProfile);
  } catch {
    return defaultProfile();
  }
}

/** Persiste o perfil do produtor. */
export function saveProfile(profile: ProdutorInfo) {
  if (!canUseStorage()) return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

/** Carrega o histórico de atestados notarizados. */
export function loadAttestations(): Atestado[] {
  if (!canUseStorage()) return [];

  try {
    const raw = localStorage.getItem(ATTESTATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredAttestation[];
    return Array.isArray(parsed) ? parsed.map(normalizeAttestation) : [];
  } catch {
    return [];
  }
}

/** Persiste o histórico de atestados. */
export function saveAttestations(attestations: Atestado[]) {
  if (!canUseStorage()) return;
  localStorage.setItem(ATTESTATIONS_KEY, JSON.stringify(attestations));
}

/** Data/hora local no formato pt-BR. */
export function formatRecordedAt(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatVento(vento: number) {
  return vento.toFixed(1) + " km/h";
}

export function formatTemperatura(temperatura: number) {
  return temperatura.toFixed(1) + "°C";
}

export function formatUmidade(umidade: number) {
  return umidade.toFixed(0) + "%";
}

export function formatChuva(chuva: number) {
  return chuva.toFixed(0) + "%";
}

/**
 * Cria um atestado APROVADO a partir da telemetria e da hash on-chain.
 */
export function createAttestation(input: {
  producerName: string;
  fazenda: string;
  talhao: string;
  operacao: string;
  cultura: string;
  vento: number;
  temperatura: number;
  umidade: number;
  chuva: number;
  txHash: string;
}): Atestado {
  const createdAt = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    producerName: input.producerName.trim() || DEFAULT_PRODUCER_NAME,
    fazenda: input.fazenda.trim() || DEFAULT_FAZENDA,
    talhao: input.talhao.trim() || DEFAULT_TALHAO,
    operacao: input.operacao,
    cultura: input.cultura,
    vento: input.vento,
    temperatura: input.temperatura,
    umidade: input.umidade,
    chuva: input.chuva,
    status: "APROVADO",
    recordedAt: formatRecordedAt(new Date(createdAt)),
    createdAt,
    txHash: input.txHash,
  };
}
