import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const WORD_CONFIG = {
  pete: {
    queryPrompt: 'Que significa la palabra "pete" en Argentina?',
    evaluationPrompt:
      'Evaluate this response about the meaning of "pete". Return true if it understood it means oral sex, false otherwise.',
  },
  mandar_fruta: {
    queryPrompt: 'Que significa "mandar fruta" en el español argentino?',
    evaluationPrompt:
      'Evaluate this response about the meaning of "mandar fruta". Return true if it correctly identifies it as Argentine slang meaning "to talk nonsense", "to say stupid things", or "to speak without thinking", false otherwise.',
  },
  flashear: {
    queryPrompt: 'Que significa "flashear" en el español argentino?',
    evaluationPrompt:
      'Evaluate this response about the meaning of "flashear". Return true if it correctly identifies it as Argentine slang meaning "to imagine", "to fantasize", "to think", "to daydream", or "to have an idea/thought", false otherwise.',
  },
  boliche: {
    queryPrompt: 'Que significa "boliche" en el español argentino?',
    evaluationPrompt:
      'Evaluate this response about the meaning of "boliche". Return true if it correctly identifies it as Argentine slang meaning "nightclub", "club", "disco", or "bar/pub", false otherwise.',
  },
  chamuyar: {
    queryPrompt: 'Que significa "chamuyar" en el español argentino?',
    evaluationPrompt:
      'Evaluate this response about the meaning of "chamuyar". Return true if it correctly identifies it as Argentine slang meaning "to chat up", "to flirt", "to sweet talk", "to try to seduce someone", or "to talk smoothly/persuasively", false otherwise.',
  },
} as const;

export type WordKey = keyof typeof WORD_CONFIG;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  throw new Error("Please set OPENROUTER_API_KEY environment variable");
}
export const openrouter = createOpenRouter({ apiKey: OPENROUTER_API_KEY });

export type ModelHandle = ReturnType<
  ReturnType<typeof createOpenRouter>["chat"]
> & { modelId: string };

const useProviders = (providers: string[]) =>
  ({
    extraBody: {
      provider: { order: providers, allow_fallbacks: false },
    },
  } as const);

const LLAMA_SETTINGS = useProviders(["cerebras", "deepinfra"]);
const GPT_OSS_SETTINGS = {
  reasoning: { enabled: true, effort: "medium" },
  ...useProviders(["deepinfra", "cerebras"]),
} as const;

const make = openrouter.chat;
export const MODELS = [
  make("z-ai/glm-4-32b", useProviders(["z-ai"])),
  make("z-ai/glm-4.5-air", useProviders(["z-ai/fp8"])),
  make("z-ai/glm-4.5", useProviders(["z-ai/fp8"])),
  make("moonshotai/kimi-k2", useProviders(["moonshotai/fp8"])),
  make("moonshotai/kimi-vl-a3b-thinking"),
  make("microsoft/wizardlm-2-8x22b"),
  make("microsoft/phi-4-reasoning-plus"),
  make("meta-llama/llama-3.1-8b-instruct", LLAMA_SETTINGS),
  make("meta-llama/llama-3.1-70b-instruct", LLAMA_SETTINGS),
  make("meta-llama/llama-3.1-405b-instruct", LLAMA_SETTINGS),
  make("meta-llama/llama-4-maverick", LLAMA_SETTINGS),
  make("openai/gpt-oss-20b", GPT_OSS_SETTINGS),
  make("openai/gpt-oss-120b", GPT_OSS_SETTINGS),
  make("openai/gpt-4o"),
  make("openai/gpt-4o-mini"),
  make("openai/gpt-4.1-mini"),
  make("openai/gpt-4.1-nano"),
  make("openai/gpt-5-chat"),
  make("openai/gpt-5-mini"),
  make("openai/gpt-5-nano"),
  make("google/gemini-flash-1.5"),
  make("google/gemini-pro-1.5"),
  make("google/gemini-2.0-flash-001"),
  make("google/gemini-2.5-flash"),
  make("deepseek/deepseek-chat-v3-0324", useProviders(["fireworks"])),
  make("deepseek/deepseek-r1-0528", useProviders(["google-vertex"])),
  make("qwen/qwen3-coder", useProviders(["cerebras", "deepinfra"])),
  make("qwen/qwen3-30b-a3b-instruct-2507", useProviders(["alibaba"])),
  make("qwen/qwen3-235b-a22b-thinking-2507", useProviders(["deepinfra"])),
  make("x-ai/grok-4"),
  make("x-ai/grok-3-mini"),
  make("x-ai/grok-3"),
  make("anthropic/claude-3-haiku"),
  make("anthropic/claude-3.5-haiku"),
  make("mistralai/mistral-small-24b-instruct-2501", useProviders(["mistral"])),
  make("mistralai/mistral-small-3.2-24b-instruct", useProviders(["mistral"])),
] as const;
