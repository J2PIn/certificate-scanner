import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Activity, ShieldAlert, TrendingUp, TrendingDown, SlidersHorizontal } from "lucide-react";

const ANNUAL_TRADING_HOURS = 252 * 6.5;

const mockRows = [
  {
    isin: "MOCK-USTECH-BEAR-20",
    name: "BEAR USTECH100 X20",
    underlying: "USTECH100",
    direction: "BEAR",
    leverage: 20,
    underlyingMovePct: -1.32,
    underlyingPrice: 18450,
    knockoutLevel: 18940,
    bid: 1.42,
    ask: 1.45,
    ivAnnualPct: 24.5,
    hoursLeft: 3.5,
    rsi4: 18.5,
    ema8: 18472,
    ema21: 18518,
    ema65: 18610,
    ma50: 18640,
    ma200: 18820,
    vwap: 18555,
  },
  {
    isin: "MOCK-USTECH-BULL-15",
    name: "BULL USTECH100 X15",
    underlying: "USTECH100",
    direction: "BULL",
    leverage: 15,
    underlyingMovePct: -1.32,
    underlyingPrice: 18450,
    knockoutLevel: 18020,
    bid: 0.94,
    ask: 0.96,
    ivAnnualPct: 24.5,
    hoursLeft: 3.5,
    rsi4: 12.0,
    ema8: 18472,
    ema21: 18518,
    ema65: 18610,
    ma50: 18640,
    ma200: 18820,
    vwap: 18555,
  },
  {
    isin: "MOCK-DAX-BEAR-10",
    name: "BEAR DAX X10",
    underlying: "GER40",
    direction: "BEAR",
    leverage: 10,
    underlyingMovePct: -0.65,
    underlyingPrice: 18210,
    knockoutLevel: 18980,
    bid: 2.11,
    ask: 2.15,
    ivAnnualPct: 18.0,
    hoursLeft: 2.2,
    rsi4: 29.8,
    ema8: 18225,
    ema21: 18270,
    ema65: 18320,
    ma50: 18335,
    ma200: 18410,
    vwap: 18290,
  },
  {
    isin: "MOCK-SPX-BULL-20",
    name: "BULL SPX X20",
    underlying: "SPX500",
    direction: "BULL",
    leverage: 20,
    underlyingMovePct: 0.48,
    underlyingPrice: 5160,
    knockoutLevel: 5025,
    bid: 1.08,
    ask: 1.13,
    ivAnnualPct: 21.2,
    hoursLeft: 4.1,
    rsi4: 74.5,
    ema8: 5154,
    ema21: 5148,
    ema65: 5136,
    ma50: 5132,
    ma200: 5080,
    vwap: 5146,
  },
];

function pct(n) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function spreadPct(row) {
  const mid = (row.bid + row.ask) / 2;
  return ((row.ask - row.bid) / mid) * 100;
}

function expectedMovePct(ivAnnualPct, hoursLeft) {
  return ivAnnualPct * Math.sqrt(hoursLeft / ANNUAL_TRADING_HOURS);
}

function koDistancePct(row) {
  if (row.direction === "BULL") {
    return ((row.underlyingPrice - row.knockoutLevel) / row.underlyingPrice) * 100;
  }
  return ((row.knockoutLevel - row.underlyingPrice) / row.underlyingPrice) * 100;
}

function trendScore(row) {
  const bearishStack = row.ema8 < row.ema21 && row.ema21 < row.ema65 && row.ema65 < row.ma200;
  const bullishStack = row.ema8 > row.ema21 && row.ema21 > row.ema65 && row.ema65 > row.ma200;
  const belowVwap = row.underlyingPrice < row.vwap;
  const aboveVwap = row.underlyingPrice > row.vwap;

  if (row.direction === "BEAR") {
    return (bearishStack ? 35 : 10) + (belowVwap ? 15 : 0) + (row.underlyingMovePct < 0 ? 15 : -10);
  }
  return (bullishStack ? 35 : 10) + (aboveVwap ? 15 : 0) + (row.underlyingMovePct > 0 ? 15 : -10);
}

function exhaustionPenalty(row) {
  if (row.direction === "BEAR" && row.rsi4 < 20) return 22;
  if (row.direction === "BULL" && row.rsi4 > 80) return 22;
  if (row.direction === "BEAR" && row.rsi4 < 30) return 12;
  if (row.direction === "BULL" && row.rsi4 > 70) return 12;
  return 0;
}

function requiredFieldIssues(row) {
  const required = [
    "isin",
    "name",
    "underlying",
    "direction",
    "leverage",
    "underlyingPrice",
    "underlyingMovePct",
    "knockoutLevel",
    "bid",
    "ask",
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

  const issues = [];
  for (const key of required) {
    const value = row[key];
    if (value === undefined || value === null || value === "") issues.push(`missing ${key}`);
  }

  if (row.direction && !["BULL", "BEAR"].includes(String(row.direction).toUpperCase())) {
    issues.push("direction must be BULL or BEAR");
  }

  for (const key of ["leverage", "underlyingPrice", "knockoutLevel", "bid", "ask", "ivAnnualPct", "hoursLeft"]) {
    const value = Number(row[key]);
    if (row[key] !== undefined && row[key] !== null && row[key] !== "" && (!Number.isFinite(value) || value <= 0)) {
      issues.push(`${key} must be positive`);
    }
  }

  if (Number(row.bid) > 0 && Number(row.ask) > 0 && Number(row.ask) < Number(row.bid)) {
    issues.push("ask below bid");
  }

  if (Number(row.rsi4) < 0 || Number(row.rsi4) > 100) {
    issues.push("rsi4 outside 0–100");
  }

  return issues;
}

function normalizeRow(row) {
  const direction = String(row.direction || "").toUpperCase();
  return {
    ...row,
    direction,
    leverage: Number(row.leverage),
    underlyingMovePct: Number(row.underlyingMovePct),
    underlyingPrice: Number(row.underlyingPrice),
    knockoutLevel: Number(row.knockoutLevel),
    bid: Number(row.bid),
    ask: Number(row.ask),
    ivAnnualPct: Number(row.ivAnnualPct),
    hoursLeft: Number(row.hoursLeft),
    rsi4: Number(row.rsi4),
    ema8: Number(row.ema8),
    ema21: Number(row.ema21),
    ema65: Number(row.ema65),
    ma50: Number(row.ma50),
    ma200: Number(row.ma200),
    vwap: Number(row.vwap),
    nordnetTurnover: row.nordnetTurnover === undefined || row.nordnetTurnover === null || row.nordnetTurnover === "" ? undefined : Number(row.nordnetTurnover),
    koEstimated: Boolean(row.koEstimated),
  };
}

function assumptionsSummary(rows, meta) {
  const list = Array.isArray(rows) ? rows : [];
  const total = list.length;
  const estimatedKo = list.filter((r) => r.koEstimated).length;
  const withTurnover = list.filter((r) => r.nordnetTurnover !== undefined && r.nordnetTurnover !== null && r.nordnetTurnover !== "").length;
  const uniqueUnderlyings = [...new Set(list.map((r) => r.underlying).filter(Boolean))];
  const sample = list[0] || {};

  const taFlat = ["ema8", "ema21", "ema65", "ma50", "ma200", "vwap"].every((key) => Number(sample[key]) === Number(sample.underlyingPrice));

  return {
    total,
    estimatedKo,
    withTurnover,
    uniqueUnderlyings,
    taFlat,
    snapshotTime: meta?.snapshotTime,
    source: meta?.source,
    warning: meta?.warning,
  };
}

function classify(row) {
  const qualityIssues = requiredFieldIssues(row);
  if (qualityIssues.length) {
    return {
      em: 0,
      ko: 0,
      survival: 0,
      spread: 0,
      levMove: 0,
      trend: 0,
      penalty: 0,
      score: 0,
      verdict: "Data issue",
      qualityIssues,
      quality: "Bad",
    };
  }

  const clean = normalizeRow(row);
  const em = expectedMovePct(clean.ivAnnualPct, clean.hoursLeft);
  const ko = koDistancePct(clean);
  const survival = ko / Math.max(em, 0.01);
  const spread = spreadPct(clean);
  const levMove = em * clean.leverage;
  const trend = trendScore(clean);
  const penalty = exhaustionPenalty(clean);

  let score = 0;
  score += Math.min(35, survival * 10);
  score += Math.min(25, levMove * 1.3);
  score += trend;
  score -= Math.min(25, spread * 4);
  score -= penalty;
  score = Math.max(0, Math.min(100, score));

  let verdict = "Avoid";
  if (score >= 75 && survival >= 2.2 && spread <= 1.5) verdict = "Candidate";
  else if (score >= 55 && survival >= 1.5) verdict = "Watch";
  else if (survival < 1.2) verdict = "Fuse too short";
  else if (penalty >= 12) verdict = "Stretched";

  const warnings = [];
  if (survival < 1.2) warnings.push("KO sits inside expected move");
  if (spread > 2.5) warnings.push("wide spread");
  if (clean.ivAnnualPct < 5 || clean.ivAnnualPct > 80) warnings.push("check IV input");
  if (clean.hoursLeft > 12) warnings.push("hoursLeft seems high for intraday scan");
  if (clean.koEstimated) warnings.push("KO estimated from leverage");

  return {
    em,
    ko,
    survival,
    spread,
    levMove,
    trend,
    penalty,
    score,
    verdict,
    qualityIssues: warnings,
    quality: warnings.length ? "Warn" : "Good",
  };
}

function Pill({ children, tone = "neutral" }) {
  const cls = {
    neutral: "bg-zinc-100 text-zinc-700 border-zinc-200",
    good: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    bad: "bg-rose-50 text-rose-700 border-rose-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${cls}`}>{children}</span>;
}

function verdictTone(v) {
  if (v === "Candidate") return "good";
  if (v === "Watch" || v === "Stretched") return "warn";
  return "bad";
}

function qualityTone(q) {
  if (q === "Good") return "good";
  if (q === "Warn") return "warn";
  return "bad";
}

export default function CertificateScannerDashboard() {
  const [sourceRows, setSourceRows] = useState(mockRows);
  const [dataStatus, setDataStatus] = useState("Loading /data/certificates.json …");
  const [dataMeta, setDataMeta] = useState(null);
  const [marketSnapshot, setMarketSnapshot] = useState(null);
  const [marketStatus, setMarketStatus] = useState("Loading /data/market-snapshot.json …");
  const [marketFetchedAt, setMarketFetchedAt] = useState(null);
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("ALL");
  const [minSurvival, setMinSurvival] = useState(0);
  const [maxSpread, setMaxSpread] = useState(5);

  useEffect(() => {
    let alive = true;

    async function loadCertificates() {
      try {
        const res = await fetch("/data/certificates.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rows = Array.isArray(data) ? data : data.certificates;
        const meta = Array.isArray(data) ? null : data.meta || null;
        if (!Array.isArray(rows)) throw new Error("certificates.json must be an array or { meta, certificates }");
        if (alive) {
          setSourceRows(rows.length ? rows : mockRows);
          setDataMeta(meta);
          setDataStatus(rows.length ? `Loaded ${rows.length} rows from certificates.json` : "certificates.json is empty; using mock rows");
        }
      } catch (err) {
        if (alive) {
          setSourceRows(mockRows);
          setDataMeta(null);
          setDataStatus(`Using mock rows — could not load certificates.json: ${err.message}`);
        }
      }
    }

    loadCertificates();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let timer = null;

    async function loadMarketSnapshot() {
      try {
        const res = await fetch(`/data/market-snapshot.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data || typeof data !== "object") throw new Error("market-snapshot.json must be an object");
        if (alive) {
          setMarketSnapshot(data);
          setMarketFetchedAt(new Date());
          setMarketStatus(`Market snapshot loaded`);
        }
      } catch (err) {
        if (alive) {
          setMarketSnapshot(null);
          setMarketFetchedAt(null);
          setMarketStatus("No live snapshot — using certificate JSON assumptions");
        }
      }
    }

    loadMarketSnapshot();
    timer = setInterval(loadMarketSnapshot, 30000);

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  const rows = useMemo(() => {
    const overlayedRows = sourceRows.map((row) => {
      const live = marketSnapshot?.underlyings?.[row.underlying] || marketSnapshot?.underlyings?.[row.issuerUnderlying];
      if (!live) return row;

      const merged = {
        ...row,
        underlyingPrice: live.underlyingPrice ?? row.underlyingPrice,
        underlyingMovePct: live.underlyingMovePct ?? row.underlyingMovePct,
        ivAnnualPct: live.ivAnnualPct ?? row.ivAnnualPct,
        hoursLeft: live.hoursLeft ?? row.hoursLeft,
        rsi4: live.rsi4 ?? row.rsi4,
        ema8: live.ema8 ?? row.ema8,
        ema21: live.ema21 ?? row.ema21,
        ema65: live.ema65 ?? row.ema65,
        ma50: live.ma50 ?? row.ma50,
        ma200: live.ma200 ?? row.ma200,
        vwap: live.vwap ?? row.vwap,
        marketSnapshotTime: live.snapshotTime ?? marketSnapshot?.snapshotTime,
      };

      if (merged.koEstimated && Number.isFinite(Number(merged.leverage)) && Number.isFinite(Number(merged.underlyingPrice))) {
        const lev = Number(merged.leverage);
        const px = Number(merged.underlyingPrice);
        merged.knockoutLevel = merged.direction === "BULL" ? px * (1 - 1 / lev) : px * (1 + 1 / lev);
      }

      return merged;
    });

    return overlayedRows
      .map((row) => ({ ...row, metrics: classify(row) }))
      .filter((row) => {
        const q = query.trim().toLowerCase();
        const matchesQuery = !q || row.name.toLowerCase().includes(q) || row.underlying.toLowerCase().includes(q) || row.isin.toLowerCase().includes(q);
        const matchesDirection = direction === "ALL" || row.direction === direction;
        const matchesSurvival = row.metrics.survival >= minSurvival;
        const matchesSpread = row.metrics.spread <= maxSpread;
        return matchesQuery && matchesDirection && matchesSurvival && matchesSpread;
      })
      .sort((a, b) => b.metrics.score - a.metrics.score);
  }, [sourceRows, marketSnapshot, query, direction, minSurvival, maxSpread]);

  const best = rows[0];
  const assumptionInfo = useMemo(() => assumptionsSummary(sourceRows, dataMeta), [sourceRows, dataMeta]);

  return (
    <div className="min-h-screen bg-zinc-950 p-4 text-zinc-100 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-zinc-300">
                <Activity size={16} /> {dataStatus}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">IV-adjusted Nordnet certificate dashboard</h1>
              <p className="mt-3 max-w-3xl text-zinc-400">
                Ranks leveraged bull/bear certificates by expected underlying move, distance to knockout, spread cost, trend alignment, and RSI exhaustion risk.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                <Pill tone={marketSnapshot ? "good" : "warn"}>{marketStatus}</Pill>
                {marketSnapshot?.snapshotTime && <Pill>File time {marketSnapshot.snapshotTime}</Pill>}
                {marketFetchedAt && <Pill>Fetched local {marketFetchedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</Pill>}
              </div>
              {dataMeta && (
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
                  {dataMeta.snapshotTime && <Pill>Snapshot {dataMeta.snapshotTime}</Pill>}
                  {dataMeta.source && <Pill>Source {dataMeta.source}</Pill>}
                  {dataMeta.notes && <Pill>{dataMeta.notes}</Pill>}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 md:w-80">
              <div className="text-sm text-zinc-500">Current top row</div>
              {best ? (
                <div className="mt-2 space-y-2">
                  <div className="text-lg font-semibold">{best.name}</div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={verdictTone(best.metrics.verdict)}>{best.metrics.verdict}</Pill>
                    <Pill tone="blue">Score {best.metrics.score.toFixed(0)}</Pill>
                    <Pill>Survival {best.metrics.survival.toFixed(2)}x</Pill>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-zinc-400">No rows match filters.</div>
              )}
            </div>
          </div>
        </motion.div>

        <div className="rounded-3xl border border-amber-500/20 bg-amber-950/20 p-5 text-sm text-amber-100 shadow-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-base font-semibold">Data reality check</div>
              <p className="mt-1 max-w-4xl text-amber-100/80">
                This is a scanner, not an execution tool. Nordnet certificate rows are real from the CSV. Underlying price, IV, hours left, and TA inputs can now be overlaid from market-snapshot.json every 30 seconds.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Pill tone="warn">Rows {assumptionInfo.total}</Pill>
              <Pill tone="warn">KO estimated {assumptionInfo.estimatedKo}</Pill>
              <Pill tone="neutral">Turnover rows {assumptionInfo.withTurnover}</Pill>
              {assumptionInfo.taFlat && <Pill tone="bad">TA placeholder mode</Pill>}
            </div>
          </div>
          <div className="mt-4 grid gap-3 text-xs text-amber-100/75 md:grid-cols-4">
            <div className="rounded-2xl border border-amber-500/20 bg-zinc-950/40 p-3">
              <div className="font-medium text-amber-100">Real from CSV</div>
              <div className="mt-1">Name, ISIN, direction, leverage, bid, ask, turnover.</div>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-zinc-950/40 p-3">
              <div className="font-medium text-amber-100">Manual snapshot</div>
              <div className="mt-1">Underlying price, move %, IV, and hours left from market-snapshot.json when available.</div>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-zinc-950/40 p-3">
              <div className="font-medium text-amber-100">Placeholder until wired</div>
              <div className="mt-1">EMA/MA, RSI4, and VWAP unless manually entered.</div>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-zinc-950/40 p-3">
              <div className="font-medium text-amber-100">Not exact yet</div>
              <div className="mt-1">KO is estimated from leverage. Replace with exact issuer KO later.</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between text-zinc-400"><span>Expected move</span><TrendingUp size={18} /></div>
            <div className="mt-2 text-2xl font-semibold">IV × √time</div>
            <p className="mt-1 text-sm text-zinc-500">Remaining-session move estimate for the underlying.</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between text-zinc-400"><span>Survival score</span><ShieldAlert size={18} /></div>
            <div className="mt-2 text-2xl font-semibold">KO / exp. move</div>
            <p className="mt-1 text-sm text-zinc-500">Below 1.2x usually means the fuse is too short.</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between text-zinc-400"><span>Leverage envelope</span><TrendingDown size={18} /></div>
            <div className="mt-2 text-2xl font-semibold">EM × leverage</div>
            <p className="mt-1 text-sm text-zinc-500">Turns underlying movement into certificate risk.</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between text-zinc-400"><span>Timing filter</span><SlidersHorizontal size={18} /></div>
            <div className="mt-2 text-2xl font-semibold">EMA + RSI4</div>
            <p className="mt-1 text-sm text-zinc-500">Separates trend continuation from late chasing.</p>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-zinc-500" size={18} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search underlying, ISIN, name" className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-3 pl-10 pr-3 text-sm outline-none focus:border-zinc-600" />
            </div>
            <select value={direction} onChange={(e) => setDirection(e.target.value)} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm outline-none focus:border-zinc-600">
              <option value="ALL">All directions</option>
              <option value="BULL">Bull only</option>
              <option value="BEAR">Bear only</option>
            </select>
            <label className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400">
              Min survival: <span className="text-zinc-100">{minSurvival.toFixed(1)}x</span>
              <input type="range" min="0" max="4" step="0.1" value={minSurvival} onChange={(e) => setMinSurvival(Number(e.target.value))} className="mt-2 w-full" />
            </label>
            <label className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400">
              Max spread: <span className="text-zinc-100">{maxSpread.toFixed(1)}%</span>
              <input type="range" min="0.2" max="8" step="0.1" value={maxSpread} onChange={(e) => setMaxSpread(Number(e.target.value))} className="mt-2 w-full" />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-separate border-spacing-y-2 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Certificate</th>
                  <th className="px-3 py-2">Dir</th>
                  <th className="px-3 py-2">Lev</th>
                  <th className="px-3 py-2">Underlying</th>
                  <th className="px-3 py-2">IV</th>
                  <th className="px-3 py-2">Exp. move</th>
                  <th className="px-3 py-2">KO dist.</th>
                  <th className="px-3 py-2">Survival</th>
                  <th className="px-3 py-2">Spread</th>
                  <th className="px-3 py-2">RSI4</th>
                  <th className="px-3 py-2">Turnover</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.isin} className="rounded-2xl bg-zinc-950/80 align-middle text-zinc-200">
                    <td className="rounded-l-2xl px-3 py-4">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-zinc-500">{row.isin}</div>
                    </td>
                    <td className="px-3 py-4"><Pill tone={row.direction === "BULL" ? "good" : "bad"}>{row.direction}</Pill></td>
                    <td className="px-3 py-4">{row.leverage}x</td>
                    <td className="px-3 py-4">
                      <div>{row.underlying}</div>
                      <div className={row.underlyingMovePct >= 0 ? "text-emerald-400" : "text-rose-400"}>{pct(row.underlyingMovePct)}</div>
                    </td>
                    <td className="px-3 py-4">{row.ivAnnualPct.toFixed(1)}%</td>
                    <td className="px-3 py-4">{row.metrics.em.toFixed(2)}%</td>
                    <td className="px-3 py-4">{row.metrics.ko.toFixed(2)}%</td>
                    <td className="px-3 py-4">{row.metrics.survival.toFixed(2)}x</td>
                    <td className="px-3 py-4">{row.metrics.spread.toFixed(2)}%</td>
                    <td className="px-3 py-4">{row.rsi4.toFixed(1)}</td>
                    <td className="px-3 py-4">{row.nordnetTurnover === undefined ? "—" : Number(row.nordnetTurnover).toLocaleString()}</td>
                    <td className="px-3 py-4 font-semibold">{row.metrics.score.toFixed(0)}</td>
                    <td className="px-3 py-4">
                      <div className="flex flex-col gap-1">
                        <Pill tone={qualityTone(row.metrics.quality)}>{row.metrics.quality}</Pill>
                        {row.metrics.qualityIssues.length > 0 && (
                          <div className="max-w-48 text-xs text-zinc-500" title={row.metrics.qualityIssues.join("; ")}>
                            {row.metrics.qualityIssues.slice(0, 2).join("; ")}
                            {row.metrics.qualityIssues.length > 2 ? " …" : ""}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="rounded-r-2xl px-3 py-4"><Pill tone={verdictTone(row.metrics.verdict)}>{row.metrics.verdict}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">
          <div className="font-medium text-zinc-200">Next build step</div>
          <p className="mt-2">
            Next: automate market-snapshot.json with a Worker or local script, then add live certificate bid/ask/spread refresh. Keep scoring deterministic and log every ranked decision for later backtesting.
          </p>
        </div>
      </div>
    </div>
  );
}
