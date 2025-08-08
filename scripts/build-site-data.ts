import { WORD_CONFIG } from "../config";
import {
  readdirSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { join, basename } from "node:path";

type WordKey = keyof typeof WORD_CONFIG;

type EvalRow = {
  model: string;
  status: "correct" | "incorrect" | "no-response";
};

type WordResult = {
  word: WordKey;
  latestDate: string | null;
  resultsByDate: Record<string, EvalRow[]>; // date -> rows
  leaderboard: {
    model: string;
    correct: number;
    incorrect: number;
    no_response: number;
    accuracy: number;
  }[];
};

function parseCsv(content: string): EvalRow[] {
  const lines = content.trim().split(/\r?\n/);
  const out: EvalRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const [model, status] = lines[i].split(",");
    if (!model || !status) continue;
    const normalized = status.trim() as EvalRow["status"];
    if (!["correct", "incorrect", "no-response"].includes(normalized)) continue;
    out.push({ model: model.trim(), status: normalized });
  }
  return out;
}

function collectDates(responsesDir: string): string[] {
  return readdirSync(responsesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /\d{4}-\d{2}-\d{2}/.test(d.name))
    .map((d) => d.name)
    .sort();
}

function readWordCsvForDate(
  responsesDir: string,
  dateDir: string,
  word: string
): EvalRow[] | null {
  const csvPath = join(responsesDir, dateDir, word, "evaluation.csv");
  try {
    const content = readFileSync(csvPath, "utf8");
    return parseCsv(content);
  } catch {
    return null;
  }
}

function buildLeaderboard(
  resultsByDate: Record<string, EvalRow[]>
): WordResult["leaderboard"] {
  const totals = new Map<
    string,
    { correct: number; incorrect: number; no_response: number }
  >();
  for (const rows of Object.values(resultsByDate)) {
    for (const row of rows) {
      if (!totals.has(row.model)) {
        totals.set(row.model, { correct: 0, incorrect: 0, no_response: 0 });
      }
      const t = totals.get(row.model)!;
      if (row.status === "correct") t.correct++;
      else if (row.status === "incorrect") t.incorrect++;
      else t.no_response++;
    }
  }
  const leaderboard = Array.from(totals.entries()).map(([model, t]) => {
    const attempts = t.correct + t.incorrect + t.no_response;
    const accuracy = attempts ? t.correct / attempts : 0;
    return {
      model,
      correct: t.correct,
      incorrect: t.incorrect,
      no_response: t.no_response,
      accuracy,
    };
  });
  leaderboard.sort(
    (a, b) =>
      b.accuracy - a.accuracy ||
      b.correct - a.correct ||
      a.model.localeCompare(b.model)
  );
  return leaderboard;
}

function main() {
  const responsesDir = join(process.cwd(), "responses");
  const dates = collectDates(responsesDir);
  const words: WordKey[] = Object.keys(WORD_CONFIG) as WordKey[];

  const byWord: WordResult[] = [];

  for (const word of words) {
    const resultsByDate: Record<string, EvalRow[]> = {};
    for (const date of dates) {
      const rows = readWordCsvForDate(responsesDir, date, word);
      if (rows && rows.length) resultsByDate[date] = rows;
    }
    const latestDate =
      dates.filter((d) => resultsByDate[d])?.slice(-1)[0] ?? null;
    const leaderboard = buildLeaderboard(resultsByDate);
    byWord.push({ word, latestDate, resultsByDate, leaderboard });
  }

  const outDir = join(process.cwd(), "site");
  if (!existsSync(outDir)) mkdirSync(outDir);
  const outPath = join(outDir, "data.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      { words: byWord, generatedAt: new Date().toISOString() },
      null,
      2
    )
  );
  // eslint-disable-next-line no-console
  console.log(`Wrote ${basename(outPath)}`);
}

main();
