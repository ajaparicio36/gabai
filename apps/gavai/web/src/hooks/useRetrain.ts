'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { RetrainResponse } from '@/types/api';

export function useRetrain() {
  const queryClient = useQueryClient();

  return useMutation<RetrainResponse, Error>({
    mutationFn: async () => {
      const response = await api.post<{
        data: RetrainResponse;
      }>('/admin/train/retrain');
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'model', 'versions'],
      });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'train', 'records'],
      });
    },
  });
}
