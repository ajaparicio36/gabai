'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { PromoteResponse } from '@/types/api';

export function usePromote() {
  const queryClient = useQueryClient();

  return useMutation<PromoteResponse, Error, string>({
    mutationFn: async (version: string) => {
      const response = await api.post<{
        data: PromoteResponse;
      }>(`/admin/model/promote/${version}`);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'model', 'versions'],
      });
    },
  });
}
