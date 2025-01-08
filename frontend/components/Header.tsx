"use client";

import useChat from "@/hooks/useChat";
import ModelSelector from "./ModelSelector";
import { Button } from "./ui/button";
import { History, Plus } from "lucide-react";
import { ModeToggle } from "./DarkModeToggle";
import ChatSettings from "./ChatSettings";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Header() {
  const { selectedModel, setSelectedModel, setMessages } = useChat();
  const router = useRouter();

  // Add useEffect for keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "h") {
        e.preventDefault();
        router.push("/history");
      } else if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setMessages([]);
        router.push("/");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <div className="w-full p-4 h-14 items-center justify-center flex absolute top-0 left-0 right-0 z-10 backdrop-blur-xl bg-background/50 transition-all">
      <div className="absolute right-2 md:right-8 bg-opacity-50 z-10">
        <div className="flex items-center ">
          <ModelSelector
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
          />
          <Button
            variant={"ghost"}
            size={"lg"}
            className=" p-3 rounded-full"
            onClick={() => router.push("/history")}
          >
            <History size={32} />
          </Button>

          <ChatSettings />

          <Button
            variant={"ghost"}
            onClick={() => {
              setMessages([]);
              router.push("/");
            }}
            size={"lg"}
            className=" p-3 rounded-full"
          >
            <Plus size={32} />
          </Button>

          <ModeToggle />
        </div>
      </div>
    </div>
  );
}
