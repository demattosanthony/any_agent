import MarkdownViewer from "../MarkdownViewer";
import { useEffect } from "react";
import { Check, Copy, File, Maximize2 } from "lucide-react";
import { useAtom } from "jotai";
import { ChatMessage, MessageRole } from "@/types/chat";
import { messagesAtom } from "@/atoms/chat";
import React from "react";
import { getModelIconPath } from "../ModelSelector";
import Link from "next/link";
import { Button } from "../ui/button";

const MessageItem = React.memo(function MessageItem({
  message,
  index,
}: {
  message: ChatMessage;
  index: number;
}) {
  const messageType = message.content?.type;
  const text = message.content?.text;
  const data = message.content?.data;
  const file_metadata = message.content?.file_metadata;
  const provider = message.provider;

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
      } mb-4 `}
    >
      {/* <>
            {message.tool_calls?.map((toolCall, id) => (
            <ToolCallResultComponent toolCall={toolCall} key={id} />
            ))}
        </> */}
      <div
        className={`md:max-w-full rounded-lg p-2 group relative ${
          message.role === MessageRole.user
            ? "bg-primary text-white self-end dark:text-black max-w-[85%]"
            : "self-start max-w-full"
        }`}
        style={{
          whiteSpace: message.role === MessageRole.user ? "pre-wrap" : "normal",
        }}
      >
        {/** Icon for AI Message */}
        <div className="flex gap-2">
          {message.role === MessageRole.assistant && (
            <>
              {provider && (
                <img
                  src={getModelIconPath(provider) || ""}
                  className="w-6 h-6 rounded mt-1 mr-1"
                  alt="modelIcon"
                />
              )}

              {!provider && (
                <div className="bg-primary h-6 w-6 rounded-full min-h-6 min-w-6 mt-1" />
              )}
            </>
          )}

          {/** AI Plain text response */}
          {message.role === MessageRole.assistant && (
            <div className="max-w-[750px] overflow-hidden">
              <MarkdownViewer content={message.content?.text || ""} />
            </div>
          )}

          {/** User message */}
          {message.role === MessageRole.user && messageType === "text" && (
            <div className="break-words whitespace-pre-wrap max-w-[750px] overflow-hidden">
              {text}
            </div>
          )}

          {/** User images */}
          {message.role === MessageRole.user && messageType === "image" && (
            <img
              src={data}
              alt="User uploaded image"
              className="h-52 object-cover rounded-lg cursor-pointer hover:opacity-90 max-w-[750px]"
              onClick={() => {
                if (typeof window === "undefined") return;
                window.open(data, "_blank");
              }}
            />
          )}

          {/** User Files */}
          {message.role === MessageRole.user && messageType === "file" && (
            <>
              {file_metadata?.mime_type === "application/pdf" ? (
                <div className="relative w-full h-[400px]">
                  <iframe
                    src={`${data}#toolbar=0&navpanes=0&scrollbar=0&page=1&view=Fit`}
                    className="w-full h-full"
                    title={file_metadata.filename}
                  />
                  <Link
                    href={data || ""}
                    target="_blank"
                    className="absolute bottom-2 right-2"
                  >
                    <Button size={"icon"} variant={"outline"}>
                      <Maximize2 className="h-4 w-4 text-primary" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <Link href={data || ""} target="_blank">
                  <div className="flex items-center gap-1 cursor-pointer hover:opacity-80">
                    <File className="w-4 h-4" />
                    <span>{file_metadata?.filename}</span>
                  </div>
                </Link>
              )}
            </>
          )}
        </div>

        {/* Copy to clipboard icon for user text messages */}
        {message.role === MessageRole.user && messageType === "text" && (
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

const ChatMessagesList = React.memo(function ChatMessagesList() {
  const [messages] = useAtom(messagesAtom);

  useEffect(() => {
    const messageContainer = document.querySelector(".overflow-y-auto");
    if (messageContainer) {
      messageContainer.scrollTop = messageContainer.scrollHeight;
    }
  }, [messages.length]);

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
        </div>
      </div>
    </div>
  );
});

export default ChatMessagesList;
