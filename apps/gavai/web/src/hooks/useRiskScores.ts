'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { RiskAssessmentResponse } from '@/types/api';

export function useRiskScores(
  lat: number | null,
  lng: number | null,
  enabled: boolean,
): {
  data: RiskAssessmentResponse | undefined;
  isLoading: boolean;
} {
  const query = useQuery<RiskAssessmentResponse, Error>({
    queryKey: ['riskScores', lat, lng],
    queryFn: async () => {
      const response = await api.get<{ data: RiskAssessmentResponse }>(
        '/area/risk-assessment',
        { params: { lat, lng } },
      );
      return response.data.data;
    },
    enabled: enabled && lat !== null && lng !== null,
    staleTime: 60 * 60 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
  };
}
