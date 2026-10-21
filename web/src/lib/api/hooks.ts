"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from ".";

/** Data hooks used by every screen. Keys are grouped so a write can refresh everything at once. */

export const useShop = () => useQuery({ queryKey: ["shop"], queryFn: () => api.getShop() });
export const useCustomers = () => useQuery({ queryKey: ["customers"], queryFn: () => api.listCustomers() });
export const useReminderCandidates = () => useQuery({ queryKey: ["candidates"], queryFn: () => api.listReminderCandidates() });
export const useCustomer = (id: string) => useQuery({ queryKey: ["customer", id], queryFn: () => api.getCustomer(id) });
export const useCalls = () => useQuery({ queryKey: ["calls"], queryFn: () => api.listCalls() });
export const useCall = (id: string) => useQuery({ queryKey: ["call", id], queryFn: () => api.getCall(id) });
export const useBatches = () => useQuery({ queryKey: ["batches"], queryFn: () => api.listBatches() });
export const useDashboard = () => useQuery({ queryKey: ["dashboard"], queryFn: () => api.getDashboard() });
export const useDailyReport = () => useQuery({ queryKey: ["report"], queryFn: () => api.getDailyReport() });
export const useGraph = () => useQuery({ queryKey: ["graph"], queryFn: () => api.getGraph() });

/** Wraps an API write. Everything is refetched afterwards, because any write can change any view. */
export function useApiMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries() });
}
