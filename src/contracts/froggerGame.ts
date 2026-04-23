import { type Address } from "viem";

export const FROGGER_GAME_ADDRESS =
  "0xef350abb29d75733ae1867989e3f7b464c1320ae" as Address;

export const FROGGER_GAME_ABI = [
  {
    type: "constructor",
    inputs: [{ name: "_entryFee", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    name: "EntryFeeUpdated",
    type: "event",
    inputs: [{ name: "newFee", type: "uint256", indexed: false, internalType: "uint256" }],
    anonymous: false,
  },
  {
    name: "GameStarted",
    type: "event",
    inputs: [
      { name: "player", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "timestamp", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    name: "ScoreSubmitted",
    type: "event",
    inputs: [
      { name: "player", type: "address", indexed: true, internalType: "address" },
      { name: "score", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "timestamp", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    name: "Withdrawn",
    type: "event",
    inputs: [
      { name: "to", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    name: "entryFee",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "getContractBalance",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "highScores",
    type: "function",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "lastPlayedAt",
    type: "function",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "owner",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    name: "setEntryFee",
    type: "function",
    inputs: [{ name: "_entryFee", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "startGame",
    type: "function",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    name: "submitScore",
    type: "function",
    inputs: [{ name: "score", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "withdraw",
    type: "function",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
