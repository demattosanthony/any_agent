"use client";

import { getModelIconPath } from "@/components/ModelSelector";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import useDebounce from "@/hooks/useDebounce";
import { useMeQuery, useThreadsQuery } from "@/queries/queries";
import { Thread } from "@/types/chat";
import { Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function ThreadsPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: user, isFetched } = useMeQuery();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useThreadsQuery(debouncedSearch);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = scrollRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const threads = data?.pages.flatMap((page) => page.threads) ?? [];

  if (!user && isFetched) {
    return redirect("/login");
  }

  return (
    <main className="flex-1 max-w-2xl mx-auto p-4 pt-14 w-full">
      <h1 className="text-2xl font-bold mb-6">Threads</h1>

      <div className="relative mb-6">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4" />
        <Input
          type="search"
          placeholder="Search conversations..."
          className="w-full pl-9 py-2 border-none bg-accent"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <ScrollArea className="h-[calc(100vh-175px)] px-2">
        {threads.map((thread, i) => (
          <ThreadItem key={i} thread={thread} />
        ))}

        <div ref={scrollRef} className="h-10">
          {(isFetchingNextPage || isLoading) && (
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ThreadSkeleton key={i} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </main>
  );
}

function ThreadItem({ thread }: { thread: Thread }) {
  const lastMessage = thread.messages[thread.messages.length - 1];
  const provider = lastMessage?.provider;
  const model = lastMessage?.model;
  const title = thread.title;
  if (
    !lastMessage ||
    !lastMessage.content.text ||
    typeof lastMessage.content.text !== "string"
  )
    return null;

  return (
    <Link href={`/threads/${thread.id}`} prefetch>
      <div className="mb-2 hover:bg-accent p-4 rounded-lg transition-colors max-w-full">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar className="flex-shrink-0 w-6 h-6">
            <AvatarImage
              src={
                provider ? getModelIconPath(provider) || "" : "/ai-avatar.png"
              }
            />
            <AvatarFallback />
          </Avatar>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {title
                ? title
                : lastMessage.role === "user"
                ? "You"
                : model
                ? model
                : "AI Assistant"}
            </p>
            <p className="text-sm text-muted-foreground line-clamp-2 max-w-[calc(100vw-8rem)] md:max-w-full">
              {lastMessage.content.text}
            </p>
            <time className="text-xs text-muted-foreground">
              {new Date(lastMessage.createdAt).toLocaleDateString()}
            </time>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ThreadSkeleton() {
  return (
    <div className="p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/4 mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}
