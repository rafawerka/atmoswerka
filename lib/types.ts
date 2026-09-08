/**
 * Contratos de domínio da Atmoswerka.
 * Centraliza tipos usados pela UI, engine agronômica e notarização on-chain.
 */

/** Culturas suportadas no seletor da operação. */
export type Cultura = "Soja" | "Milho" | "Trigo";

/** Operações de manejo avaliadas pela engine climática. */
export type OperacaoManejo =
  | "Pulverização"
  | "Adubação"
  | "Semeadura"
  | "Plantio"
  | "Colheita"
  | "Irrigação";

export const CULTURAS: readonly Cultura[] = ["Soja", "Milho", "Trigo"];

export const OPERACOES: readonly OperacaoManejo[] = [
  "Pulverização",
  "Adubação",
  "Semeadura",
  "Plantio",
  "Colheita",
  "Irrigação",
];

/** Identificação do produtor e do talhão. */
export interface ProdutorInfo {
  producerName: string;
  fazenda: string;
  talhao: string;
}

/** Telemetria climática usada nas regras agronômicas. */
export interface DadosClima {
  vento: number;
  temperatura: number;
  umidade: number;
  chuva: number;
}

/** Atestado de conformidade persistido após notarização na Solana. */
export interface Atestado extends ProdutorInfo {
  id: string;
  operacao: string;
  cultura: string;
  vento: number;
  temperatura: number;
  umidade: number;
  chuva?: number;
  status: "APROVADO";
  recordedAt: string;
  createdAt: string;
  txHash: string;
  farmName?: string;
}

/** JSON gravado no Memo Program (oráculo de notarização). */
export interface PayloadNotarizacao {
  app: "Atmoswerka";
  operacao: string;
  cultura: string;
  lat: number;
  lon: number;
  vento: number;
  umidade: number;
  status: string;
  timestamp: string;
}
