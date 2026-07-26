import { formatLength } from "./garden-format";
import type { CardSnapshot, GardenCardLayout, GardenScene, GardenTheme } from "./garden-types";
import { TICKS_PER_MM } from "./garden-types";

export interface ArchivePlateOptions {
  theme: GardenTheme;
  layout: GardenCardLayout;
  scene: GardenScene;
}

export interface ScaleComparison {
  key: string;
  label: string;
  lengthMm: number;
  approximate: boolean;
}

export interface OddComparison extends ScaleComparison {
  count: number;
}

type ScaleAxis = "horizontal" | "vertical";

interface ScaleArtSpec {
  axis: ScaleAxis;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface SpecimenScaleGuide {
  maximumMm: number;
  stepMm: number;
  pixelsPerMm: number;
  growthPixels: number;
  comparisonPixels: number;
}

export const SCENE_LABELS: Record<GardenScene, string> = {
  plot: "PLOT / 01",
  table: "TABLE / 10 CM",
  room: "ROOM / 1 M",
  street: "STREET / 6 M",
  skyline: "SKYLINE / 10 M",
  clouds: "CLOUDS / 100 M",
  horizon: "HORIZON / 1 KM",
  orbit: "ORBIT / 10 KM",
};

export const SCALE_SILHOUETTE_SVGS: Readonly<Record<string, string>> = {
  coin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140"><circle cx="50" cy="78" r="40" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="50" cy="78" r="29" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="78" r="9" fill="currentColor"/><path d="M50 38v8M50 110v8M10 78h8M82 78h8M22 50l6 6M72 100l6 6M78 50l-6 6M28 100l-6 6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`,
  phone: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140"><rect x="22" y="5" width="56" height="130" rx="10" fill="none" stroke="currentColor" stroke-width="7"/><rect x="29" y="25" width="42" height="87" rx="2" fill="none" stroke="currentColor" stroke-width="3"/><path d="M42 16h16M45 123h10" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="65" cy="16" r="2.5" fill="currentColor"/></svg>`,
  person: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140"><circle cx="50" cy="20" r="13" fill="none" stroke="currentColor" stroke-width="6"/><path d="M50 35v52M50 45 20 72M50 45l30 27M50 86l-24 47M50 86l24 47" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M38 50h24" fill="none" stroke="currentColor" stroke-width="4"/></svg>`,
  giraffe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140"><path d="M15 76c15-10 34-10 52-2l2-47 9-12 15 2 1 11-14 8-1 56-12 12H31l-11-11z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><path d="M31 101v34M55 101v34M71 100v35M18 92l-10-8M78 16 74 5M88 16l5-10" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><circle cx="43" cy="84" r="5" fill="currentColor"/><circle cx="61" cy="91" r="4" fill="currentColor"/><circle cx="74" cy="57" r="4" fill="currentColor"/><circle cx="76" cy="76" r="4" fill="currentColor"/><circle cx="88" cy="23" r="2.5" fill="currentColor"/></svg>`,
  bus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140"><path d="M8 48h84v62H8zM18 34h64l10 14H8z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><path d="M14 58h72M36 58v36M62 58v36M8 95h84" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="25" cy="111" r="10" fill="currentColor"/><circle cx="75" cy="111" r="10" fill="currentColor"/></svg>`,
  whale: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140"><path d="M18 73c15-30 57-35 76-7 7 11 2 25-9 32-19 13-48 8-65-9z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><path d="M21 78C13 65 7 59 2 58c2 12 7 19 15 24-8 5-12 12-12 23 9-3 16-10 21-20M58 98c7 13 17 20 29 18-3-11-9-19-19-24M81 54c-1-8 1-15 6-22M76 54c-5-7-7-14-5-22M68 83c9 4 17 4 25-1" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="81" cy="68" r="3.5" fill="currentColor"/><circle cx="76" cy="53" r="2.5" fill="currentColor"/></svg>`,
  tower: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140"><path d="M50 4v20M42 25h16M45 25 25 132M55 25l20 107M17 132h66M34 83h32M29 108h42M39 59h22" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><rect x="31" y="42" width="38" height="13" fill="none" stroke="currentColor" stroke-width="5"/><path d="m36 59 26 24M64 59 38 83M30 86l36 22M70 86l-36 22" fill="none" stroke="currentColor" stroke-width="3"/></svg>`,
  fuji: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140"><circle cx="77" cy="35" r="18" fill="none" stroke="currentColor" stroke-width="5"/><path d="M3 128 50 18l47 110z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><path d="m35 53 8 6 7-10 8 10 8-6M17 112c13-8 25-8 36 0 10-8 21-8 32 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  earth: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140"><circle cx="50" cy="76" r="44" fill="none" stroke="currentColor" stroke-width="6"/><path d="M7 76h86M50 32c17 16 23 57 0 88M50 32c-17 16-23 57 0 88M14 53h72M14 99h72" fill="none" stroke="currentColor" stroke-width="3"/><path d="m27 48 10-8 12 4 3 10-8 7-2 13-10 3-8-12zm35 36 12-6 12 7-4 13-9 5-3 12-9-5-5-14z" fill="currentColor"/></svg>`,
};

const SCALE_ART_SPECS: Readonly<Record<string, ScaleArtSpec>> = {
  coin: { axis: "vertical", xMin: 7, xMax: 93, yMin: 35, yMax: 121 },
  phone: { axis: "vertical", xMin: 18, xMax: 82, yMin: 1, yMax: 139 },
  person: { axis: "vertical", xMin: 15, xMax: 85, yMin: 4, yMax: 138 },
  giraffe: { axis: "vertical", xMin: 4, xMax: 98, yMin: 2, yMax: 138 },
  bus: { axis: "horizontal", xMin: 5, xMax: 95, yMin: 31, yMax: 124 },
  whale: { axis: "horizontal", xMin: 0, xMax: 99, yMin: 29, yMax: 122 },
  tower: { axis: "vertical", xMin: 13, xMax: 87, yMin: 1, yMax: 136 },
  fuji: { axis: "vertical", xMin: 0, xMax: 100, yMin: 14, yMax: 133 },
  earth: { axis: "vertical", xMin: 3, xMax: 97, yMin: 29, yMax: 123 },
};

const SCALE_CATALOG: ScaleComparison[] = [
  { key: "coin", label: "硬貨の直径", lengthMm: 23.5, approximate: true },
  { key: "phone", label: "スマートフォン", lengthMm: 147, approximate: true },
  { key: "person", label: "人の身長", lengthMm: 1_700, approximate: true },
  { key: "giraffe", label: "キリン", lengthMm: 5_000, approximate: true },
  { key: "bus", label: "路線バス", lengthMm: 12_000, approximate: true },
  { key: "whale", label: "シロナガスクジラ", lengthMm: 25_000, approximate: true },
  { key: "tower", label: "高い塔", lengthMm: 333_000, approximate: true },
  { key: "fuji", label: "富士山", lengthMm: 3_776_000, approximate: true },
  { key: "earth", label: "地球の直径", lengthMm: 12_742_000_000, approximate: true },
];

const ODD_CATALOG: ScaleComparison[] = [
  { key: "pea", label: "えんどう豆", lengthMm: 8, approximate: true },
  { key: "pudding", label: "プリン", lengthMm: 80, approximate: true },
  { key: "record", label: "LPレコード", lengthMm: 300, approximate: true },
  { key: "controller", label: "ゲームコントローラー", lengthMm: 160, approximate: true },
];

const nearestByLogDistance = (millimeters: number, catalog: ScaleComparison[]) => {
  const safe = Math.max(millimeters, 0.125);
  return catalog.reduce((nearest, candidate) =>
    Math.abs(Math.log(safe / candidate.lengthMm)) < Math.abs(Math.log(safe / nearest.lengthMm))
      ? candidate
      : nearest,
  );
};

export const getScaleComparison = (ticks: number) =>
  nearestByLogDistance(Math.max(1, ticks) / TICKS_PER_MM, SCALE_CATALOG);

export const getOddComparison = (ticks: number): OddComparison => {
  const millimeters = Math.max(1, ticks) / TICKS_PER_MM;
  const meterBucket = Math.floor(millimeters / 1_000);
  const base = ODD_CATALOG[meterBucket % ODD_CATALOG.length] ?? ODD_CATALOG[0];
  return { ...base, count: millimeters / base.lengthMm };
};

export const formatScaleComparison = (snapshot: CardSnapshot) => {
  const scale = getScaleComparison(snapshot.growthTicks);
  const ratio = snapshot.growthTicks / TICKS_PER_MM / scale.lengthMm;
  return `約${new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: ratio < 10 ? 2 : 1,
  }).format(ratio)}倍の${scale.label}（概算）`;
};

export const formatOddComparison = (snapshot: CardSnapshot) => {
  const odd = getOddComparison(snapshot.growthTicks);
  return `${odd.label} 約${new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: odd.count < 10 ? 2 : odd.count < 100 ? 1 : 0,
  }).format(odd.count)}個分${odd.approximate ? "（概算）" : ""}`;
};

const niceScaleStep = (minimumStep: number) => {
  const safe = Math.max(minimumStep, Number.MIN_VALUE);
  const exponent = 10 ** Math.floor(Math.log10(safe));
  const fraction = safe / exponent;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * exponent;
};

export const getSpecimenScaleGuide = (
  growthTicks: number,
  comparison: ScaleComparison,
  constraints = {
    rulerPixels: 520,
    growthPixels: 500,
    comparisonPixels: 300,
  },
): SpecimenScaleGuide => {
  const growthMm = Math.max(1, growthTicks) / TICKS_PER_MM;
  const comparisonMm = comparison.lengthMm;
  const largestMm = Math.max(growthMm, comparisonMm);
  const stepMm = niceScaleStep(largestMm / 4);
  const maximumMm = Math.ceil(largestMm / stepMm) * stepMm;
  const pixelsPerMm = Math.min(
    constraints.rulerPixels / maximumMm,
    constraints.growthPixels / growthMm,
    constraints.comparisonPixels / comparisonMm,
  );

  return {
    maximumMm,
    stepMm,
    pixelsPerMm,
    growthPixels: growthMm * pixelsPerMm,
    comparisonPixels: comparisonMm * pixelsPerMm,
  };
};

const setFont = (
  context: CanvasRenderingContext2D,
  size: number,
  weight = 400,
  family = '"IBM Plex Mono", "Noto Sans JP", monospace',
) => {
  context.font = `${weight} ${size}px ${family}`;
};

const drawRule = (
  context: CanvasRenderingContext2D,
  x: number,
  baseline: number,
  guide: SpecimenScaleGuide,
  foreground: string,
) => {
  context.save();
  context.strokeStyle = foreground;
  context.fillStyle = foreground;
  context.lineWidth = 2;
  const height = guide.maximumMm * guide.pixelsPerMm;
  const top = baseline - height;
  context.beginPath();
  context.moveTo(x, top);
  context.lineTo(x, baseline);
  context.stroke();
  const divisions = Math.round(guide.maximumMm / guide.stepMm);
  for (let index = 0; index <= divisions; index += 1) {
    const valueMm = guide.stepMm * index;
    const tickY = baseline - valueMm * guide.pixelsPerMm;
    context.beginPath();
    context.moveTo(x, tickY);
    context.lineTo(x + 38, tickY);
    context.stroke();
    setFont(context, 14, 600);
    context.fillText(formatLength(valueMm * TICKS_PER_MM, true), x + 48, tickY + 5);

    if (index < divisions) {
      const minorY = tickY - (guide.stepMm * guide.pixelsPerMm) / 2;
      context.beginPath();
      context.moveTo(x, minorY);
      context.lineTo(x + 20, minorY);
      context.stroke();
    }
  }
  setFont(context, 13, 600);
  context.fillText("SAME SCALE", x, top - 18);
  context.restore();
};

const drawScene = (
  context: CanvasRenderingContext2D,
  scene: GardenScene,
  x: number,
  y: number,
  width: number,
  height: number,
  palette: { foreground: string; quiet: string; lime: string; orange: string; surface: string },
) => {
  const ground = y + height * 0.78;
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.fillStyle = palette.surface;
  context.fillRect(x, y, width, height);
  context.strokeStyle = palette.quiet;
  context.fillStyle = palette.quiet;
  context.lineWidth = 3;

  if (scene === "plot") {
    for (let row = 0; row < 6; row += 1) {
      context.beginPath();
      context.moveTo(x, y + (height / 6) * row);
      context.lineTo(x + width, y + (height / 6) * row);
      context.stroke();
    }
    for (let column = 0; column < 8; column += 1) {
      context.beginPath();
      context.moveTo(x + (width / 8) * column, y);
      context.lineTo(x + (width / 8) * column, y + height);
      context.stroke();
    }
  } else if (scene === "table") {
    context.fillRect(x, ground, width, height - ground + y);
    context.fillStyle = palette.foreground;
    context.fillRect(x + width * 0.12, ground - 80, width * 0.16, 80);
    context.fillRect(x + width * 0.72, ground - 130, width * 0.12, 130);
  } else if (scene === "room") {
    context.strokeRect(x + width * 0.08, y + height * 0.12, width * 0.3, height * 0.34);
    context.fillRect(x, ground, width, 4);
    context.fillRect(x + width * 0.66, ground - height * 0.3, width * 0.22, height * 0.3);
  } else if (scene === "street" || scene === "skyline") {
    const buildingCount = scene === "street" ? 5 : 11;
    for (let index = 0; index < buildingCount; index += 1) {
      const buildingWidth = width / buildingCount - 8;
      const buildingHeight = height * (0.22 + ((index * 37) % 31) / 100);
      context.fillRect(
        x + index * (width / buildingCount),
        ground - buildingHeight,
        buildingWidth,
        buildingHeight,
      );
    }
    context.fillStyle = palette.foreground;
    context.fillRect(x, ground, width, 5);
  } else if (scene === "clouds") {
    for (let index = 0; index < 7; index += 1) {
      const cloudX = x + ((index * 173) % Math.max(1, width - 180));
      const cloudY = y + 80 + ((index * 83) % Math.max(1, height - 240));
      context.beginPath();
      context.arc(cloudX, cloudY, 44, 0, Math.PI * 2);
      context.arc(cloudX + 52, cloudY + 8, 58, 0, Math.PI * 2);
      context.arc(cloudX + 112, cloudY, 38, 0, Math.PI * 2);
      context.fill();
    }
  } else if (scene === "horizon") {
    context.beginPath();
    context.moveTo(x, ground);
    context.lineTo(x + width * 0.22, y + height * 0.45);
    context.lineTo(x + width * 0.42, ground);
    context.lineTo(x + width * 0.66, y + height * 0.31);
    context.lineTo(x + width, ground);
    context.closePath();
    context.fill();
    context.fillStyle = palette.lime;
    context.fillRect(x, ground, width, height - ground + y);
  } else {
    context.fillStyle = palette.foreground;
    for (let index = 0; index < 90; index += 1) {
      const starX = x + ((index * 109) % Math.max(1, width));
      const starY = y + ((index * 67) % Math.max(1, height));
      const starSize = index % 7 === 0 ? 4 : 2;
      context.fillRect(starX, starY, starSize, starSize);
    }
    context.strokeStyle = palette.lime;
    context.lineWidth = 8;
    context.beginPath();
    context.arc(x + width * 0.82, y + height * 0.24, width * 0.16, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
};

const drawScaleSilhouetteFallback = (
  context: CanvasRenderingContext2D,
  key: string,
  x: number,
  baseline: number,
  width: number,
  foreground: string,
) => {
  context.save();
  context.fillStyle = foreground;
  context.strokeStyle = foreground;
  context.lineWidth = Math.max(3, width * 0.025);
  context.lineCap = "round";
  context.lineJoin = "round";

  if (key === "coin") {
    context.beginPath();
    context.arc(x + width / 2, baseline - width / 2, width / 2, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(x + width / 2, baseline - width / 2, width * 0.36, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(x + width / 2, baseline - width / 2, width * 0.1, 0, Math.PI * 2);
    context.fill();
  } else if (key === "earth") {
    const centerX = x + width / 2;
    const centerY = baseline - width / 2;
    context.beginPath();
    context.arc(centerX, centerY, width / 2, 0, Math.PI * 2);
    context.moveTo(x, centerY);
    context.lineTo(x + width, centerY);
    context.moveTo(x + width * 0.12, centerY - width * 0.24);
    context.lineTo(x + width * 0.88, centerY - width * 0.24);
    context.moveTo(x + width * 0.12, centerY + width * 0.24);
    context.lineTo(x + width * 0.88, centerY + width * 0.24);
    context.stroke();
    context.beginPath();
    context.ellipse(centerX, centerY, width * 0.22, width / 2, 0, 0, Math.PI * 2);
    context.stroke();
  } else if (key === "phone") {
    context.strokeRect(x + width * 0.24, baseline - width * 1.35, width * 0.52, width * 1.35);
    context.strokeRect(x + width * 0.3, baseline - width * 1.2, width * 0.4, width);
    context.beginPath();
    context.moveTo(x + width * 0.44, baseline - width * 1.28);
    context.lineTo(x + width * 0.56, baseline - width * 1.28);
    context.moveTo(x + width * 0.45, baseline - width * 0.08);
    context.lineTo(x + width * 0.55, baseline - width * 0.08);
    context.stroke();
  } else if (key === "person") {
    context.beginPath();
    context.arc(x + width / 2, baseline - width * 1.22, width * 0.14, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(x + width * 0.5, baseline - width * 1.06);
    context.lineTo(x + width * 0.5, baseline - width * 0.48);
    context.moveTo(x + width * 0.5, baseline - width * 0.92);
    context.lineTo(x + width * 0.17, baseline - width * 0.63);
    context.moveTo(x + width * 0.5, baseline - width * 0.92);
    context.lineTo(x + width * 0.83, baseline - width * 0.63);
    context.moveTo(x + width * 0.5, baseline - width * 0.48);
    context.lineTo(x + width * 0.22, baseline);
    context.moveTo(x + width * 0.5, baseline - width * 0.48);
    context.lineTo(x + width * 0.78, baseline);
    context.stroke();
  } else if (key === "giraffe") {
    context.strokeRect(x + width * 0.12, baseline - width * 0.58, width * 0.55, width * 0.34);
    context.beginPath();
    context.moveTo(x + width * 0.61, baseline - width * 0.5);
    context.lineTo(x + width * 0.68, baseline - width * 1.18);
    context.lineTo(x + width * 0.9, baseline - width * 1.28);
    context.lineTo(x + width * 0.94, baseline - width * 1.16);
    context.lineTo(x + width * 0.72, baseline - width * 1.08);
    context.moveTo(x + width * 0.22, baseline - width * 0.24);
    context.lineTo(x + width * 0.22, baseline);
    context.moveTo(x + width * 0.58, baseline - width * 0.24);
    context.lineTo(x + width * 0.58, baseline);
    context.stroke();
    for (const [spotX, spotY] of [
      [0.28, 0.48],
      [0.48, 0.37],
      [0.69, 0.82],
      [0.72, 1.02],
    ]) {
      context.beginPath();
      context.arc(x + width * spotX, baseline - width * spotY, width * 0.04, 0, Math.PI * 2);
      context.fill();
    }
  } else if (key === "bus") {
    context.strokeRect(x + width * 0.04, baseline - width * 0.7, width * 0.92, width * 0.58);
    context.strokeRect(x + width * 0.12, baseline - width * 0.6, width * 0.76, width * 0.25);
    context.beginPath();
    context.moveTo(x + width * 0.38, baseline - width * 0.6);
    context.lineTo(x + width * 0.38, baseline - width * 0.35);
    context.moveTo(x + width * 0.64, baseline - width * 0.6);
    context.lineTo(x + width * 0.64, baseline - width * 0.35);
    context.stroke();
    for (const wheelX of [0.25, 0.75]) {
      context.beginPath();
      context.arc(x + width * wheelX, baseline - width * 0.1, width * 0.1, 0, Math.PI * 2);
      context.fill();
    }
  } else if (key === "whale") {
    context.beginPath();
    context.ellipse(
      x + width * 0.55,
      baseline - width * 0.38,
      width * 0.42,
      width * 0.24,
      -0.1,
      0,
      Math.PI * 2,
    );
    context.moveTo(x + width * 0.14, baseline - width * 0.42);
    context.lineTo(x, baseline - width * 0.62);
    context.moveTo(x + width * 0.14, baseline - width * 0.42);
    context.lineTo(x, baseline - width * 0.22);
    context.moveTo(x + width * 0.78, baseline - width * 0.2);
    context.lineTo(x + width * 0.9, baseline - width * 0.08);
    context.moveTo(x + width * 0.78, baseline - width * 0.61);
    context.quadraticCurveTo(
      x + width * 0.75,
      baseline - width * 0.78,
      x + width * 0.87,
      baseline - width * 0.88,
    );
    context.moveTo(x + width * 0.73, baseline - width * 0.61);
    context.quadraticCurveTo(
      x + width * 0.64,
      baseline - width * 0.76,
      x + width * 0.69,
      baseline - width * 0.87,
    );
    context.stroke();
    context.beginPath();
    context.arc(x + width * 0.82, baseline - width * 0.45, width * 0.025, 0, Math.PI * 2);
    context.fill();
  } else if (key === "tower") {
    context.beginPath();
    context.moveTo(x + width * 0.5, baseline - width * 1.38);
    context.lineTo(x + width * 0.23, baseline);
    context.moveTo(x + width * 0.5, baseline - width * 1.38);
    context.lineTo(x + width * 0.77, baseline);
    for (const height of [0.32, 0.62, 0.92]) {
      context.moveTo(x + width * (0.23 + height * 0.2), baseline - width * height);
      context.lineTo(x + width * (0.77 - height * 0.2), baseline - width * height);
    }
    context.moveTo(x + width * 0.15, baseline);
    context.lineTo(x + width * 0.85, baseline);
    context.stroke();
  } else if (key === "fuji") {
    context.beginPath();
    context.moveTo(x + width * 0.5, baseline - width * 1.4);
    context.lineTo(x, baseline);
    context.lineTo(x + width, baseline);
    context.closePath();
    context.moveTo(x + width * 0.34, baseline - width * 0.95);
    context.lineTo(x + width * 0.43, baseline - width * 0.86);
    context.lineTo(x + width * 0.5, baseline - width);
    context.lineTo(x + width * 0.59, baseline - width * 0.86);
    context.lineTo(x + width * 0.67, baseline - width * 0.95);
    context.stroke();
  }
  context.restore();
};

const silhouetteImageCache = new Map<string, Promise<HTMLImageElement>>();

const loadScaleSilhouette = (key: string, foreground: string) => {
  const source = SCALE_SILHOUETTE_SVGS[key];
  if (!source) return Promise.reject(new Error(`Unknown silhouette: ${key}`));
  const safeForeground = /^#[\da-f]{6}$/i.test(foreground) ? foreground : "#11120f";
  const cacheKey = `${key}:${safeForeground}`;
  const cached = silhouetteImageCache.get(cacheKey);
  if (cached) return cached;

  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error(`Silhouette failed: ${key}`)), {
      once: true,
    });
    const coloredSource = source.replaceAll("currentColor", safeForeground);
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(coloredSource)}`;
  });
  silhouetteImageCache.set(cacheKey, pending);
  return pending;
};

const drawScaleSilhouette = async (
  context: CanvasRenderingContext2D,
  key: string,
  centerX: number,
  baseline: number,
  measurePixels: number,
  foreground: string,
) => {
  const spec = SCALE_ART_SPECS[key];
  if (!spec) throw new Error(`Unknown silhouette geometry: ${key}`);
  const measuredUnits = spec.axis === "horizontal" ? spec.xMax - spec.xMin : spec.yMax - spec.yMin;
  const scale = measurePixels / measuredUnits;
  const imageX = centerX - ((spec.xMin + spec.xMax) / 2) * scale;
  const imageY = baseline - spec.yMax * scale;
  try {
    const image = await loadScaleSilhouette(key, foreground);
    context.drawImage(image, imageX, imageY, 100 * scale, 140 * scale);
  } catch {
    const fallbackWidth =
      spec.axis === "horizontal" ? measurePixels : measurePixels / ((spec.yMax - spec.yMin) / 100);
    drawScaleSilhouetteFallback(
      context,
      key,
      centerX - fallbackWidth / 2,
      baseline,
      fallbackWidth,
      foreground,
    );
  }
};

const drawDimension = (
  context: CanvasRenderingContext2D,
  axis: ScaleAxis,
  centerX: number,
  baseline: number,
  measurePixels: number,
  offset: number,
  color: string,
) => {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 4;
  context.beginPath();
  if (axis === "horizontal") {
    const y = baseline + offset;
    const startX = centerX - measurePixels / 2;
    const endX = centerX + measurePixels / 2;
    context.moveTo(startX, y - 8);
    context.lineTo(startX, y + 8);
    context.moveTo(startX, y);
    context.lineTo(endX, y);
    context.moveTo(endX, y - 8);
    context.lineTo(endX, y + 8);
  } else {
    const x = centerX + offset;
    const top = baseline - measurePixels;
    context.moveTo(x - 8, top);
    context.lineTo(x + 8, top);
    context.moveTo(x, top);
    context.lineTo(x, baseline);
    context.moveTo(x - 8, baseline);
    context.lineTo(x + 8, baseline);
  }
  context.stroke();
  context.restore();
};

const drawScaleCaption = (
  context: CanvasRenderingContext2D,
  comparison: ScaleComparison,
  centerX: number,
  y: number,
  palette: { foreground: string; quiet: string },
) => {
  context.save();
  context.textAlign = "center";
  context.fillStyle = palette.quiet;
  setFont(context, 14, 600);
  context.fillText("NEAREST SCALE / APPROX.", centerX, y);
  context.fillStyle = palette.foreground;
  setFont(context, 21, 700, '"Noto Sans JP", sans-serif');
  context.fillText(comparison.label, centerX, y + 30, 280);
  context.fillStyle = palette.quiet;
  setFont(context, 14, 600);
  context.fillText(
    `REFERENCE ${formatLength(comparison.lengthMm * TICKS_PER_MM)}`,
    centerX,
    y + 56,
  );
  context.restore();
};

const drawProfile = (
  context: CanvasRenderingContext2D,
  profileImage: CanvasImageSource,
  x: number,
  y: number,
  size: number,
  orange: string,
  lime: string,
) => {
  context.save();
  const inset = Math.min(18, Math.max(2, size * 0.04));
  const imageX = x + inset;
  const imageY = y + inset;
  const imageSize = Math.max(1, size - inset * 2);
  context.fillStyle = lime;
  context.fillRect(x, y, size, size);
  context.fillStyle = orange;
  context.fillRect(imageX, imageY, imageSize, imageSize);
  try {
    const source = profileImage as HTMLImageElement;
    const sourceWidth = source.naturalWidth || source.width || 768;
    const sourceHeight = source.naturalHeight || source.height || 768;
    context.drawImage(
      profileImage,
      0,
      0,
      sourceWidth,
      sourceHeight,
      imageX,
      imageY,
      imageSize,
      imageSize,
    );
  } catch {
    context.fillStyle = "#11120f";
    context.beginPath();
    context.arc(
      imageX + imageSize * 0.3,
      imageY + imageSize * 0.42,
      imageSize * 0.07,
      0,
      Math.PI * 2,
    );
    context.arc(
      imageX + imageSize * 0.7,
      imageY + imageSize * 0.42,
      imageSize * 0.07,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.restore();
};

const drawLabel = (
  context: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  palette: { foreground: string; quiet: string },
) => {
  context.fillStyle = palette.quiet;
  setFont(context, 18, 600);
  context.fillText(label, x, y);
  context.fillStyle = palette.foreground;
  setFont(context, 34, 700, '"Archivo", "Noto Sans JP", sans-serif');
  const maximumWidth = width;
  context.fillText(value, x, y + 49, maximumWidth);
};

export const renderArchivePlate = async (
  canvas: HTMLCanvasElement,
  snapshot: CardSnapshot,
  options: ArchivePlateOptions,
  profileImage: CanvasImageSource,
) => {
  canvas.width = 1_200;
  canvas.height = 1_500;
  const context = canvas.getContext("2d", { alpha: false, colorSpace: "srgb" });
  if (!context) throw new Error("Canvas 2D is not available");

  const palette =
    options.theme === "ink"
      ? {
          background: "#11120f",
          foreground: "#f4f0e3",
          quiet: "#a9aca2",
          surface: "#20211d",
          lime: "#6dde3b",
          orange: "#cc6b35",
        }
      : {
          background: "#f4f0e3",
          foreground: "#11120f",
          quiet: "#666960",
          surface: "#e6e2d6",
          lime: "#6dde3b",
          orange: "#cc6b35",
        };
  const nearest = getScaleComparison(snapshot.growthTicks);
  const timestamp = new Date(snapshot.generatedAt).toISOString().replace(/\.\d{3}Z$/, " UTC");

  context.fillStyle = palette.background;
  context.fillRect(0, 0, 1_200, 1_500);
  context.strokeStyle = palette.foreground;
  context.lineWidth = 3;
  context.strokeRect(24, 24, 1_152, 1_452);

  context.fillStyle = palette.lime;
  context.fillRect(24, 24, 12, 1_452);

  // HEADER / 140
  context.fillStyle = palette.foreground;
  setFont(context, 28, 600);
  context.fillText("GARDEN / 000", 72, 72);
  setFont(context, 54, 800, '"Archivo", "Noto Sans JP", sans-serif');
  context.fillText(snapshot.nickname, 72, 126, 610);
  context.textAlign = "right";
  setFont(context, 20, 600);
  context.fillText(snapshot.title, 1_128, 72);
  context.fillStyle = palette.quiet;
  setFont(context, 18, 400);
  context.fillText(timestamp, 1_128, 116);
  context.textAlign = "left";
  context.beginPath();
  context.moveTo(24, 140);
  context.lineTo(1_176, 140);
  context.stroke();

  // SPECIMEN / 760
  const specimenY = 140;
  const specimenHeight = 760;
  const specimenBaseline = specimenY + 575;
  const scaleGuide = getSpecimenScaleGuide(snapshot.growthTicks, nearest);
  const profileCenterX = options.layout === "split" ? 370 : 420;
  const comparisonCenterX = options.layout === "split" ? 1_008 : 970;
  const ruleX = options.layout === "split" ? 762 : 72;
  if (options.layout === "split") {
    drawScene(context, options.scene, 36, specimenY, 704, specimenHeight, palette);
    context.fillStyle = palette.background;
    context.fillRect(740, specimenY, 436, specimenHeight);
    context.beginPath();
    context.moveTo(740, specimenY);
    context.lineTo(740, specimenY + specimenHeight);
    context.stroke();
  } else {
    drawScene(context, options.scene, 36, specimenY, 1_140, specimenHeight, palette);
  }

  drawRule(context, ruleX, specimenBaseline, scaleGuide, palette.foreground);
  drawProfile(
    context,
    profileImage,
    profileCenterX - scaleGuide.growthPixels / 2,
    specimenBaseline - scaleGuide.growthPixels,
    scaleGuide.growthPixels,
    palette.orange,
    palette.lime,
  );
  drawDimension(
    context,
    "vertical",
    profileCenterX,
    specimenBaseline,
    scaleGuide.growthPixels,
    scaleGuide.growthPixels / 2 + 18,
    palette.lime,
  );

  await drawScaleSilhouette(
    context,
    nearest.key,
    comparisonCenterX,
    specimenBaseline,
    scaleGuide.comparisonPixels,
    palette.foreground,
  );
  const comparisonSpec = SCALE_ART_SPECS[nearest.key];
  const comparisonMeasuredUnits =
    comparisonSpec.axis === "horizontal"
      ? comparisonSpec.xMax - comparisonSpec.xMin
      : comparisonSpec.yMax - comparisonSpec.yMin;
  const comparisonArtScale = scaleGuide.comparisonPixels / comparisonMeasuredUnits;
  const comparisonDimensionOffset =
    comparisonSpec.axis === "horizontal"
      ? 18
      : ((comparisonSpec.xMax - comparisonSpec.xMin) * comparisonArtScale) / 2 + 18;
  drawDimension(
    context,
    comparisonSpec.axis,
    comparisonCenterX,
    specimenBaseline,
    scaleGuide.comparisonPixels,
    comparisonDimensionOffset,
    palette.lime,
  );
  drawScaleCaption(context, nearest, comparisonCenterX, specimenBaseline + 48, palette);

  context.fillStyle = palette.foreground;
  setFont(context, 18, 600);
  context.fillText(SCENE_LABELS[options.scene], 72, specimenY + specimenHeight - 32);
  context.textAlign = "right";
  context.fillText(options.layout.toUpperCase(), 1_128, specimenY + specimenHeight - 32);
  context.textAlign = "left";

  // RECORD / 430
  const recordY = 900;
  context.fillStyle = palette.background;
  context.fillRect(36, recordY, 1_140, 430);
  context.beginPath();
  context.moveTo(24, recordY);
  context.lineTo(1_176, recordY);
  context.stroke();
  context.fillStyle = palette.quiet;
  setFont(context, 18, 600);
  context.fillText("CERTIFIED LENGTH", 72, recordY + 52);
  context.fillStyle = palette.foreground;
  setFont(context, 106, 800, '"Archivo", "Noto Sans JP", sans-serif');
  context.fillText(formatLength(snapshot.growthTicks), 72, recordY + 162, 1_020);
  context.beginPath();
  context.moveTo(72, recordY + 200);
  context.lineTo(1_128, recordY + 200);
  context.stroke();

  const columnWidth = 248;
  drawLabel(
    context,
    "CURRENT RANK",
    snapshot.rank ? `#${snapshot.rank}` : "—",
    72,
    recordY + 250,
    columnWidth,
    palette,
  );
  drawLabel(
    context,
    "GARDEN AGE",
    `${snapshot.gardenAgeDays} DAYS`,
    336,
    recordY + 250,
    columnWidth,
    palette,
  );
  drawLabel(
    context,
    "AUTO GROWTH",
    `${formatLength(snapshot.autoTicksPerSecond)}/S`,
    600,
    recordY + 250,
    columnWidth,
    palette,
  );
  drawLabel(
    context,
    "EQUIPMENT",
    `G${snapshot.glovesLevel} / R${snapshot.rainBarrelLevel}`,
    864,
    recordY + 250,
    columnWidth,
    palette,
  );

  // FOOTER / 170
  const footerY = 1_330;
  context.beginPath();
  context.moveTo(24, footerY);
  context.lineTo(1_176, footerY);
  context.stroke();
  context.fillStyle = palette.quiet;
  setFont(context, 17, 600);
  context.fillText("NEAREST SCALE / APPROX.", 72, footerY + 42);
  context.fillText("ODD INDEX", 72, footerY + 101);
  context.fillStyle = palette.foreground;
  setFont(context, 24, 600, '"Noto Sans JP", sans-serif');
  context.fillText(formatScaleComparison(snapshot), 360, footerY + 42, 590);
  context.fillText(formatOddComparison(snapshot), 360, footerY + 101, 590);
  context.textAlign = "right";
  setFont(context, 18, 600);
  context.fillText(`REV. ${String(snapshot.revision).padStart(6, "0")}`, 1_128, footerY + 42);
  context.fillStyle = palette.orange;
  setFont(context, 27, 700);
  context.fillText("ARCHIVE PLATE", 1_128, footerY + 101);
  context.textAlign = "left";
};
