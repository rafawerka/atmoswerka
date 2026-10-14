# Atmoswerka

**Proof of Compliance para o agronegócio.** A Atmoswerka transforma a decisão de manejo agrícola em um comprovante público e imutável: antes de pulverizar, semear, adubar, irrigar ou colher, o produtor valida as condições climáticas reais do talhão e, quando a operação é aprovada, registra o atestado on-chain na Solana.

Hoje o registro de boas práticas agrícolas depende de caderno de campo, planilha ou declaração do próprio produtor. Nada disso é auditável por um comprador, uma certificadora ou uma seguradora. A Atmoswerka resolve esse problema gravando a telemetria climática do momento da operação em uma transação Solana, que qualquer parte pode conferir no Explorer sem confiar no produtor.

## Como funciona

O fluxo tem três estágios, do dado bruto ao comprovante:

```
GPS do talhão
     |
     v
Open-Meteo  ->  Engine Agronômica  ->  Solana Devnet
(telemetria)    (semáforo + regras)    (Memo Program)
                                              |
                                              v
                                    Certificado + txHash
```

1. **Open-Meteo** — o app captura a latitude e a longitude da fazenda via `navigator.geolocation` e consulta vento, temperatura, umidade relativa e probabilidade de chuva da hora corrente.
2. **Engine Agronômica** (`lib/agronomy.ts`) — aplica os limites técnicos da operação escolhida e devolve um semáforo (verde, amarelo ou vermelho), o status `APPROVED` / `REJECTED` e um `motivoDetalhado` explicando qual métrica violou a regra e qual o impacto na lavoura.
3. **Solana Devnet** (`lib/solana.ts`) — apenas operações aprovadas viram transação. O JSON do manejo é gravado como memo UTF-8 no Memo Program (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) e a assinatura da transação vira a chave criptográfica do certificado.

### Regras agronômicas

| Operação | Reprovado quando | Risco evitado |
| --- | --- | --- |
| Pulverização | Vento acima de 10 km/h | Deriva do defensivo |
| Semeadura / Plantio | Chuva acima de 80% ou vento acima de 25 km/h | Erosão da semente |
| Colheita | Umidade acima de 70% ou chuva acima de 30% | Grão úmido e perdas |
| Irrigação | Chuva acima de 60% | Desperdício de água e energia |
| Adubação | Vento acima de 20 km/h | Distribuição irregular do adubo |

Fora dos limites de rejeição, a engine ainda marca métricas em faixa de atenção (semáforo amarelo), como temperatura alta com risco de evaporação ou umidade baixa demais para manter a gota até o alvo.

### Payload gravado on-chain

```json
{
  "app": "Atmoswerka",
  "operacao": "Pulverização",
  "cultura": "Soja",
  "lat": -23.5149,
  "lon": -46.6105,
  "vento": 2.9,
  "umidade": 76,
  "status": "APPROVED",
  "timestamp": "2026-09-08T06:30:00.000Z"
}
```

## Notarização automática (chave de demo)

Para que jurados e avaliadores testem o fluxo completo sem instalar carteira, a rota `POST /api/notarize` assina a transação no servidor com uma keypair determinística de teste:

```
5SJ8jupi9zwJidWzissnjkPVzu7seDqNzJFJsdXqCqR2
```

Essa conta existe **apenas na Devnet** e não guarda valor real. Se o airdrop automático falhar (comum na Devnet), envie 1 SOL de teste para o endereço acima em [faucet.solana.com](https://faucet.solana.com).

A conexão de carteira **Phantom** continua disponível no cabeçalho como caminho opcional: quem quiser auditar assina a mesma transação com a própria conta, e o comprovante passa a apontar para esse endereço.

## Rodando localmente

Pré-requisitos: Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) e siga o fluxo:

1. Preencha produtor, fazenda e talhão.
2. Escolha cultura e operação.
3. Clique em **Capturar GPS da Fazenda** e autorize a localização no navegador.
4. Clique em **Validar Condições Climáticas** para ver o semáforo agronômico.
5. Com status aprovado, clique em **Declaro Manejo Concluído e Emitir Atestado On-Chain**.
6. Abra o card no **Histórico de Manejos** e clique em **Ver Certificado** para copiar a hash, abrir o Explorer ou imprimir o certificado em A4.

Outros scripts: `npm run build` (build de produção), `npm start` (servidor de produção) e `npm run lint`.

O histórico e o perfil do produtor ficam no `localStorage` do navegador; a prova imutável é a transação na Solana.

## Estrutura do projeto

| Caminho | Responsabilidade |
| --- | --- |
| `app/page.tsx` | Tela principal: identificação, validação e notarização |
| `app/api/notarize/route.ts` | Endpoint enxuto que valida o payload e chama a camada Solana |
| `lib/agronomy.ts` | Consulta Open-Meteo e aplica as regras de cada operação |
| `lib/solana.ts` | Memo Program, assinatura de demo e envio via carteira |
| `lib/types.ts` | Contratos de domínio (`Atestado`, `DadosClima`, `OperacaoManejo`, `ProdutorInfo`) |
| `lib/attestations.ts` | Persistência local do perfil e do histórico de atestados |
| `components/CertificadoModal.tsx` | Certificado de conformidade com hash e impressão |
| `components/HistoricoManejos.tsx` | Lista de atestados notarizados |
| `components/notarization-stepper.tsx` | Stepper visual das etapas de notarização na Solana |
| `components/solana-provider.tsx` | Providers da carteira Solana (Wallet Standard) na Devnet |
| `components/wallet-button.tsx` | Botão de conexão da carteira, carregado só no cliente |

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, `@solana/web3.js` e Solana Wallet Adapter. Dados climáticos pela API pública da [Open-Meteo](https://open-meteo.com), sem chave de API.

## Verificando um atestado

Toda transação pode ser conferida por qualquer pessoa:

```
https://explorer.solana.com/tx/<txHash>?cluster=devnet
```

O JSON do manejo aparece nos logs da instrução do Memo Program — é a prova de que aquela operação foi executada sob condições climáticas adequadas, na data e no local declarados.
