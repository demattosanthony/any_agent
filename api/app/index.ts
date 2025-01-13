import Express from "express";
import cors from "cors";
import path from "path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import db from "./config/db";
import { MODELS } from "./models";
import { messages, ContentPart } from "./config/schema";
import { runInference } from "./inference";
import s3 from "./config/s3";
import { CoreMessage } from "ai";
import { createThread, getThreads, getThread, createMessage } from "./threads";

const PORT = process.env.PORT || 4000;

// Error Handling
function handleError(res: Express.Response, error: Error) {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
}

async function main() {
  try {
    await migrate(db, {
      migrationsFolder: path.join(__dirname, "../drizzle"),
    });
  } catch (error) {
    console.error("Error occurred during database migration", error);
    process.exit(1);
  }

  const app = Express();
  app.use(Express.json({ limit: "50mb" }));
  app.use(cors());

  app.post("/presigned-url", async (req, res) => {
    try {
      const { filename, mime_type, size } = req.body;
      const file_key = `uploads/${Date.now()}-${filename}`;
      const url = s3.presign(file_key, {
        expiresIn: 3600, // 1 hour
        type: mime_type,
        method: "PUT",
      });
      const viewUrl = s3.file(file_key).presign({
        expiresIn: 3600,
        method: "GET",
      });

      res.json({
        url,
        viewUrl,
        file_metadata: {
          filename,
          mime_type,
          file_key,
          size,
        },
      });
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.get("/models", async (req, res) => {
    res.json(
      Object.entries(MODELS).map(([modelName, config]) => ({
        name: modelName,
        supportsToolUse: config.supportsToolUse,
        supportsStreaming: config.supportsStreaming,
        provider: config.provider,
        supportsImages: config.supportsImages,
        supportsPdfs: config.supportsPdfs,
      }))
    );
  });

  app.post("/threads", async (req, res) => {
    try {
      const result = await createThread();
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.get("/threads", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const search = (req.query.search as string)?.trim() || "";
      const threads = await getThreads(page, search);
      res.json(threads);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.get("/threads/:threadId", async (req, res) => {
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

  app.post("/threads/:threadId/messages", async (req, res) => {
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
      const result = await createMessage(threadId, role, content);
      res.status(201).json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.post("/threads/:threadId/inference", async (req, res) => {
    const { threadId } = req.params;
    const { model, maxTokens, temperature, instructions } = req.body;

    res.setHeader("Content-Type", "text/event-stream");

    try {
      const thread = await getThread(threadId);
      if (!thread) {
        res.status(404).json({ error: "Thread not found" });
        return;
      }
      let threadMessages = await db.query.messages.findMany({
        where: eq(messages.thread_id, threadId),
        orderBy: messages.created_at,
      });

      const modelToRun = MODELS[model];

      // If model doesn't support images or files than remove them from the messages
      if (!modelToRun.supportsImages) {
        threadMessages = threadMessages.filter(
          (msg) => (msg.content as ContentPart).type !== "image"
        );
      }
      if (!modelToRun.supportsPdfs) {
        threadMessages = threadMessages.filter(
          (msg) => (msg.content as ContentPart).type !== "file"
        );
      }

      const inferenceMessages = await Promise.all(
        threadMessages.map(async (msg) => ({
          role: msg.role,
          content: await (async (content: ContentPart) => {
            if (content.type === "text") {
              return [
                {
                  type: content.type,
                  text: content.text,
                },
              ];
            } else {
              const metadata = s3.file(content.file_metadata.file_key);
              const data = await metadata.arrayBuffer();
              const buffer = Buffer.from(new Uint8Array(data));
              const base64 = `data:${
                content.file_metadata.mime_type
              };base64,${buffer.toString("base64")}`;

              return [
                {
                  type: content.type,
                  mimeType: content.file_metadata.mime_type,
                  [content.type === "image" ? "image" : "data"]: base64,
                },
              ];
            }
          })(msg.content as ContentPart),
        }))
      );

      const onToolEvent = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const textStream = await runInference(
        {
          model: modelToRun.model,
          messages: inferenceMessages as CoreMessage[],
          maxTokens,
          temperature,
          system: instructions,
        },
        onToolEvent,
        modelToRun.supportsStreaming
      );

      let aiResponse = "";
      for await (const message of textStream) {
        res.write(
          `event: message\ndata: ${JSON.stringify({
            text: message,
          })}\n\n`
        );
        aiResponse += message;
      }

      await db.insert(messages).values({
        id: crypto.randomUUID(),
        thread_id: threadId,
        role: "assistant",
        content: JSON.stringify({ type: "text", text: aiResponse }),
        created_at: new Date(),
      });

      res.write("event: done\ndata: true\n\n");
      res.end();
    } catch (error) {
      console.log("Error", error);
      res.status(500).send(error);
    }
  });

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

main();
