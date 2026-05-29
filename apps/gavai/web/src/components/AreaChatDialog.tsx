'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAreaChat } from '@/hooks/useAreaChat';
import type { ChatMessage } from '@/types/api';
import { Send, Loader2, Sparkles } from 'lucide-react';

interface AreaChatDialogProps {
  open: boolean;
  onClose: () => void;
  lat: number | null;
  lng: number | null;
  areaName?: string;
  sources: { title: string; url: string; domain: string }[];
}

const DEFAULT_PROMPT =
  'Summarize the key developments in this area in at most 5 bullet points.';

function MessageBubble({ message }: { message: ChatMessage }): React.ReactNode {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

export function AreaChatDialog({
  open,
  onClose,
  lat,
  lng,
  areaName,
  sources,
}: AreaChatDialogProps): React.ReactNode {
  const { messages, isLoading, send, reset } = useAreaChat(lat, lng);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAutoSent = useRef(false);

  useEffect(() => {
    if (open && !hasAutoSent.current) {
      hasAutoSent.current = true;
      queueMicrotask(() => send(DEFAULT_PROMPT));
    }
    if (!open) {
      hasAutoSent.current = false;
      reset();
      setInput('');
    }
  }, [open, send, reset]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    send(input.trim());
    setInput('');
  }, [input, isLoading, send]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            AI Area Chat
          </SheetTitle>
          {areaName && (
            <p className="text-xs text-muted-foreground">{areaName}</p>
          )}
        </SheetHeader>

        {sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1 border-b pb-3">
            <span className="text-[10px] text-muted-foreground">Sources:</span>
            {sources.slice(0, 5).map((s, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">
                [{i + 1}] {s.domain}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto py-3 pr-1">
          {messages.length === 0 && isLoading && (
            <div className="space-y-3">
              <Skeleton className="ml-0 h-16 w-[85%]" />
              <Skeleton className="ml-auto h-10 w-[70%]" />
              <Skeleton className="ml-0 h-20 w-[80%]" />
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {isLoading && messages.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Thinking...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="flex items-center gap-2 border-t pt-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this area..."
            disabled={isLoading}
            className="h-9 text-sm"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
