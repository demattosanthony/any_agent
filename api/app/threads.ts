import { threads, messages, ContentPart, FileContent } from "./config/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import db from "./config/db";
import s3 from "./config/s3";

const LIMIT = 10;

// Database Queries
async function getThread(threadId: string) {
  const thread = await db.query.threads.findFirst({
    where: eq(threads.id, threadId),
    with: {
      messages: {
        orderBy: messages.createdAt,
      },
    },
  });

  if (!thread) return null;

  // Process files in messages
  for (const message of thread.messages) {
    try {
      const content = message.content as { type: string };
      if (content.type === "file" || content.type === "image") {
        const fileContent = message.content as FileContent;
        if (!fileContent?.file_metadata?.file_key) continue;

        const metadata = s3.file(fileContent.file_metadata.file_key);
        const url = metadata.presign({
          acl: "public-read",
          expiresIn: 3600, // 1 hour
          method: "GET",
        });
        fileContent.data = url;
      }
    } catch (error) {
      console.error("Error processing message:", message.id, error);
      continue;
    }
  }

  return thread;
}

async function createThread(userId: string) {
  const threadId = crypto.randomUUID();
  const now = new Date();
  await db.insert(threads).values({
    id: threadId,
    userId,
    createdAt: now,
    updatedAt: now,
  });
  return { id: threadId };
}

async function createMessage(
  userId: string,
  threadId: string,
  role: string,
  content: ContentPart[]
) {
  for (const item of content) {
    const messageId = crypto.randomUUID();
    await db.insert(messages).values({
      userId,
      id: messageId,
      threadId: threadId,
      role: role as "system" | "user" | "assistant" | "tool", // Type assertion for role
      content: item,
      createdAt: new Date(),
    });
  }
  return { message: "Messages created successfully" };
}

async function getThreads(userId: string, page: number, search: string) {
  const offset = (page - 1) * LIMIT;

  try {
    let baseQuery = db
      .select({
        id: threads.id,
        created_at: threads.createdAt,
        updated_at: threads.updatedAt,
      })
      .from(threads)
      .leftJoin(messages, eq(threads.id, messages.threadId));

    const conditions = [eq(threads.userId, userId)];

    if (search && search.length > 0) {
      conditions.push(
        sql`CASE 
          WHEN jsonb_typeof(${messages.content}) = 'object' 
          THEN (${messages.content}->>'text')::text ILIKE ${"%" + search + "%"}
          WHEN jsonb_typeof(${messages.content}) = 'string' 
          THEN ${messages.content}::text ILIKE ${"%" + search + "%"}
          ELSE false 
        END`
      );
    }

    const matchingThreads = await baseQuery
      .where(and(...conditions))
      .groupBy(threads.id, threads.createdAt, threads.updatedAt)
      .orderBy(desc(threads.createdAt))
      .limit(LIMIT)
      .offset(offset);

    const threadIds = matchingThreads.map((t) => t.id);

    let completeThreads = await db.query.threads.findMany({
      where: (threads, { and, eq, inArray }) =>
        and(eq(threads.userId, userId), inArray(threads.id, threadIds)),
      orderBy: [desc(threads.createdAt)],
      with: {
        messages: {
          orderBy: messages.createdAt,
        },
      },
    });

    // Process files
    for (const thread of completeThreads) {
      for (const message of thread.messages) {
        try {
          const content = message.content as { type: string };
          if (content.type === "file" || content.type === "image") {
            const fileContent = message.content as FileContent;
            if (!fileContent?.file_metadata?.file_key) continue;

            const metadata = s3.file(fileContent.file_metadata.file_key);
            const url = metadata.presign({
              acl: "public-read",
              expiresIn: 3600, // 1 hour
              method: "GET",
            });
            fileContent.data = url;
          }
        } catch (error) {
          console.error("Error processing message:", message.id, error);
          continue;
        }
      }
    }

    return completeThreads;
  } catch (error) {
    console.error("Error processing threads:", error);
    return [];
  }
}

export { getThread, createThread, createMessage, getThreads };
