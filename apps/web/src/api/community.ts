import { apiClient } from './client';
import type {
  ApiEnvelope,
  CommunityModerationPayload,
  CommunityPostPayload,
  CommunityPostRecord,
  CommunityReplyPayload,
  CommunityReplyRecord,
  PaginatedPayload,
} from './types';

interface CommunityListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export async function fetchCommunityPosts(query: CommunityListQuery) {
  const response = await apiClient.get<ApiEnvelope<PaginatedPayload<CommunityPostRecord>>>('/community/posts', {
    params: query,
  });
  return response.data.data;
}

export async function fetchCommunityPost(id: number) {
  const response = await apiClient.get<ApiEnvelope<CommunityPostRecord>>(`/community/posts/${id}`);
  return response.data.data;
}

export async function fetchCommunityReplies(postId: number, query: CommunityListQuery) {
  const response = await apiClient.get<ApiEnvelope<PaginatedPayload<CommunityReplyRecord>>>(`/community/posts/${postId}/replies`, {
    params: query,
  });
  return response.data.data;
}

export async function createCommunityPost(payload: CommunityPostPayload) {
  const response = await apiClient.post<ApiEnvelope<CommunityPostRecord>>('/user/community/posts', payload);
  return response.data.data;
}

export async function updateCommunityPost(id: number, payload: CommunityPostPayload) {
  const response = await apiClient.put<ApiEnvelope<CommunityPostRecord>>(`/user/community/posts/${id}`, payload);
  return response.data.data;
}

export async function deleteCommunityPost(id: number) {
  const response = await apiClient.delete<ApiEnvelope<null>>(`/user/community/posts/${id}`);
  return response.data;
}

export async function createCommunityReply(postId: number, payload: CommunityReplyPayload) {
  const response = await apiClient.post<ApiEnvelope<CommunityReplyRecord>>(`/user/community/posts/${postId}/replies`, payload);
  return response.data.data;
}

export async function deleteCommunityReply(id: number) {
  const response = await apiClient.delete<ApiEnvelope<null>>(`/user/community/replies/${id}`);
  return response.data;
}

export async function fetchAdminCommunityPosts(query: CommunityListQuery) {
  const response = await apiClient.get<ApiEnvelope<PaginatedPayload<CommunityPostRecord>>>('/admin/community/posts', {
    params: query,
  });
  return response.data.data;
}

export async function moderateCommunityPost(id: number, payload: CommunityModerationPayload) {
  const response = await apiClient.post<ApiEnvelope<null>>(`/admin/community/posts/${id}/moderate`, payload);
  return response.data;
}
