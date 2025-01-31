"use client";

import MarkdownViewer from "../MarkdownViewer";
import { useEffect, useMemo } from "react";
import { Check, Copy } from "lucide-react";
import { Message } from "ai/react";
import React from "react";
import { MessageRole } from "@/types/chat";
import { ThinkingDropdown } from "./ThinkingDropdown";
import ChatAttachment from "./ChatAttachment";

const MessageItem = React.memo(function MessageItem({
  message,
  index,
}: {
  message: Message;
  index: number;
}) {
  const text = message?.content;
  //   const data = message?.data;
  const attachments = message?.experimental_attachments;

  const [copied, setCopied] = React.useState(false);

  const handleCopyToClipboard = () => {
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      });
    }
  };

  return (
    <div
      key={index}
      className={`flex flex-col ${
        message.role === MessageRole.user ? "justify-end" : "justify-start"
      } mb-4`}
    >
      {/** Attachments */}
      {message.role === MessageRole.user &&
        attachments &&
        attachments?.map((attachment, index) => (
          <ChatAttachment attachment={attachment} key={index} />
        ))}

      <div
        className={`md:max-w-full rounded-lg group relative flex flex-col ${
          message.role === MessageRole.user
            ? "bg-primary text-white self-end dark:text-black max-w-[85%]"
            : "self-start max-w-full"
        } ${text && text.length > 0 && "p-2"}`}
        style={{
          whiteSpace: message.role === MessageRole.user ? "pre-wrap" : "normal",
        }}
      >
        {/** Icon for AI Message */}
        <div className="flex gap-2">
          {message.role === MessageRole.assistant && (
            <>
              <img
                src={"/yo-blob.png"}
                className="w-6 h-6 rounded mt-1 mr-1"
                alt="modelIcon"
              />
            </>
          )}

          {message.role === MessageRole.assistant && (
            <div className="max-w-[750px] overflow-hidden">
              {message.reasoning && (
                <ThinkingDropdown>
                  <MarkdownViewer content={message.reasoning ?? ""} />
                </ThinkingDropdown>
              )}

              <MarkdownViewer content={message.content ?? ""} />
            </div>
          )}

          {/** User message */}
          {message.role === MessageRole.user && (
            <div className="break-words whitespace-pre-wrap max-w-[750px] overflow-hidden">
              {text}
            </div>
          )}
        </div>

        {/* Copy to clipboard icon for user text messages */}
        {message.role === MessageRole.user && message.content && (
          <div className="absolute -bottom-6 right-0 group-hover:opacity-100 opacity-0 transition-all duration-200">
            {!copied && (
              <Copy
                className="w-4 h-4 cursor-pointer text-primary"
                onClick={handleCopyToClipboard}
              />
            )}

            {copied && <Check className="w-4 h-4 text-green-500" />}
          </div>
        )}
      </div>
    </div>
  );
});

const ChatMessagesList = React.memo(function ChatMessagesList({
  messages,
  isGenerating,
}: {
  messages: Message[];
  isGenerating: boolean;
}) {
  useEffect(() => {
    const messageContainer = document.querySelector(".overflow-y-auto");
    if (messageContainer) {
      messageContainer.scrollTop = messageContainer.scrollHeight;
    }
  }, [messages.length]);

  // If last message is from user and isGenerating is true, show "Thinking..." message
  const firstTokenNotGeneratedYet = useMemo(() => {
    return (
      messages.length > 0 &&
      isGenerating &&
      messages[messages.length - 1].role === MessageRole.user
    );
  }, [messages, isGenerating]);

  return (
    <div className="flex-1 w-full h-full relative">
      <div className="absolute inset-0 overflow-y-auto">
        <div className={`max-w-[840px] mx-auto pt-20 p-4 w-full`}>
          {messages.length > 0 && (
            <>
              {messages.map((message, index) => (
                <MessageItem key={index} message={message} index={index} />
              ))}
            </>
          )}

          {firstTokenNotGeneratedYet && (
            <MessageItem
              message={{
                role: MessageRole.assistant,
                content: "",
                id: "",
              }}
              index={messages.length}
            />
          )}
        </div>
      </div>
    </div>
  );
});

export default ChatMessagesList;
