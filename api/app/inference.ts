import { generateText, LanguageModel, streamText, type CoreMessage } from "ai";

interface inferenceParams {
  model: LanguageModel;
  messages: CoreMessage[];
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

export async function runInference(
  params: inferenceParams,
  onToolEvent: (event: string, data: any) => void,
  stream?: boolean
) {
  //   if (modelToRun.supportsToolUse) {
  //     generationParams = {
  //       ...generationParams,
  //       //   tools: {
  //       //     webSearch: webSearchTool,
  //       //     getWebPageContents: getWebPageContentsTool,
  //       //   },
  //       //   toolChoice: "auto",
  //       //   maxSteps: 5,
  //       onChunk({
  //         chunk,
  //       }: {
  //         chunk: { type: string; toolName: string; args: any };
  //       }) {
  //         if (chunk.type === "tool-call") {
  //           const { toolName, args } = chunk;
  //           onToolEvent("tool-call-start", { toolName, args });
  //         }

  //         if (chunk.type === "tool-result") {
  //           onToolEvent("tool-call-end", { toolName: chunk.toolName });
  //         }
  //       },
  //     };
  //   }

  const fn = stream ? streamText : generateText;
  return fn({
    ...params,
    experimental_providerMetadata: {
      openai: {
        reasoningEffort: "high",
      },
    },
  });
}
