'use client';

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  AreaChatRequest,
  AreaChatResponse,
  ChatMessage,
} from '@/types/api';

export function useAreaChat(
  lat: number | null,
  lng: number | null,
): {
  messages: ChatMessage[];
  isLoading: boolean;
  send: (message: string) => void;
  reset: () => void;
} {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const mutation = useMutation<AreaChatResponse, Error, AreaChatRequest>({
    mutationFn: async (request: AreaChatRequest) => {
      const response = await api.post<AreaChatResponse>('/area/ask', request);
      return response.data;
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Sorry, something went wrong while processing your request. Please try again.',
        },
      ]);
    },
  });

  const send = useCallback(
    (message: string) => {
      if (!lat || !lng || !message.trim()) return;

      const newMessage: ChatMessage = { role: 'user', content: message };
      const updatedMessages = [...messages, newMessage];
      setMessages(updatedMessages);

      mutation.mutate({ lat, lng, message, history: messages });
    },
    [lat, lng, messages, mutation],
  );

  const reset = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading: mutation.isPending,
    send,
    reset,
  };
}
