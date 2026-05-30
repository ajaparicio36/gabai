'use client';

import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  ValuationRequest,
  ValuationResponse,
  ValuationByTypeResponse,
} from '@/types/api';

export function useValuation(): {
  mutate: (input: ValuationRequest) => void;
  data: ValuationResponse | undefined;
  isPending: boolean;
  error: Error | null;
} {
  const mutation = useMutation<ValuationResponse, Error, ValuationRequest>({
    mutationFn: async (input: ValuationRequest) => {
      const response = await api.post<{ data: ValuationResponse }>(
        '/valuation',
        input,
      );
      return response.data.data;
    },
  });

  return {
    mutate: mutation.mutate,
    data: mutation.data,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

export interface MultiValuationInput {
  lat: number;
  lng: number;
  lotAreaSqm?: number;
  floorAreaSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  buildingAgeYears?: number;
  address?: string;
  developer?: string;
}

export function useMultiValuation(): {
  mutate: (input: MultiValuationInput) => void;
  data: ValuationByTypeResponse | undefined;
  isPending: boolean;
  error: Error | null;
} {
  const mutation = useMutation<
    ValuationByTypeResponse,
    Error,
    MultiValuationInput
  >({
    mutationFn: async (input: MultiValuationInput) => {
      const response = await api.post<{
        data: ValuationByTypeResponse;
      }>('/valuation/all-types', input);
      return response.data.data;
    },
  });

  return {
    mutate: mutation.mutate,
    data: mutation.data,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
