import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
  sendAndConfirmTransaction,
  type SendOptions,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import type { WeatherCheckResult } from "@/lib/agronomy";
import type { PayloadNotarizacao } from "@/lib/types";

/** Programa Memo da Solana (SPL). */
export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

export type NotarizationPayload = PayloadNotarizacao;

const DEMO_SEED = new Uint8Array(32);
new TextEncoder().encode("atmoswerka-demo-oracle-v1").forEach((byte, index) => {
  DEMO_SEED[index] = byte;
});

/**
 * Monta o JSON de manejo que será gravado on-chain.
 */
export function buildNotarizationPayload(
  result: WeatherCheckResult,
): PayloadNotarizacao {
  return {
    app: "Atmoswerka",
    operacao: result.operacao,
    cultura: result.cultura,
    lat: result.lat,
    lon: result.lon,
    vento: result.current.wind_speed_10m,
    umidade: result.current.relative_humidity_2m,
    status: result.status,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Cria a instrução do Memo Program com o JSON UTF-8 e o pagador como signer.
 */
export function createMemoInstruction(
  memo: string,
  signerPubkeys: PublicKey[],
): TransactionInstruction {
  return new TransactionInstruction({
    keys: signerPubkeys.map((pubkey) => ({
      pubkey,
      isSigner: true,
      isWritable: false,
    })),
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf8"),
  });
}

/** URL do Explorer na Devnet para uma assinatura de transação. */
export function explorerTxUrl(txSignature: string) {
  return "https://explorer.solana.com/tx/" + txSignature + "?cluster=devnet";
}

/** Abrevia a hash para exibição (ex.: 5SJ8...qR2). */
export function formatTxHash(hash: string) {
  if (hash.length <= 10) return hash;
  return hash.slice(0, 4) + "..." + hash.slice(-3);
}

/** Type guard do payload aceito pela API de notarização. */
export function isNotarizationPayload(
  value: unknown,
): value is PayloadNotarizacao {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    payload.app === "Atmoswerka" &&
    typeof payload.operacao === "string" &&
    typeof payload.cultura === "string" &&
    typeof payload.lat === "number" &&
    typeof payload.lon === "number" &&
    typeof payload.vento === "number" &&
    typeof payload.umidade === "number" &&
    typeof payload.status === "string" &&
    typeof payload.timestamp === "string"
  );
}

type SendTransaction = (
  transaction: Transaction,
  connection: Connection,
  options?: SendOptions,
) => Promise<string>;

/**
 * Envia o memo assinado pela carteira conectada (Phantom / auditoria).
 */
export async function sendNotarizationMemo(
  connection: Connection,
  publicKey: PublicKey,
  sendTransaction: SendTransaction,
  payload: PayloadNotarizacao,
): Promise<string> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: publicKey,
    recentBlockhash: blockhash,
  }).add(createMemoInstruction(JSON.stringify(payload), [publicKey]));

  const txSignature = await sendTransaction(transaction, connection);
  await connection.confirmTransaction(
    { signature: txSignature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  return txSignature;
}

/** Keypair determinística usada na assinatura automática de demo. */
export function getDemoKeypair() {
  return Keypair.fromSeed(DEMO_SEED);
}

/** Conexão RPC da Solana Devnet. */
export function getDemoConnection() {
  return new Connection(clusterApiUrl("devnet"), "confirmed");
}

/**
 * Garante saldo mínimo na Devnet para pagar a taxa da transação memo.
 */
async function ensureDemoBalance(connection: Connection, keypair: Keypair) {
  const balance = await connection.getBalance(keypair.publicKey);
  if (balance >= 50_000) return;

  try {
    const signature = await connection.requestAirdrop(
      keypair.publicKey,
      LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(signature, "confirmed");
  } catch {
    throw new Error(
      "A chave de demo está sem SOL na Devnet. Envie 1 SOL de teste para " +
        keypair.publicKey.toBase58() +
        " em https://faucet.solana.com",
    );
  }
}

/**
 * Assina e envia o JSON de manejo no Memo Program com a chave de demo.
 * Usado pela rota /api/notarize (sem popup de carteira).
 */
export async function notarizeWithDemoKeypair(
  payload: PayloadNotarizacao,
): Promise<string> {
  const keypair = getDemoKeypair();
  const connection = getDemoConnection();

  await ensureDemoBalance(connection, keypair);

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: keypair.publicKey,
    recentBlockhash: blockhash,
  }).add(createMemoInstruction(JSON.stringify(payload), [keypair.publicKey]));

  return sendAndConfirmTransaction(connection, transaction, [keypair], {
    commitment: "confirmed",
  });
}
