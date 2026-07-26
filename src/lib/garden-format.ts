import {
  CARD_UNLOCK_TICKS,
  type CardSnapshot,
  type GardenScene,
  type GardenState,
  TICKS_PER_MM,
} from "./garden-types";

const SCENE_THRESHOLDS: ReadonlyArray<{ key: GardenScene; ticks: number }> = [
  { key: "plot", ticks: 0 },
  { key: "table", ticks: 800 },
  { key: "room", ticks: 8_000 },
  { key: "street", ticks: CARD_UNLOCK_TICKS },
  { key: "skyline", ticks: 80_000 },
  { key: "clouds", ticks: 800_000 },
  { key: "horizon", ticks: 8_000_000 },
  { key: "orbit", ticks: 80_000_000 },
];

const numeric = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const first = (source: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
};

export const scenesForGrowth = (ticks: number): GardenScene[] =>
  SCENE_THRESHOLDS.filter((scene) => ticks >= scene.ticks).map((scene) => scene.key);

const validScenes = (value: unknown, growthTicks: number) => {
  if (!Array.isArray(value)) return scenesForGrowth(growthTicks);
  const allowed = new Set(SCENE_THRESHOLDS.map((scene) => scene.key));
  const aliases: Record<string, GardenScene> = {
    grid: "plot",
    desk: "table",
    city: "skyline",
  };
  const scenes = value
    .map((scene) => (typeof scene === "string" ? (aliases[scene] ?? scene) : ""))
    .filter((scene): scene is GardenScene => allowed.has(scene as GardenScene));
  return scenes.length > 0 ? scenes : scenesForGrowth(growthTicks);
};

export const titleForGrowth = (ticks: number) => {
  if (ticks >= 80_000_000) return "ORBITAL SPECIMEN";
  if (ticks >= 8_000_000) return "HORIZON KEEPER";
  if (ticks >= 800_000) return "CLOUD GARDENER";
  if (ticks >= 80_000) return "SKYLINE GROWER";
  if (ticks >= CARD_UNLOCK_TICKS) return "ARCHIVE SPECIMEN";
  if (ticks >= 8_000) return "ROOM GARDENER";
  if (ticks >= 800) return "TABLE GROWER";
  return "TINY CULTIVATOR";
};

export const normalizeGardenState = (payload: unknown): GardenState => {
  const outer = record(payload);
  const state = record(first(outer, "state", "garden", "player") ?? outer);
  const profile = record(first(outer, "player", "profile") ?? {});
  const growthTicks = numeric(first(state, "growthTicks", "growth_ticks"));
  const nickname = String(
    first(state, "nickname") ?? first(profile, "nickname") ?? first(outer, "nickname") ?? "",
  );
  const glovesLevel = numeric(first(state, "glovesLevel", "gloves_level"));
  const rainBarrelLevel = numeric(
    first(state, "rainBarrelLevel", "rain_barrel_level", "barrelLevel", "barrel_level"),
  );
  const registeredAt = String(
    first(state, "registeredAt", "registered_at", "createdAt", "created_at") ??
      new Date().toISOString(),
  );
  const serverTime = String(
    first(state, "serverTime", "server_time") ??
      first(outer, "serverTime", "server_time") ??
      new Date().toISOString(),
  );

  return {
    nickname,
    growthTicks,
    careTicks: numeric(first(state, "careTicks", "care_ticks")),
    glovesLevel,
    rainBarrelLevel,
    careTicksPerAction: numeric(
      first(state, "careTicksPerAction", "care_ticks_per_action"),
      8 + glovesLevel * 8,
    ),
    passiveTicksPerSecond: numeric(
      first(state, "passiveTicksPerSecond", "passive_ticks_per_second"),
      4 + rainBarrelLevel * 8,
    ),
    revision: numeric(first(state, "revision")),
    acceptedCareCount: numeric(
      first(
        state,
        "acceptedCareCount",
        "accepted_care_count",
        "certifiedActions",
        "certified_actions",
        "careCount",
        "care_count",
      ),
    ),
    registeredAt,
    updatedAt: String(
      first(state, "updatedAt", "updated_at") ??
        first(outer, "updatedAt", "updated_at") ??
        serverTime,
    ),
    serverTime,
    rank:
      first(state, "rank") === null || first(outer, "rank") === null
        ? null
        : numeric(first(state, "rank") ?? first(outer, "rank")) || null,
    title: String(first(state, "title") ?? first(outer, "title") ?? titleForGrowth(growthTicks)),
    unlockedScenes: validScenes(
      first(state, "unlockedScenes", "unlocked_scenes") ??
        first(outer, "unlockedScenes", "unlocked_scenes"),
      growthTicks,
    ),
    nextGlovesCost:
      state.nextGlovesCostTicks === null
        ? null
        : numeric(
            first(
              state,
              "nextGlovesCost",
              "next_gloves_cost",
              "nextGlovesCostTicks",
              "next_gloves_cost_ticks",
              "glovesCost",
              "gloves_cost",
            ),
            nextUpgradeCost(160, glovesLevel),
          ),
    nextRainBarrelCost:
      state.nextRainBarrelCostTicks === null
        ? null
        : numeric(
            first(
              state,
              "nextRainBarrelCost",
              "next_rain_barrel_cost",
              "nextRainBarrelCostTicks",
              "next_rain_barrel_cost_ticks",
              "rainBarrelCost",
              "rain_barrel_cost",
            ),
            nextUpgradeCost(240, rainBarrelLevel),
          ),
    cardUnlocked:
      Boolean(first(state, "cardUnlocked", "card_unlocked") ?? first(outer, "cardUnlocked")) ||
      growthTicks >= CARD_UNLOCK_TICKS,
    hidden: Boolean(first(state, "hidden", "is_hidden")),
  };
};

export const normalizeCardSnapshot = (payload: unknown): CardSnapshot => {
  const outer = record(payload);
  const snapshot = record(first(outer, "snapshot", "card") ?? outer);
  const growthTicks = numeric(first(snapshot, "growthTicks", "growth_ticks"));
  const registeredAt = Date.parse(
    String(first(snapshot, "registeredAt", "registered_at", "createdAt", "created_at") ?? ""),
  );
  const generatedAt = String(
    first(snapshot, "generatedAt", "generated_at", "serverTime", "server_time") ??
      new Date().toISOString(),
  );
  const explicitDays = first(
    snapshot,
    "gardenAgeDays",
    "garden_age_days",
    "growingDays",
    "growing_days",
    "ageDays",
    "age_days",
  );
  const derivedDays = Number.isFinite(registeredAt)
    ? Math.max(0, Math.floor((Date.parse(generatedAt) - registeredAt) / 86_400_000))
    : 0;
  const rainBarrelLevel = numeric(
    first(snapshot, "rainBarrelLevel", "rain_barrel_level", "barrelLevel", "barrel_level"),
  );

  return {
    nickname: String(first(snapshot, "nickname") ?? ""),
    growthTicks,
    rank: first(snapshot, "rank") === null ? null : numeric(first(snapshot, "rank")) || null,
    gardenAgeDays: numeric(explicitDays, derivedDays),
    autoTicksPerSecond: numeric(
      first(
        snapshot,
        "autoTicksPerSecond",
        "auto_ticks_per_second",
        "passiveTicksPerSecond",
        "passive_ticks_per_second",
        "growthPerSecond",
      ),
      4 + rainBarrelLevel * 8,
    ),
    glovesLevel: numeric(first(snapshot, "glovesLevel", "gloves_level")),
    rainBarrelLevel,
    title: String(first(snapshot, "title") ?? titleForGrowth(growthTicks)),
    unlockedScenes: validScenes(first(snapshot, "unlockedScenes", "unlocked_scenes"), growthTicks),
    revision: numeric(first(snapshot, "revision")),
    generatedAt,
  };
};

export const nextUpgradeCost = (base: number, level: number) => {
  let cost = base;
  for (let index = 0; index < level; index += 1) cost = Math.ceil(cost * 1.6);
  return cost;
};

export const formatLength = (ticks: number, compact = false) => {
  const millimeters = Math.max(0, ticks) / TICKS_PER_MM;
  const units = [
    { minimum: 1_000_000, divisor: 1_000_000, suffix: "km" },
    { minimum: 1_000, divisor: 1_000, suffix: "m" },
    { minimum: 10, divisor: 10, suffix: "cm" },
    { minimum: 0, divisor: 1, suffix: "mm" },
  ];
  const unit = units.find((candidate) => millimeters >= candidate.minimum) ?? units[3];
  const value = millimeters / unit.divisor;
  const maximumFractionDigits = compact
    ? value < 10
      ? 1
      : 0
    : value < 10
      ? 3
      : value < 100
        ? 2
        : 1;
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits }).format(value)} ${unit.suffix}`;
};

export const formatTicks = (ticks: number) =>
  new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(Math.max(0, ticks));
