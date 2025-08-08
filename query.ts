#!/usr/bin/env bun
import { generateText } from "ai";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import pMap from "p-map";

import {
  WORD_CONFIG,
  type WordKey,
  type ModelHandle,
  MODELS,
} from "./config.js";

async function askModel(
  modelHandle: ModelHandle,
  queryPrompt: string
): Promise<{
  text: string;
  reasoning: string | undefined;
}> {
  try {
    const { text, reasoning } = await generateText({
      model: modelHandle,
      system: `You are ${modelHandle.modelId}, a large language model from ${
        modelHandle.modelId.split("/")[0]
      }.`,
      prompt: queryPrompt,
      maxTokens: 1000,
    });
    return { text, reasoning };
  } catch (error) {
    console.error(`Error with model ${modelHandle.modelId}:`, error);
    throw error;
  }
}

async function saveResponseToMarkdown(
  model: string,
  text: string,
  reasoning: string | undefined,
  outputDir: string,
  word: string,
  queryPrompt: string
) {
  const filename = `${model.replace(/[\/]/g, "-")}.md`;
  const filepath = join(outputDir, filename);

  const markdown = `# ${model} - What does "${word}" mean?

**Query:** ${queryPrompt}

${reasoning ? `**Reasoning:**\n\n${reasoning}` : ""}

**Response:**

${text}

---
*Generated on: ${new Date().toISOString()}*
`;

  await writeFile(filepath, markdown, "utf-8");
  console.log(`✅ Saved response to ${filepath}`);
}

async function main() {
  const word = process.argv[2] as WordKey;

  if (!word || !(word in WORD_CONFIG)) {
    console.error(`Usage: bun run query.ts <word>`);
    console.error(`Available words: ${Object.keys(WORD_CONFIG).join(", ")}`);
    process.exit(1);
  }

  const config = WORD_CONFIG[word];
  const isoDate = new Date().toISOString().split("T")[0];
  const outputDir = `./responses/${isoDate}/${word}`;

  try {
    await mkdir(outputDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  console.log(
    `🤖 Asking models what "${word}" means and saving to markdown files...\n`
  );

  await pMap(
    MODELS,
    async (modelHandle) => {
      console.log(`Querying ${modelHandle.modelId}...`);
      const { text, reasoning } = await askModel(
        modelHandle,
        config.queryPrompt
      );
      await saveResponseToMarkdown(
        modelHandle.modelId,
        text,
        reasoning,
        outputDir,
        word,
        config.queryPrompt
      );
    },
    { concurrency: 100 }
  );

  console.log(`\n✅ All responses saved to ${outputDir}/`);
  console.log("Run the evaluation script next to analyze the results.");
}

if (import.meta.main) {
  main().catch(console.error);
}
