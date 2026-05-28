'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ReportResponse } from '@/types/api';

export function useGenerateReport(): {
  mutate: (valuationId: string) => void;
  data: ReportResponse | undefined;
  isPending: boolean;
} {
  const mutation = useMutation<ReportResponse, Error, string>({
    mutationFn: async (valuationId: string) => {
      const response = await api.post<{ data: ReportResponse }>(
        '/report/generate',
        { valuationId },
      );
      return response.data.data;
    },
  });

  return {
    mutate: mutation.mutate,
    data: mutation.data,
    isPending: mutation.isPending,
  };
}

export function useReport(id: string | null): {
  data: ReportResponse | undefined;
  isLoading: boolean;
} {
  const query = useQuery<ReportResponse, Error>({
    queryKey: ['report', id],
    queryFn: async () => {
      const response = await api.get<{ data: ReportResponse }>(`/report/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
  };
}
