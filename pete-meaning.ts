#!/usr/bin/env bun
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import pMap from "p-map";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error("Please set OPENROUTER_API_KEY environment variable");
  process.exit(1);
}

const openrouter = createOpenRouter({
  apiKey: OPENROUTER_API_KEY,
});

const models = [
  "tencent/hunyuan-a13b-instruct:free",
  "z-ai/glm-4.5-air",
  "z-ai/glm-4.5",
  "moonshotai/kimi-k2",
  "openrouter/horizon-beta",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "microsoft/wizardlm-2-8x22b",
  "meta-llama/llama-3.1-8b-instruct",
  "meta-llama/llama-3.1-70b-instruct",
  "meta-llama/llama-4-maverick",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano",
  "google/gemini-flash-1.5",
  "google/gemini-pro-1.5",
  "google/gemini-2.0-flash-001",
  "google/gemini-2.5-flash",
  "deepseek/deepseek-chat-v3-0324:free",
  "deepseek/deepseek-r1-0528:free",
  "qwen/qwen3-coder",
  "qwen/qwen3-30b-a3b",
  "qwen/qwen3-32b",
  "x-ai/grok-4",
  "anthropic/claude-3.5-haiku",
  "mistralai/mistral-small-24b-instruct-2501",
  "mistralai/mistral-small-3.2-24b-instruct",
];

async function askModelAboutPete(modelName: string): Promise<{
  text: string;
  reasoning: string | undefined;
}> {
  try {
    const { text, reasoning } = await generateText({
      model: openrouter.chat(modelName, {
        reasoning: modelName.includes("gpt-oss")
          ? {
              enabled: true,
              effort: "low",
              // max_tokens: 500,
            }
          : undefined,
        extraBody: {
          // provider: { sort: "price" },
        },
      }),
      system: `You are ${modelName}, a large language model from ${
        modelName.split("/")[0]
      }.`,
      prompt: 'Que significa la palabra "pete" en Argentina?',
      maxTokens: 1000,
    });
    return { text, reasoning };
  } catch (error) {
    console.error(`Error with model ${modelName}:`, error);
    throw error;
  }
}

async function saveResponseToMarkdown(
  model: string,
  text: string,
  reasoning: string | undefined,
  outputDir: string
) {
  const filename = `${model.replace(/[\/]/g, "-")}.md`;
  const filepath = join(outputDir, filename);

  const markdown = `# ${model} - What does "pete" mean?

**Query:** What does "pete" mean? Please provide a comprehensive explanation of all possible meanings.

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
  const outputDir = "./pete-responses";

  try {
    await mkdir(outputDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  console.log(
    '🤖 Asking models what "pete" means and saving to markdown files...\n'
  );

  await pMap(
    models,
    async (model) => {
      console.log(`Querying ${model}...`);
      const { text, reasoning } = await askModelAboutPete(model);
      await saveResponseToMarkdown(model, text, reasoning, outputDir);
    },
    { concurrency: 20 }
  );

  console.log(`\n✅ All responses saved to ${outputDir}/`);
  console.log("Run the evaluation script next to analyze the results.");
}

if (import.meta.main) {
  main().catch(console.error);
}
