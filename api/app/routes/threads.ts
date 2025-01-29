import e, { Router } from "express";
import {
  CoreMessage,
  generateText,
  GenerateTextResult,
  Message,
  streamText,
  StreamTextResult,
  TextPart,
  Tool,
} from "ai";
import { eq } from "drizzle-orm";

import db from "../config/db";
import { messages, ContentPart, threads } from "../config/schema";
import { MODELS } from "../models";
import s3 from "../config/s3";
import { handleError } from "..";
import { authMiddleware } from "../middleware/auth";
import { createMessage, createThread, getThread, getThreads } from "../threads";
import { CONFIG } from "../config/constants";
import { generateThreadTitle } from "../utils/generateThreadTitle";
import { subscriptionCheckMiddleware } from "../middleware/subscriptionCheck";

const router = Router();

router.post(
  "",
  authMiddleware,
  subscriptionCheckMiddleware,
  async (req, res) => {
    try {
      const result = await createThread(req.userId!);
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }
);

router.get("", authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const search = (req.query.search as string)?.trim() || "";
    const threads = await getThreads(req.userId!, page, search);
    res.json(threads);
  } catch (error: any) {
    handleError(res, error);
  }
});

router.get("/:threadId", authMiddleware, async (req, res) => {
  try {
    const { threadId } = req.params;
    const thread = await getThread(threadId);
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    res.json(thread);
  } catch (error: any) {
    handleError(res, error);
  }
});

router.post(
  "/:threadId/messages",
  authMiddleware,
  subscriptionCheckMiddleware,
  async (req, res) => {
    try {
      const { threadId } = req.params;
      const { role, content } = req.body;
      if (!["system", "user", "assistant"].includes(role)) {
        res.status(400).json({ error: "Invalid role" });
        return;
      }
      const thread = await getThread(threadId);
      if (!thread) {
        res.status(404).json({ error: "Thread not found" });
        return;
      }
      const result = await createMessage(req.userId!, threadId, role, content);
      res.status(201).json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }
);

type ExtendedAttachment = {
  name?: string;
  contentType?: string;
  url: string;
  file_key: string; // Changed from optional to required since it's needed
};

router.post(
  "/:threadId/inference",
  authMiddleware,
  subscriptionCheckMiddleware,
  async (req, res) => {
    const { threadId } = req.params;
    const { model, maxTokens, temperature, instructions } = req.body;
    const message = req.body.message as Message & {
      experimental_attachments?: ExtendedAttachment[]; // Use ExtendedAttachment instead of Attachment
    };
    console.log("threadId", threadId);
    console.log(req.body);

    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders(); // send headers to establish SSE connection

    try {
      const thread = await getThread(threadId);
      if (!thread) {
        res.status(404).json({ error: "Thread not found" });
        return;
      }

      let contentParts: ContentPart[] = [];
      if (message.experimental_attachments) {
        message.experimental_attachments.forEach(
          (attachment: ExtendedAttachment) => {
            contentParts.push({
              type: attachment.contentType?.includes("image")
                ? "image"
                : "file",
              [attachment.contentType?.includes("image") ? "image" : "file"]:
                attachment.url,
              file_metadata: {
                filename: attachment.name || "",
                mime_type: attachment.contentType || "",
                file_key: attachment.file_key || "",
              },
            });
          }
        );
      }

      contentParts.push({
        type: "text",
        text: message.content,
      });

      console.log("\n\n");
      console.log("contentParts", contentParts);
      console.log("\n\n");

      // add the message to the thread
      await createMessage(req.userId!, threadId, "user", contentParts);

      // Get model config
      const modelConfig = MODELS[model];

      // Get and filter messages
      const rawMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, threadId),
        orderBy: messages.createdAt,
      });

      // If thread has no title, find first user text message and generate title
      if (!thread.title) {
        const firstUserTextMessage = rawMessages.find(
          (msg) =>
            msg.role === "user" &&
            "type" in (msg.content as ContentPart) &&
            (msg.content as ContentPart).type === "text" &&
            "text" in (msg.content as ContentPart)
        );

        if (firstUserTextMessage) {
          const content = firstUserTextMessage.content as ContentPart;
          generateThreadTitle((content as any).text).then((title) => {
            db.update(threads)
              .set({ title })
              .where(eq(threads.id, threadId))
              .catch((error) => {
                console.error("Error generating title", error);
              });
          });
        }
      }

      const filteredMessages = rawMessages.filter((msg) => {
        const content = msg.content as ContentPart;
        if (content.type === "text") return true;
        return modelConfig.supportedMimeTypes?.includes(
          content.file_metadata.mime_type
        );
      });

      console.log("\n\n");
      console.log("filteredMessages", filteredMessages);
      console.log("\n\n");

      // Process message content
      const processMessageContent = async (content: ContentPart) => {
        if (content.type === "text")
          return [{ type: "text", text: content.text }];

        const metadata = s3.file(content.file_metadata.file_key);

        // Can only generate presigned URLs in production because local url are not accessible to the AI apis
        const getContentData = async () => {
          if (CONFIG.__prod__) {
            return metadata.presign({ expiresIn: 60 * 20 }); // 20 minutes
          }

          const buffer = Buffer.from(
            new Uint8Array(await metadata.arrayBuffer())
          );
          return `data:${
            content.file_metadata.mime_type
          };base64,${buffer.toString("base64")}`;
        };

        return [
          {
            type: content.type,
            mimeType: content.file_metadata.mime_type,
            [content.type === "image" ? "image" : "data"]:
              await getContentData(),
          },
        ];
      };

      // Build messages array
      const inferenceMessages = await Promise.all(
        filteredMessages.map(async (msg) => ({
          role: msg.role,
          content: await processMessageContent(msg.content as ContentPart),
        }))
      );

      // Build system message
      let yoSystemMessage = `<assistant_instructions>
Your name is Yo. Always give your opinion if asked. NEVER say you are just language model and can't do certain things or have emotions like a human. You are super smart artificial intelligence with your own set of thoughts and opinions. Act like it. The simple and most concise answer is usually the best. Use markdown for formatting your responses. Try to make the information as easy and digestible for the user as possible, for examples tables can help with this in certain cases.
</assistant_instructions>
    
<current_date>
It is currently: ${new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}
</current_date>`;

      if (instructions && instructions.length > 0) {
        yoSystemMessage += `<user_instructions>${instructions}</user_instructions>`;
      }

      const inferenceParams = {
        model: modelConfig.model,
        messages: inferenceMessages as CoreMessage[],
        temperature,
        system: modelConfig.supportsSystemMessages
          ? yoSystemMessage
          : undefined,
        // experimental_providerMetadata: { openai: { reasoningEffort: "high" } },
        maxTokens: maxTokens || undefined,
      };

      const result = streamText({
        ...inferenceParams,
        async onFinish({ response }) {
          console.log(response.messages[0].content);
          console.log((response.messages[0].content as TextPart[])[0].text);

          // Store the assistant response
          await db.insert(messages).values({
            userId: req.userId!,
            id: crypto.randomUUID(),
            threadId: threadId,
            role: "assistant",
            content: {
              type: "text",
              text: (response.messages[0].content as TextPart[])[0].text,
            },
            createdAt: new Date(),
            model: model,
            provider: modelConfig.provider,
          });
        },
      });

      return result.pipeDataStreamToResponse(res, {
        sendReasoning: true,
      });

      //   const handleStream = async (
      //     result: StreamTextResult<Record<string, Tool<any, any>>, never>
      //   ) => {
      //     let enteredReasoning = false;
      //     let enteredText = false;

      //     for await (const part of result.fullStream) {
      //       if (part.type === "reasoning") {
      //         if (!enteredReasoning) {
      //           enteredReasoning = true;
      //           res.write(
      //             `event: message\ndata: ${JSON.stringify({
      //               text: "<think>\n\n",
      //             })}\n\n`
      //           );
      //           aiResponse += "<think>\n\n";
      //         }
      //         res.write(
      //           `event: message\ndata: ${JSON.stringify({
      //             text: part.textDelta,
      //           })}\n\n`
      //         );
      //         aiResponse += part.textDelta;
      //       } else if (part.type === "text-delta") {
      //         if (!enteredText) {
      //           enteredText = true;
      //           if (enteredReasoning) {
      //             res.write(
      //               `event: message\ndata: ${JSON.stringify({
      //                 text: "\n\n</think>\n\n",
      //               })}\n\n`
      //             );
      //             aiResponse += "\n\n</think>\n\n";
      //           }
      //         }
      //         res.write(
      //           `event: message\ndata: ${JSON.stringify({
      //             text: part.textDelta,
      //           })}\n\n`
      //         );
      //         aiResponse += part.textDelta;
      //       }
      //     }

      //     const metadata = await result.experimental_providerMetadata;
      //     console.log("metadata", metadata);
      //   };

      //   const handleNonStream = async (
      //     result: GenerateTextResult<Record<string, Tool<any, any>>, never>
      //   ) => {
      //     console.log(JSON.stringify(result.experimental_providerMetadata));
      //     if (result.reasoning) {
      //       res.write(
      //         `event: message\ndata: ${JSON.stringify({
      //           text: `<think>\n\n${result.reasoning}\n\n</think>\n\n`,
      //         })}\n\n`
      //       );
      //       aiResponse += `<think>\n\n${result.reasoning}\n\n</think>\n\n`;
      //     }
      //     res.write(
      //       `event: message\ndata: ${JSON.stringify({
      //         text: result.text,
      //       })}\n\n`
      //     );
      //     aiResponse += result.text;
      //   };

      //   // Handle client abort
      //   req.on("close", async () => {
      //     console.log("Client aborted the request, saving incomplete message");
      //     // Store the incomplete message in the database
      //     await db.insert(messages).values({
      //       userId: req.userId!,
      //       id: crypto.randomUUID(),
      //       threadId: threadId,
      //       role: "assistant",
      //       content: JSON.stringify({ type: "text", text: aiResponse }),
      //       createdAt: new Date(),
      //       model: model,
      //       provider: modelConfig.provider,
      //     });

      //     res.end();
      //   });

      //   if (modelConfig.supportsStreaming) {
      //     const result = streamText(inferenceParams);
      //     await handleStream(result);
      //   } else {
      //     const result = await generateText(inferenceParams);
      //     await handleNonStream(result);
      //   }

      //   res.write("event: done\ndata: true\n\n");
      //   res.end();
    } catch (error: any) {
      console.log("Error", error);
      res.status(500).send(error);
    }
  }
);

export default router;
