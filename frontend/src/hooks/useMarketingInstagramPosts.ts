import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type {
  InstagramOAuthCallbackPayload,
  InstagramPostPayload,
  InstagramPostQueryParams,
} from '../types/domain';

export const MARKETING_KEYS = {
  instagramPosts: (params: InstagramPostQueryParams) => ['marketing', 'instagram-posts', params] as const,
  instagramConnection: ['marketing', 'instagram-connection'] as const,
  all: ['marketing'] as const,
};

export function useInstagramPosts(params: InstagramPostQueryParams) {
  return useQuery({
    queryKey: MARKETING_KEYS.instagramPosts(params),
    queryFn: () => apiService.getInstagramPosts(params),
  });
}

export function useInstagramConnection() {
  return useQuery({
    queryKey: MARKETING_KEYS.instagramConnection,
    queryFn: () => apiService.getInstagramConnection(),
  });
}

export function useCreateInstagramPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InstagramPostPayload) => apiService.createInstagramPost(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MARKETING_KEYS.all }),
  });
}

export function useUpdateInstagramPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<InstagramPostPayload> }) =>
      apiService.updateInstagramPost(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MARKETING_KEYS.all }),
  });
}

export function useDeleteInstagramPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteInstagramPost(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MARKETING_KEYS.all }),
  });
}

export function useUploadInstagramPostMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      apiService.uploadInstagramPostMedia(id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MARKETING_KEYS.all }),
  });
}

export function useUploadInstagramCarouselSlide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      apiService.uploadInstagramCarouselSlide(id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MARKETING_KEYS.all }),
  });
}

export function useDeleteInstagramCarouselSlide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, slideId }: { postId: string; slideId: string }) =>
      apiService.deleteInstagramCarouselSlide(postId, slideId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MARKETING_KEYS.all }),
  });
}

export function useReorderInstagramCarouselSlides() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, slideIds }: { postId: string; slideIds: string[] }) =>
      apiService.reorderInstagramCarouselSlides(postId, slideIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MARKETING_KEYS.all }),
  });
}

export function usePublishInstagramPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.publishInstagramPost(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MARKETING_KEYS.all }),
  });
}

export function useInstagramConnectionLink() {
  return useMutation({
    mutationFn: () => apiService.getInstagramConnectionLink(),
  });
}

export function useCompleteInstagramConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InstagramOAuthCallbackPayload) =>
      apiService.completeInstagramConnection(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MARKETING_KEYS.instagramConnection }),
  });
}

export function useDisconnectInstagramConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiService.disconnectInstagramConnection(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MARKETING_KEYS.instagramConnection }),
  });
}
