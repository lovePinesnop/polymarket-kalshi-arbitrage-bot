import { describe, expect, it } from "vitest";
import { extractCantonTransfers, getCantonTransactionHashes } from "../src";

// Helper to build a `canton_prepareSignExecute` ExerciseCommand.
const exerciseCommand = (choice: string, choiceArgument?: Record<string, unknown>) => ({
  ExerciseCommand: {
    templateId: "<interface id>",
    contractId: "<factory or instruction cid>",
    choice,
    choiceArgument,
  },
});

const transferArg = (amount: unknown, instrumentId: unknown) => ({
  expectedAdmin: "<admin>",
  transfer: {
    sender: "<sender>",
    receiver: "<receiver>",
    amount,
    instrumentId,
  },
});

describe("utils/canton", () => {
  describe("extractCantonTransfers", () => {
    it("extracts a TransferFactory_Transfer", () => {
      const params = {
        commands: [
          exerciseCommand(
            "TransferFactory_Transfer",
            transferArg("100", { admin: "<admin>", id: "Amulet" }),
          ),
        ],
      };
      expect(extractCantonTransfers(params)).to.eql([{ amount: "100", instrumentId: "Amulet" }]);
    });

    it("extracts a DelegateProxy_TransferFactory_Transfer", () => {
      const params = {
        commands: [
          exerciseCommand(
            "DelegateProxy_TransferFactory_Transfer",
            transferArg("42", { admin: "<admin>", id: "CC" }),
          ),
        ],
      };
      expect(extractCantonTransfers(params)).to.eql([{ amount: "42", instrumentId: "CC" }]);
    });

    it("extracts multiple transfers from multiple commands", () => {
      const params = {
        commands: [
          exerciseCommand(
            "TransferFactory_Transfer",
            transferArg("100", { admin: "<admin>", id: "Amulet" }),
          ),
          exerciseCommand(
            "DelegateProxy_TransferFactory_Transfer",
            transferArg("250", { admin: "<admin>", id: "CC" }),
          ),
        ],
      };
      expect(extractCantonTransfers(params)).to.eql([
        { amount: "100", instrumentId: "Amulet" },
        { amount: "250", instrumentId: "CC" },
      ]);
    });

    it("coerces non-string amount/instrumentId to strings", () => {
      const params = {
        commands: [
          exerciseCommand(
            "TransferFactory_Transfer",
            transferArg(1000, { admin: "<admin>", id: 7 }),
          ),
        ],
      };
      expect(extractCantonTransfers(params)).to.eql([{ amount: "1000", instrumentId: "7" }]);
    });

    it("skips unsupported (instruction-style) choices", () => {
      const params = {
        commands: [
          exerciseCommand("TransferInstruction_Accept", { contractId: "<cid>" }),
          exerciseCommand("TransferInstruction_Reject", { contractId: "<cid>" }),
          exerciseCommand("AllocationFactory_Allocate", { contractId: "<cid>" }),
        ],
      };
      expect(extractCantonTransfers(params)).to.eql([]);
    });

    it("returns only the supported choices from a mixed batch", () => {
      const params = {
        commands: [
          exerciseCommand("TransferInstruction_Accept", { contractId: "<cid>" }),
          exerciseCommand(
            "TransferFactory_Transfer",
            transferArg("5", { admin: "<admin>", id: "Amulet" }),
          ),
        ],
      };
      expect(extractCantonTransfers(params)).to.eql([{ amount: "5", instrumentId: "Amulet" }]);
    });

    it("skips commands missing the amount", () => {
      const params = {
        commands: [
          exerciseCommand(
            "TransferFactory_Transfer",
            transferArg(undefined, { admin: "<admin>", id: "Amulet" }),
          ),
        ],
      };
      expect(extractCantonTransfers(params)).to.eql([]);
    });

    it("skips commands missing the instrumentId", () => {
      const params = {
        commands: [
          exerciseCommand("TransferFactory_Transfer", transferArg("100", { admin: "<admin>" })),
        ],
      };
      expect(extractCantonTransfers(params)).to.eql([]);
    });

    it("skips commands without an ExerciseCommand", () => {
      const params = { commands: [{ CreateCommand: {} }, null, undefined] };
      expect(extractCantonTransfers(params)).to.eql([]);
    });

    it("returns [] when commands is not an array", () => {
      expect(extractCantonTransfers({ commands: "nope" })).to.eql([]);
      expect(extractCantonTransfers({})).to.eql([]);
      expect(extractCantonTransfers(null)).to.eql([]);
      expect(extractCantonTransfers(undefined)).to.eql([]);
    });
  });

  describe("getCantonTransactionHashes", () => {
    const result = (updateId: unknown) => ({
      status: "executed",
      payload: { updateId, completionOffset: 12345 },
    });

    it("encodes updateId:amount:instrumentId for a single transfer", () => {
      const params = {
        commands: [
          exerciseCommand(
            "TransferFactory_Transfer",
            transferArg("120", { admin: "<admin>", id: "CC" }),
          ),
        ],
      };
      expect(getCantonTransactionHashes(params, result("0x123"))).to.eql(["0x123:120:CC"]);
    });

    it("encodes one entry per transfer for multiple commands", () => {
      const params = {
        commands: [
          exerciseCommand(
            "TransferFactory_Transfer",
            transferArg("100", { admin: "<admin>", id: "Amulet" }),
          ),
          exerciseCommand(
            "DelegateProxy_TransferFactory_Transfer",
            transferArg("250", { admin: "<admin>", id: "CC" }),
          ),
        ],
      };
      expect(getCantonTransactionHashes(params, result("0xabc"))).to.eql([
        "0xabc:100:Amulet",
        "0xabc:250:CC",
      ]);
    });

    it("falls back to the bare updateId for instruction-style choices", () => {
      const params = {
        commands: [exerciseCommand("TransferInstruction_Accept", { contractId: "<cid>" })],
      };
      expect(getCantonTransactionHashes(params, result("0xdef"))).to.eql(["0xdef"]);
    });

    it("falls back to the bare updateId when there are no commands", () => {
      expect(getCantonTransactionHashes({}, result("0xdef"))).to.eql(["0xdef"]);
    });

    it("returns [] when the result has no updateId", () => {
      const params = {
        commands: [
          exerciseCommand(
            "TransferFactory_Transfer",
            transferArg("100", { admin: "<admin>", id: "Amulet" }),
          ),
        ],
      };
      expect(getCantonTransactionHashes(params, { payload: {} })).to.eql([]);
      expect(getCantonTransactionHashes(params, {})).to.eql([]);
      expect(getCantonTransactionHashes(params, null)).to.eql([]);
    });
  });
});
