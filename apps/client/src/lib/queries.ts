import type {
  Alias,
  AppConfig,
  Conversation,
  ConversationFilter,
  Draft,
  DraftInput,
  EntryPatch,
  FolderCounts,
  Label,
  MailEntry,
  MailPage,
  MailQuery,
  ProfileInput,
  SendMailInput,
  SendResult,
  User,
} from '@dialox/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, setToken, useApi } from './api';

export function useConfig() {
  return useQuery({ queryKey: ['config'], queryFn: () => request<AppConfig>('/api/config'), staleTime: Infinity });
}

/** Invalidates every cached query of the current surface (mail changes ripple widely). */
export function useRefreshMail() {
  const client = useQueryClient();
  const { surface } = useApi();
  return () => client.invalidateQueries({ queryKey: [surface] });
}

export function useMe() {
  const api = useApi();
  return useQuery({ queryKey: [api.surface, 'me'], queryFn: () => api.get<User>('/api/me'), enabled: !!api.token });
}

export function useConversations(filter: ConversationFilter, q: string) {
  const api = useApi();
  const params = new URLSearchParams({ filter, ...(q ? { q } : {}) });
  return useQuery({
    queryKey: [api.surface, 'conversations', filter, q],
    queryFn: () => api.get<Conversation[]>(`/api/conversations?${params}`),
    placeholderData: (previous) => previous,
  });
}

export function useConversation(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: [api.surface, 'conversation', id],
    queryFn: () => api.get<Conversation>(`/api/conversations/${id}`),
    enabled: !!id,
  });
}

export function useConversationMessages(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: [api.surface, 'conversation', id, 'messages'],
    queryFn: () => api.get<MailEntry[]>(`/api/conversations/${id}/messages`),
  });
}

export function useMailList(query: MailQuery) {
  const api = useApi();
  const params = new URLSearchParams(
    Object.entries(query).flatMap(([k, v]) => (v === undefined || v === '' || v === false ? [] : [[k, String(v)]])),
  );
  return useQuery({
    queryKey: [api.surface, 'mail', query],
    queryFn: () => api.get<MailPage>(`/api/mail?${params}`),
    placeholderData: (previous) => previous,
    // Safety net alongside the websocket push, in case a push is missed or arrives before a
    // reconnect completes: an open inbox always catches up within a few seconds either way.
    refetchInterval: 10_000,
  });
}

export function useMailEntry(id: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: [api.surface, 'entry', id],
    queryFn: () => api.get<MailEntry>(`/api/mail/${id}`),
    enabled: !!id,
  });
}

export function useCounts() {
  const api = useApi();
  return useQuery({
    queryKey: [api.surface, 'counts'],
    queryFn: () => api.get<FolderCounts>('/api/mail/counts'),
    refetchInterval: 10_000,
  });
}

export function useDrafts() {
  const api = useApi();
  return useQuery({ queryKey: [api.surface, 'drafts'], queryFn: () => api.get<Draft[]>('/api/drafts') });
}

export function useAliases() {
  const api = useApi();
  return useQuery({ queryKey: [api.surface, 'aliases'], queryFn: () => api.get<Alias[]>('/api/aliases') });
}

export function useLabels() {
  const api = useApi();
  return useQuery({ queryKey: [api.surface, 'labels'], queryFn: () => api.get<Label[]>('/api/labels') });
}

function useMailMutation<T, R>(fn: (api: ReturnType<typeof useApi>, input: T) => Promise<R>) {
  const api = useApi();
  const refresh = useRefreshMail();
  return useMutation({ mutationFn: (input: T) => fn(api, input), onSuccess: refresh });
}

export const useSendMail = () =>
  useMailMutation((api, input: SendMailInput) => api.post<SendResult>('/api/mail/send', input));

export const usePatchEntries = () =>
  useMailMutation((api, { ids, patch }: { ids: string[]; patch: EntryPatch }) =>
    ids.length === 1 ? api.patch(`/api/mail/${ids[0]}`, patch) : api.post('/api/mail/bulk', { ids, patch }),
  );

export const useDeleteForever = () => useMailMutation((api, ids: string[]) => api.post('/api/mail/delete', { ids }));

export const useToggleFavorite = () =>
  useMailMutation((api, { id, isFavorite }: { id: string; isFavorite: boolean }) =>
    api.patch(`/api/conversations/${id}`, { isFavorite }),
  );

export const useSaveDraft = () =>
  useMailMutation((api, { id, draft }: { id?: string; draft: DraftInput }) =>
    id ? api.put<Draft>(`/api/drafts/${id}`, draft) : api.post<Draft>('/api/drafts', draft),
  );

export const useDeleteDraft = () => useMailMutation((api, id: string) => api.del(`/api/drafts/${id}`));

export const useUpdateProfile = () => useMailMutation((api, patch: ProfileInput) => api.patch<User>('/api/me', patch));

export const useCreateAlias = () => useMailMutation((api, name: string) => api.post<Alias>('/api/aliases', { name }));

export const useDeleteAlias = () => useMailMutation((api, id: string) => api.del(`/api/aliases/${id}`));

export const useCreateLabel = () =>
  useMailMutation((api, label: { name: string; color: string }) => api.post<Label>('/api/labels', label));

export const useDeleteLabel = () => useMailMutation((api, id: string) => api.del(`/api/labels/${id}`));

export const useChangePassword = () =>
  useMailMutation((api, body: { current?: string; next: string }) => api.put('/api/me/password', body));

export function useLogout() {
  const api = useApi();
  const client = useQueryClient();
  return async () => {
    await api.post('/api/auth/logout').catch(() => undefined);
    setToken(api.surface, null);
    client.removeQueries({ queryKey: [api.surface] });
  };
}
