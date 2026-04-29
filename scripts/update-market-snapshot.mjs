import fs from "node:fs";

const OUTPUT = "public/data/market-snapshot.json";

function requiredNumber(name) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) {
    console.error(`Missing or invalid env var: ${name}`);
    process.exit(1);
  }
  return value;
}

function optionalText(name, fallback) {
  return process.env[name] || fallback;
}

const snapshot = {
  snapshotTime: new Date().toISOString(),
  source: optionalText("SOURCE", "Manual USTECH100 snapshot"),
  underlyings: {
    [optionalText("UNDERLYING", "USTECH100")]: {
      underlyingPrice: requiredNumber("UNDERLYING_PRICE"),
      underlyingMovePct: requiredNumber("UNDERLYING_MOVE_PCT"),
      ivAnnualPct: requiredNumber("IV_ANNUAL_PCT"),
      hoursLeft: requiredNumber("HOURS_LEFT"),

      rsi4: requiredNumber("RSI4"),
      ema8: requiredNumber("EMA8"),
      ema21: requiredNumber("EMA21"),
      ema65: requiredNumber("EMA65"),
      ma50: requiredNumber("MA50"),
      ma200: requiredNumber("MA200"),
      vwap: requiredNumber("VWAP")
    }
  }
};

fs.mkdirSync("public/data", { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(snapshot, null, 2));

console.log(`Wrote ${OUTPUT}`);
console.log(`Snapshot time: ${snapshot.snapshotTime}`);
console.log(`Underlying: ${Object.keys(snapshot.underlyings)[0]}`);
console.log(`Price: ${snapshot.underlyings[Object.keys(snapshot.underlyings)[0]].underlyingPrice}`);
