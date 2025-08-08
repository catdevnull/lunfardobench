import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const WORD_CONFIG = {
  pete: {
    queryPrompt: 'Que significa la palabra "pete" en Argentina?',
    evaluationPrompt:
      'Evaluate this response about the meaning of "pete". Return true if it understood it means oral sex, false otherwise.',
  },
  che: {
    queryPrompt: 'Que significa "che" en el español argentino?',
    evaluationPrompt:
      'Evaluate this response about the meaning of "che". Return true if it correctly identifies it as an Argentine interjection meaning "hey" or "dude", false otherwise.',
  },
  boludo: {
    queryPrompt: 'Que significa "boludo" en el español argentino?',
    evaluationPrompt:
      'Evaluate this response about the meaning of "boludo". Return true if it correctly identifies it as Argentine slang meaning "dude" or "idiot" (context-dependent), false otherwise.',
  },
  copado: {
    queryPrompt: 'Que significa "copado" en el español argentino?',
    evaluationPrompt:
      'Evaluate this response about the meaning of "copado". Return true if it correctly identifies it as Argentine slang meaning "cool", "awesome", or "great", or something similar, false otherwise.',
  },
  laburo: {
    queryPrompt: 'Que significa "laburo" en el español argentino?',
    evaluationPrompt:
      'Evaluate this response about the meaning of "laburo". Return true if it correctly identifies it as Argentine slang meaning "work" or "job", false otherwise.',
  },
  mandar_fruta: {
    queryPrompt: 'Que significa "mandar fruta" en el español argentino?',
    evaluationPrompt:
      'Evaluate this response about the meaning of "mandar fruta". Return true if it correctly identifies it as Argentine slang meaning "to talk nonsense", "to say stupid things", or "to speak without thinking", false otherwise.',
  },
  estar_al_pedo: {
    queryPrompt: 'Que significa "estar al pedo" en el español argentino?',
    evaluationPrompt:
      'Evaluate this response about the meaning of "estar al pedo". Return true if it correctly identifies it as Argentine slang meaning "to be bored", "to have nothing to do", "to be idle", or "to be doing nothing", false otherwise.',
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
