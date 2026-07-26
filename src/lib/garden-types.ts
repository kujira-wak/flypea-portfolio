export const TICKS_PER_MM = 8;
export const CARD_UNLOCK_TICKS = 48_000;

export type GardenScene =
  | "plot"
  | "table"
  | "room"
  | "street"
  | "skyline"
  | "clouds"
  | "horizon"
  | "orbit";

export type GardenTheme = "canvas" | "ink";
export type GardenCardLayout = "index" | "split";
export type GardenPurchase = "gloves" | "rainBarrel";

export interface GardenPurchaseResult {
  upgrade: GardenPurchase;
  level: number;
  costTicks: number;
}

export interface GardenActionResult {
  acceptedCare: number;
  purchases: GardenPurchaseResult[];
}

export interface GardenActionResponse {
  state: GardenState;
  result: GardenActionResult;
}

export interface GardenState {
  nickname: string;
  growthTicks: number;
  careTicks: number;
  glovesLevel: number;
  rainBarrelLevel: number;
  careTicksPerAction: number;
  passiveTicksPerSecond: number;
  revision: number;
  acceptedCareCount: number;
  registeredAt: string;
  updatedAt: string;
  serverTime: string;
  rank: number | null;
  title: string;
  unlockedScenes: GardenScene[];
  nextGlovesCost: number | null;
  nextRainBarrelCost: number | null;
  cardUnlocked: boolean;
  hidden: boolean;
}

export interface CardSnapshot {
  nickname: string;
  growthTicks: number;
  rank: number | null;
  gardenAgeDays: number;
  autoTicksPerSecond: number;
  glovesLevel: number;
  rainBarrelLevel: number;
  title: string;
  unlockedScenes: GardenScene[];
  revision: number;
  generatedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  growthTicks: number;
  title: string;
  isMe: boolean;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}

export interface GardenApiErrorBody {
  error?: string;
  message?: string;
}
