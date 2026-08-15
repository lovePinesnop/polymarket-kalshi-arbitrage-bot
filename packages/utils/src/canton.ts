// Canton Network (`canton_prepareSignExecute`) transfer extraction helpers.
//
// A `canton_prepareSignExecute` request bundles a Daml `commands` array. For
// Token-Standard transfers the amount/instrument live inline on the command's
// `choiceArgument.transfer`. Without access to a Canton participant we can only
// read the amount from choices that carry it inline — the two factory transfer
// choices below. Anything that references an existing `TransferInstruction`
// contract by id (Accept / Reject / Withdraw / Allocation*) is opaque from
// outside the ledger and is intentionally skipped.

// The only choices whose transfer amount can be read from the payload itself.
const CANTON_SUPPORTED_CHOICES = new Set<string>([
  "TransferFactory_Transfer",
  "DelegateProxy_TransferFactory_Transfer",
]);

export interface CantonTransferSummary {
  // `amount` is a Daml `Decimal` STRING — never coerce to a float for value math.
  amount: string;
  // e.g. "Amulet", "CC".
  instrumentId: string;
}

export function extractCantonTransfers(params: any): CantonTransferSummary[] {
  const commands = params?.commands;
  if (!Array.isArray(commands)) return [];

  const out: CantonTransferSummary[] = [];
  // A single request can carry multiple commands; iterate, don't assume [0].
  for (const cmd of commands) {
    const exerciseCommand = cmd?.ExerciseCommand;
    if (!exerciseCommand || !CANTON_SUPPORTED_CHOICES.has(exerciseCommand.choice)) {
      continue;
    }

    const transfer = exerciseCommand.choiceArgument?.transfer;
    if (!transfer?.amount || !transfer?.instrumentId?.id) continue;

    out.push({
      amount: String(transfer.amount),
      instrumentId: String(transfer.instrumentId.id),
    });
  }
  return out;
}

// Builds TNV-friendly tx hashes for a `canton_prepareSignExecute` response.
//
// The ledger tx hash is `result.payload.updateId`. We pair it with each inline
// transfer so downstream consumers can approximate the notional value, encoding
// every entry as `${updateId}:${amount}:${instrumentId}` (e.g. "0x123:120:CC").
// When no inline transfer info is present (instruction-style choices), we fall
// back to the bare `updateId` so the tx hash is still recorded.
export function getCantonTransactionHashes(params: any, result: any): string[] {
  const updateId = result?.payload?.updateId;
  if (!updateId) return [];

  const transfers = extractCantonTransfers(params);
  if (transfers.length === 0) return [String(updateId)];

  return transfers.map((transfer) => `${updateId}:${transfer.amount}:${transfer.instrumentId}`);
}
