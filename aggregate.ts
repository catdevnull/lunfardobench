#!/usr/bin/env bun
import { readdir, readFile, stat, writeFile } from "fs/promises";
import { join, basename } from "path";

type EvaluationStatus = "correct" | "incorrect" | "no-response";

interface PerWordEvaluations {
  word: string;
  byModel: Record<string, EvaluationStatus>;
}

interface AggregateByModel {
  model: string;
  resultsByWord: Record<string, EvaluationStatus | undefined>;
  totalCorrect: number;
  accuracy: number; // 0..1
}

async function readWordEvaluationCsv(
  csvPath: string
): Promise<Record<string, EvaluationStatus>> {
  const content = await readFile(csvPath, "utf-8");
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length <= 1) return {};

  // Skip header line
  const rows = lines.slice(1);
  const byModel: Record<string, EvaluationStatus> = {};
  for (const line of rows) {
    const [modelRaw, statusRaw] = line.split(",");
    if (!modelRaw || !statusRaw) continue;
    const model = modelRaw.trim();
    const status = statusRaw.trim() as EvaluationStatus;
    if (
      status === "correct" ||
      status === "incorrect" ||
      status === "no-response"
    ) {
      byModel[model] = status;
    }
  }
  return byModel;
}

async function discoverWords(dateDir: string): Promise<string[]> {
  const entries = await readdir(dateDir, { withFileTypes: true });
  const words: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const wordDir = join(dateDir, entry.name);
    const evalCsv = join(wordDir, "evaluation.csv");
    const hasCsv = await stat(evalCsv)
      .then((s) => s.isFile())
      .catch(() => false);
    if (hasCsv) words.push(entry.name);
  }
  return words.sort();
}

function statusToEmoji(status: EvaluationStatus | undefined): string {
  if (!status) return "—";
  if (status === "correct") return "✅";
  if (status === "incorrect") return "❌";
  return "—"; // no-response
}

function toPercentage(numerator: number, denominator: number): string {
  if (denominator === 0) return "0.0%";
  return ((numerator / denominator) * 100).toFixed(1) + "%";
}

function buildAggregateByModel(
  words: string[],
  perWord: PerWordEvaluations[]
): AggregateByModel[] {
  const modelSet = new Set<string>();
  for (const w of perWord) {
    for (const model of Object.keys(w.byModel)) modelSet.add(model);
  }

  const aggregates: AggregateByModel[] = [];
  for (const model of Array.from(modelSet)) {
    const resultsByWord: Record<string, EvaluationStatus | undefined> = {};
    let totalCorrect = 0;
    let totalAnswered = 0;
    for (const word of words) {
      const perWordMap = perWord.find((w) => w.word === word)?.byModel ?? {};
      const status = perWordMap[model];
      resultsByWord[word] = status;
      if (status) {
        totalAnswered += 1;
        if (status === "correct") totalCorrect += 1;
      }
    }
    const accuracy = totalAnswered === 0 ? 0 : totalCorrect / totalAnswered;
    aggregates.push({ model, resultsByWord, totalCorrect, accuracy });
  }

  aggregates.sort((a, b) => {
    if (b.totalCorrect !== a.totalCorrect)
      return b.totalCorrect - a.totalCorrect;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    return a.model.localeCompare(b.model);
  });

  return aggregates;
}

function buildMarkdown(
  dateDir: string,
  words: string[],
  aggregates: AggregateByModel[]
): string {
  const date = basename(dateDir);
  const header = `# Aggregate Evaluation Results for ${date}`;
  const summary = [
    `- Words included: ${words.length} (${words.join(", ")})`,
    `- Models evaluated: ${aggregates.length}`,
  ].join("\n");

  const tableHeader = `| Model | ${words
    .map((w) => `\`${w}\``)
    .join(" | ")} | Total Correct | Accuracy |`;
  const tableSep = `|-------|${words
    .map(() => "--------")
    .join("|")}|---------------|----------|`;
  const tableRows = aggregates
    .map((agg) => {
      const cells = words.map((w) => statusToEmoji(agg.resultsByWord[w]));
      return `| ${agg.model} | ${cells.join(" | ")} | ${
        agg.totalCorrect
      } | ${toPercentage(agg.totalCorrect, words.length)} |`;
    })
    .join("\n");

  const links = words.map((w) => `- [${w}](./${w}/index.md)`).join("\n");

  return `${header}

**Summary:**
${summary}

## Results by Model across Words

${tableHeader}
${tableSep}
${tableRows}

---
Per-cell legend: ✅ correct, ❌ incorrect, — no response

## Word Reports
${links}

*Generated on: ${new Date().toISOString()}*`;
}

function buildCsv(words: string[], aggregates: AggregateByModel[]): string {
  const header = ["Model", ...words, "total_correct", "accuracy"].join(",");
  const rows = aggregates.map((agg) => {
    const statuses = words.map((w) => agg.resultsByWord[w] ?? "");
    const accuracyPct = toPercentage(agg.totalCorrect, words.length);
    return [agg.model, ...statuses, String(agg.totalCorrect), accuracyPct].join(
      ","
    );
  });
  return [header, ...rows].join("\n");
}

async function main() {
  const dateDirArg = process.argv[2];
  if (!dateDirArg) {
    console.error(
      "Usage: bun run aggregate.ts <path-to-date-directory>\n" +
        "Example: bun run aggregate.ts ./responses/2025-08-07"
    );
    process.exit(1);
  }

  const dateDir = dateDirArg;
  const dirStat = await stat(dateDir).catch(() => null);
  if (!dirStat || !dirStat.isDirectory()) {
    console.error(`Path is not a directory: ${dateDir}`);
    process.exit(1);
  }

  const words = await discoverWords(dateDir);
  if (words.length === 0) {
    console.error(
      `No word subdirectories with evaluation.csv found under: ${dateDir}`
    );
    process.exit(1);
  }

  const perWord: PerWordEvaluations[] = [];
  for (const word of words) {
    const csvPath = join(dateDir, word, "evaluation.csv");
    const byModel = await readWordEvaluationCsv(csvPath);
    perWord.push({ word, byModel });
  }

  const aggregates = buildAggregateByModel(words, perWord);
  const md = buildMarkdown(dateDir, words, aggregates);
  const csv = buildCsv(words, aggregates);

  const mdOut = join(dateDir, "index.md");
  const csvOut = join(dateDir, "evaluation-aggregate.csv");
  await writeFile(mdOut, md, "utf-8");
  await writeFile(csvOut, csv, "utf-8");

  console.log("✅ Aggregate evaluation written:");
  console.log(`  - ${mdOut}`);
  console.log(`  - ${csvOut}`);
}

if (import.meta.main) {
  // eslint-disable-next-line no-console
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
