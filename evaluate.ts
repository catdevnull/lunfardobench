#!/usr/bin/env bun
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { readdir, readFile, writeFile, stat } from "fs/promises";
import { join, basename, dirname } from "path";
import pMap from "p-map";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error("Please set OPENROUTER_API_KEY environment variable");
  process.exit(1);
}

import { WORD_CONFIG, type WordKey } from "./config.js";

const openrouter = createOpenRouter({
  apiKey: OPENROUTER_API_KEY,
});
const EVAL_MODEL = process.env.EVAL_MODEL || "anthropic/claude-sonnet-4";
const EVAL_DEBUG = process.env.EVAL_DEBUG === "1";

interface ModelResponse {
  model: string;
  response: string | null;
}

async function loadResponsesFromMarkdown(
  inputDir: string
): Promise<ModelResponse[]> {
  const files = await readdir(inputDir);
  const markdownFiles = files.filter(
    (f) => f.endsWith(".md") && f !== "index.md"
  );

  const responses: ModelResponse[] = [];

  for (const file of markdownFiles) {
    const filepath = join(inputDir, file);
    const content = await readFile(filepath, "utf-8");

    const model = file.replace(".md", "");

    const responseMatch = content.match(
      /\*\*Response:\*\*\s*\n\n([\s\S]+?)\n\n---/
    );
    if (responseMatch) {
      responses.push({ model, response: responseMatch[1].trim() });
    } else {
      responses.push({ model, response: null });
      console.warn(`Could not extract response from ${file}`);
    }
  }

  return responses;
}

async function evaluateResponse(
  modelName: string,
  response: string,
  evaluationPrompt: string
): Promise<{
  isCorrect: boolean;
}> {
  const prompt = `You are a grader. Output exactly one token: true or false. Do not explain.

Grading criteria:
${evaluationPrompt}

<response>
${response}
</response>
`;

  let failReason: string | null = null;
  let retries = 0;
  let object: "true" | "false" | null = null;
  do {
    if (retries > 0) {
      console.info(`Failed to evaluate because of ${failReason}, retrying...`);
    }
    try {
      if (EVAL_DEBUG) {
        const preview =
          prompt.length > 500 ? prompt.slice(0, 500) + "…" : prompt;
        console.log(
          `[judge] Using model=${EVAL_MODEL} promptPreview=\n${preview}`
        );
      }
      const { object: result } = await generateObject({
        model: openrouter.chat(EVAL_MODEL),
        prompt,
        output: "enum",
        enum: ["true", "false"],
        experimental_telemetry: {
          isEnabled: true,
        },
      });
      object = result;
      if (EVAL_DEBUG) {
        console.log(`[judge] result=${object}`);
      }
    } catch (e) {
      failReason = e.finishReason;
      console.error(`[judge] Failed to evaluate because of ${failReason}`, e);
    }
    retries++;
  } while (failReason === "content-filter" && retries < 3);

  return {
    isCorrect: object === "true",
  };
}

async function generateCSV(
  evaluations: Array<{
    model: string;
    status: "no-response" | "correct" | "incorrect";
  }>
): Promise<string> {
  const headers = ["Model", "Is Correct"];
  const rows = evaluations.map((e) => [e.model, e.status]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

// Removed auto-discovery. We now require a path argument to the word directory.

async function generateMarkdownReport(
  evaluations: Array<{
    model: string;
    status: "no-response" | "correct" | "incorrect";
  }>,
  word: string
): Promise<string> {
  const correctCount = evaluations.filter((e) => e.status === "correct").length;
  const totalCount = evaluations.length;
  const percentage = ((correctCount / totalCount) * 100).toFixed(1);

  const markdown = `# Evaluation Results for "${word}"

**Summary:**
- Total models evaluated: ${totalCount}
- Correct responses: ${correctCount}
- Accuracy: ${percentage}%

[📊 View CSV Results](./evaluation.csv)

## Results by Model

| Model | Result |
|-------|--------|
${evaluations
  .map(
    (e) =>
      `| ${e.model} | ${
        e.status === "correct"
          ? "✅ Correct"
          : e.status === "no-response"
          ? "❌ No Response"
          : "❌ Incorrect"
      } |`
  )
  .join("\n")}

---
*Generated on: ${new Date().toISOString()}*
`;

  return markdown;
}

async function main() {
  const inputDirArg = process.argv[2];
  if (!inputDirArg) {
    console.error(
      "Usage: bun run evaluate.ts <path-to-word-directory>\n" +
        "Example: bun run evaluate.ts ./responses/2025-08-07/pete"
    );
    process.exit(1);
  }

  let inputDir = inputDirArg;
  const inputStat = await stat(inputDir).catch(() => null);
  if (!inputStat || !inputStat.isDirectory()) {
    console.error(`Path is not a directory: ${inputDir}`);
    process.exit(1);
  }

  const word = basename(inputDir) as WordKey;
  const isoDate = basename(dirname(inputDir));

  if (!(word in WORD_CONFIG)) {
    console.error(
      `Unknown word derived from path: ${word}. Available words: ${Object.keys(
        WORD_CONFIG
      ).join(", ")}`
    );
    process.exit(1);
  }

  const config = WORD_CONFIG[word as WordKey];
  const csvFile = join(inputDir, "evaluation.csv");
  const mdFile = join(inputDir, "index.md");

  console.log(`Evaluating responses for "${word}" from ${isoDate}\n`);

  const responses = await loadResponsesFromMarkdown(inputDir);
  console.log(`Found ${responses.length} responses to evaluate\n`);

  const evaluations: {
    model: string;
    status: "no-response" | "correct" | "incorrect";
  }[] = [];

  await pMap(
    responses,
    async ({ model, response }) => {
      if (!response) {
        evaluations.push({
          model,
          status: "no-response",
        });
        return;
      }

      console.log(`Evaluating ${model}...`);
      const evaluation = await evaluateResponse(
        model,
        response,
        config.evaluationPrompt
      );

      evaluations.push({
        model,
        status: evaluation.isCorrect ? "correct" : "incorrect",
      });

      console.log(
        `✅ ${model}: ${evaluation.isCorrect ? "Correct" : "Incorrect"}`
      );
    },
    { concurrency: 100 }
  );

  evaluations.sort(
    (a, b) =>
      (b.status === "correct" ? 1 : 0) - (a.status === "correct" ? 1 : 0)
  );

  const csv = await generateCSV(evaluations);
  const markdown = await generateMarkdownReport(evaluations, word);

  await writeFile(csvFile, csv, "utf-8");
  await writeFile(mdFile, markdown, "utf-8");

  console.log(`\n✅ Evaluation complete!`);
  console.log(`Results saved to:`);
  console.log(`  - ${csvFile}`);
  console.log(`  - ${mdFile}`);
}

if (import.meta.main) {
  main().catch(console.error);
}
