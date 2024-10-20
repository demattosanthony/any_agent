import { useEffect, useRef, useState } from "react";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { CheckIcon, Paperclip } from "lucide-react";
import { StopIcon } from "@radix-ui/react-icons";

interface ChatInputFormProps {
  input: string;
  setInput: (input: string) => void;
  onSubmit: () => void;
  onAbort?: () => void;
  generating?: boolean;
  disabled?: boolean;
}

const ChatInputForm: React.FC<ChatInputFormProps> = ({
  input,
  setInput,
  onSubmit,
  disabled,
  onAbort,
  generating,
}) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [, setIsTextAreaExpanded] = useState(false);

  const handleKeyDown = async (event: any) => {
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      const caretPosition = event.target.selectionStart;
      const textBeforeCaret = input.substring(0, caretPosition);
      const textAfterCaret = input.substring(caretPosition);
      if (setInput) {
        setInput(textBeforeCaret + "\n" + textAfterCaret);
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (buttonRef.current) buttonRef.current.click();
    }
    if (textAreaRef.current) {
      setIsTextAreaExpanded(textAreaRef.current.clientHeight >= 68);
    }
  };

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "24px";
      textAreaRef.current.style.height =
        textAreaRef.current.scrollHeight + "px";

      setIsTextAreaExpanded(textAreaRef.current.clientHeight >= 68);
    }
  }, [input]);

  useEffect(() => {
    if (!generating) {
      textAreaRef.current?.focus();
    }
  }, [generating]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        onSubmit();
      }}
      className="flex items-center relative h-auto gap-2 z-50 max-w-[800px] w-full"
    >
      <Paperclip className="p-1 absolute bottom-[13px] left-2 h-8 w-8 rounded-full" />

      <Textarea
        ref={textAreaRef}
        value={input}
        role="textbox"
        autoFocus
        onChange={(e: any) => setInput(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || generating}
        placeholder="Ask anything..."
        className="h-[24px] max-h-[250px] pr-[58px] pt-[17px] pl-11 resize-none w-full text-md overflow-hidden rounded-3xl focus:shadow-sm"
      />
      <Button
        size="sm"
        className="p-1 absolute right-2 bottom-[12px] h-9 w-9 rounded-full"
        type="submit"
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          if (generating) {
            // If currently generating, abort the ongoing request
            if (onAbort) onAbort();
          } else {
            onSubmit();
          }
        }}
      >
        {generating ? (
          <StopIcon className="w-8 h-8" />
        ) : (
          <CheckIcon className="w-8 h-8" />
        )}
      </Button>
    </form>
  );
};

export default ChatInputForm;
