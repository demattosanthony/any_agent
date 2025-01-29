"use client";

import { messagesAtom, modelAtom, uploadsAtom } from "@/atoms/chat";
import ChatInputForm from "@/components/chat/ChatInputForm";
import ChatMessagesList from "@/components/chat/MessagesList";
import api from "@/lib/api";
import { MessageRole } from "@/types/chat";
import { useAtom } from "jotai";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { useChat } from "ai/react";
import { Attachment } from "@ai-sdk/ui-utils";

type ExtendedAttachment = Attachment & {
  file_key: string;
};

export default function ThreadPage() {
  const router = useRouter();
  const params = useParams<{ threadId: string }>();
  const { threadId } = params;
  const [initalMessages, setMessages] = useAtom(messagesAtom);
  const searchParams = useSearchParams();
  const isNew = searchParams.get("new") === "true";
  const [model] = useAtom(modelAtom);
  const [uploads, setUploads] = useAtom(uploadsAtom);

  const { input, handleInputChange, handleSubmit, messages } = useChat({
    api: `${process.env.NEXT_PUBLIC_API_URL}/threads/${threadId}/inference`,
    credentials: "include",
    initialMessages:
      initalMessages?.map((message) => ({
        content: message.content?.text || "",
        role: message.role as "user" | "assistant",
        id: message.id,
        createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
        experimental_attachments:
          message.content?.type === "image"
            ? [
                {
                  name: message.content.file_metadata?.filename,
                  url: message.content?.image || "", // Ensure url is always a string
                  file_key: message.content.file_metadata?.file_key,
                  contentType: message.content.file_metadata?.mime_type,
                },
              ]
            : [],
      })) ?? [],
    experimental_prepareRequestBody({ messages, id }) {
      return {
        message: messages[messages.length - 1],
        id,
        model: model.name,
        temperature: 0.4,
        maxTokens: 1000,
      };
    },
  });

  async function processAttachments() {
    // Process uploads
    if (uploads.length > 0) {
      const attachments: ExtendedAttachment[] = await Promise.all(
        uploads.map(async (upload) => {
          const { url, file_metadata, viewUrl } = await api.getPresignedUrl(
            upload.file.name,
            upload.file.type,
            upload.file.size
          );

          // upload directly to storage
          await fetch(url, {
            method: "PUT",
            body: upload.file,
            headers: {
              "Content-Type": upload.file.type,
            },
          });

          const attachment: ExtendedAttachment = {
            name: upload.file.name,
            contentType: upload.file.type,
            url: viewUrl,
            file_key: file_metadata.file_key,
          };

          return attachment;
        })
      );

      return attachments;
    }
    return [];
  }

  // Load and format thread messages
  async function loadThreadMessages() {
    try {
      const thread = await api.getThread(threadId);
      const formattedMessages = thread.messages.map((message) => ({
        role: message.role as MessageRole,
        content: message.content,
        createdAt: message.createdAt,
        provider: message.provider,
        model: message.model,
        id: message.id,
      }));
      setMessages(formattedMessages);
    } catch (error) {
      console.error("Failed to load thread messages:", error);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const attachments = await processAttachments();

    handleSubmit(e, {
      experimental_attachments: attachments,
    });

    // Reset attachments after submit
    setUploads([]);
  }

  useEffect(() => {
    if (isNew) {
      // Don't update messages if this is a new thread
      router.replace(`/threads/${threadId}`);
      return;
    }

    loadThreadMessages();
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      setMessages([]);
    };
  }, [threadId, setMessages]);

  return (
    <>
      <ChatMessagesList messages={messages} />

      <div className="w-full flex items-center justify-center mx-auto px-6 pb-8 md:pb-4 md:p-2">
        <ChatInputForm
          input={input}
          handleInputChange={handleInputChange}
          onSubmit={onSubmit}
        />
      </div>
    </>
  );
}
