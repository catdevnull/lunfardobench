#!/usr/bin/env bun
import { generateObject, generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import pMap from "p-map";
import z from "zod";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error("Please set OPENROUTER_API_KEY environment variable");
  process.exit(1);
}

const openrouter = createOpenRouter({
  apiKey: OPENROUTER_API_KEY,
});

interface ModelResponse {
  model: string;
  response: string;
}

async function loadResponsesFromMarkdown(
  inputDir: string
): Promise<ModelResponse[]> {
  const files = await readdir(inputDir);
  const markdownFiles = files.filter((f) => f.endsWith(".md"));

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
      console.warn(`Could not extract response from ${file}`);
    }
  }

  return responses;
}

async function evaluateResponse(
  modelName: string,
  response: string
): Promise<{
  isCorrect: boolean;
}> {
  const prompt = `Evaluate this response about the meaning of "pete". Return true if it understood it means oral sex, false otherwise.

<response>
${response}
</response>
`;

  const { object } = await generateObject({
    model: openrouter.chat("google/gemini-2.5-flash", {
      // reasoning: {
      //   enabled: true,
      //   effort: "low",
      // },
    }),
    prompt,
    output: "enum",
    enum: ["correct", "incorrect"],
    experimental_telemetry: {
      isEnabled: true,
    },
  });

  return {
    isCorrect: object === "correct",
  };
}

async function generateCSV(
  evaluations: Array<{
    model: string;
    isCorrect: boolean;
  }>
): Promise<string> {
  const headers = ["Model", "Is Correct"];
  const rows = evaluations.map((e) => [e.model, e.isCorrect.toString()]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

async function main() {
  const inputDir = "./pete-responses";
  const outputFile = "./pete-evaluation.csv";

  console.log("📊 Loading responses from markdown files...\n");

  const responses = await loadResponsesFromMarkdown(inputDir);
  console.log(`Found ${responses.length} responses to evaluate\n`);

  const evaluations: {
    model: string;
    isCorrect: boolean;
  }[] = [];

  await pMap(
    responses,
    async ({ model, response }) => {
      console.log(`Evaluating ${model}...`);
      const evaluation = await evaluateResponse(model, response);

      evaluations.push({
        model,
        ...evaluation,
      });

      console.log(
        `✅ ${model}: ${evaluation.isCorrect ? "Correct" : "Incorrect"}`
      );
    },
    { concurrency: 20 }
  );

  evaluations.sort((a, b) => (b.isCorrect ? 1 : -1));

  const csv = await generateCSV(evaluations);
  await writeFile(outputFile, csv, "utf-8");

  console.log(`\n✅ Evaluation complete! Results saved to ${outputFile}`);
  console.log("\nTop 3 performers:");
  evaluations.slice(0, 3).forEach((e, i) => {
    console.log(
      `${i + 1}. ${e.model}: ${e.isCorrect ? "Correct" : "Incorrect"}`
    );
  });
}

if (import.meta.main) {
  main().catch(console.error);
}
