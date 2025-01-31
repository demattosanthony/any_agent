"use client";

import api from "@/lib/api";

// Types
import { MessageRole } from "@/types/chat";
import { Attachment } from "@ai-sdk/ui-utils";

// Atoms
import {
  initalInputAtom,
  instructionsAtom,
  messagesAtom,
  modelAtom,
  temperatureAtom,
  uploadsAtom,
} from "@/atoms/chat";

// Hooks
import { useQueryClient } from "@tanstack/react-query";
import { useChat } from "ai/react";
import { useAtom } from "jotai";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// Components
import ChatInputForm from "@/components/chat/ChatInputForm";
import ChatMessagesList from "@/components/chat/MessagesList";

type ExtendedAttachment = Attachment & {
  file_key: string;
};

export default function ThreadPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams<{ threadId: string }>();
  const { threadId } = params;
  const [initalMessages, setMessages] = useAtom(messagesAtom);
  const searchParams = useSearchParams();
  const isNew = searchParams.get("new") === "true";
  const [initalInput, setInitalInput] = useAtom(initalInputAtom);
  const [model] = useAtom(modelAtom);
  const [uploads, setUploads] = useAtom(uploadsAtom);
  const [temperature] = useAtom(temperatureAtom);
  const [instructions] = useAtom(instructionsAtom);

  const {
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    messages,
    isLoading,
    stop,
  } = useChat({
    api: `${process.env.NEXT_PUBLIC_API_URL}/threads/${threadId}/inference`,
    credentials: "include",
    initialInput: isNew ? initalInput : "",
    initialMessages:
      initalMessages?.map((message) => ({
        content: message.content?.text || "",
        role: message.role as "user" | "assistant",
        id: message.id,
        createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
        reasoning: message.reasoning,
        experimental_attachments:
          message.content?.type === "image" || message.content?.type === "file"
            ? [
                {
                  name: message.content.file_metadata?.filename,
                  url: message.content?.data || "",
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
        temperature: temperature,
        instructions,
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
        reasoning: message.reasoning,
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
      onSubmit({ preventDefault: () => {} } as React.FormEvent);
      router.replace(`/threads/${threadId}`);
      setInitalInput("");

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["threads"] }); // Needed so the app sidebar shows the new thread
      }, 1000);

      return;
    }

    loadThreadMessages();
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      setMessages([]);
      setInitalInput("");
    };
  }, [threadId, setMessages]);

  return (
    <>
      <ChatMessagesList messages={messages} isGenerating={isLoading} />

      <div className="w-full flex items-center justify-center mx-auto px-6 pb-8 md:pb-4 md:p-2">
        <ChatInputForm
          input={input}
          setInput={setInput}
          handleInputChange={handleInputChange}
          onSubmit={onSubmit}
          stop={stop}
          isGenerating={isLoading}
        />
      </div>
    </>
  );
}
