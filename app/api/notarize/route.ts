import { NextResponse } from "next/server";
import { isNotarizationPayload, notarizeWithDemoKeypair } from "@/lib/solana";

export const runtime = "nodejs";

/**
 * Recebe o JSON de manejo aprovado e dispara a notarização na Devnet.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { payload?: unknown };
    const payload = body.payload;

    if (!isNotarizationPayload(payload)) {
      return NextResponse.json(
        { error: "JSON de manejo inválido para notarização." },
        { status: 400 },
      );
    }

    if (payload.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Só é possível notarizar operações com status APPROVED." },
        { status: 400 },
      );
    }

    const txSignature = await notarizeWithDemoKeypair(payload);
    return NextResponse.json({ txSignature });
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : "Falha ao notarizar na Solana Devnet.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
