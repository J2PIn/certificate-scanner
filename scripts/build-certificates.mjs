import fs from "node:fs";

const INPUT = "public/data/nordnet-ustech.csv";
const OUTPUT = "public/data/certificates.json";

const assumptions = {
  snapshotTime: process.env.SNAPSHOT_TIME || new Date().toISOString(),
  source: "Nordnet Markets CSV export",
  notes: process.env.NOTES || "USTECH/NASDAQ 100 scanner snapshot",

  underlying: process.env.UNDERLYING || "USTECH100",
  underlyingPrice: Number(process.env.UNDERLYING_PRICE),
  underlyingMovePct: Number(process.env.UNDERLYING_MOVE_PCT),
  ivAnnualPct: Number(process.env.IV_ANNUAL_PCT),
  hoursLeft: Number(process.env.HOURS_LEFT),

  rsi4: Number(process.env.RSI4),
  ema8: Number(process.env.EMA8),
  ema21: Number(process.env.EMA21),
  ema65: Number(process.env.EMA65),
  ma50: Number(process.env.MA50),
  ma200: Number(process.env.MA200),
  vwap: Number(process.env.VWAP),
};

const requiredAssumptions = [
  "underlyingPrice",
  "underlyingMovePct",
  "ivAnnualPct",
  "hoursLeft",
  "rsi4",
  "ema8",
  "ema21",
  "ema65",
  "ma50",
  "ma200",
  "vwap",
];

for (const key of requiredAssumptions) {
  if (!Number.isFinite(assumptions[key])) {
    console.error(`Missing required env input: ${key}`);
    process.exit(1);
  }
}

function parseNumber(value) {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseTsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "\t" && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift().map((h, i) => h.trim() || `blank_${i}`);
  return rows.map((values) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? "";
    });
    return obj;
  });
}

function estimatedKnockoutLevel(direction, underlyingPrice, leverage) {
  const distance = 1 / leverage;
  if (direction === "BULL") return underlyingPrice * (1 - distance);
  return underlyingPrice * (1 + distance);
}

const raw = fs.readFileSync(INPUT);
const text = raw.toString("utf16le").replace(/^\uFEFF/, "");
const parsed = parseTsv(text);

const certificates = parsed
  .filter((row) => {
    const underlying = String(row["Kohde-etuus"] || "").toLowerCase();
    const name = String(row["Nimi"] || "").toLowerCase();

    return (
      underlying.includes("nasdaq") ||
      underlying.includes("ustech") ||
      name.includes("nasdaq") ||
      name.includes("ustech")
    );
  })
  .map((row) => {
    const view = String(row["Näkemys"] || "").toLowerCase();
    const direction = view === "long" ? "BULL" : "BEAR";
    const leverage = parseNumber(row["Vipu"]);
    const bid = parseNumber(row["Osto"]);
    const ask = parseNumber(row["Myynti"]);
    const nordnetTurnover = parseNumber(row["Vaihto"]);
    const nordnetListedSpreadPct = parseNumber(row["blank_7"]);

    return {
      isin: row["ISIN"],
      name: row["Nimi"],
      currency: row["Valuutta"],
      issuerUnderlying: row["Kohde-etuus"],
      underlying: assumptions.underlying,
      direction,
      leverage,

      underlyingPrice: assumptions.underlyingPrice,
      underlyingMovePct: assumptions.underlyingMovePct,

      knockoutLevel: estimatedKnockoutLevel(direction, assumptions.underlyingPrice, leverage),
      koEstimated: true,

      bid,
      ask,
      nordnetListedSpreadPct,
      nordnetTurnover,

      ivAnnualPct: assumptions.ivAnnualPct,
      hoursLeft: assumptions.hoursLeft,

      rsi4: assumptions.rsi4,
      ema8: assumptions.ema8,
      ema21: assumptions.ema21,
      ema65: assumptions.ema65,
      ma50: assumptions.ma50,
      ma200: assumptions.ma200,
      vwap: assumptions.vwap,
    };
  })
  .filter((row) => row.leverage && row.bid && row.ask)
  .sort((a, b) => {
    const turnoverDiff = (b.nordnetTurnover || 0) - (a.nordnetTurnover || 0);
    if (turnoverDiff !== 0) return turnoverDiff;
    return b.leverage - a.leverage;
  });

const output = {
  meta: {
    snapshotTime: assumptions.snapshotTime,
    source: assumptions.source,
    notes: assumptions.notes,
    rowCount: certificates.length,
    warning: "Knockout levels are estimated from leverage. Replace with exact KO levels when available.",
  },
  certificates,
};

fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
console.log(`Wrote ${certificates.length} rows to ${OUTPUT}`);
