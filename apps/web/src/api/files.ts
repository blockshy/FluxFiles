import { apiClient } from './client';
import type {
  ApiEnvelope,
  CommentListPayload,
  DownloadPayload,
  FileQuery,
  FileRecord,
  PaginatedPayload,
} from './types';

interface CommentQuery {
  rootId?: number;
  page?: number;
  pageSize?: number;
}

export async function fetchPublicFiles(query: FileQuery) {
  const response = await apiClient.get<ApiEnvelope<PaginatedPayload<FileRecord>>>('/files', {
    params: query,
  });
  return response.data.data;
}

export async function fetchPublicFile(id: number) {
  const response = await apiClient.get<ApiEnvelope<FileRecord>>(`/files/${id}`);
  return response.data.data;
}

export async function requestDownloadLink(id: number) {
  const response = await apiClient.get<ApiEnvelope<DownloadPayload>>(`/files/${id}/download`);
  return response.data.data;
}

export async function fetchPublicFileComments(id: number, query?: CommentQuery) {
  const response = await apiClient.get<ApiEnvelope<CommentListPayload>>(`/files/${id}/comments`, {
    params: query,
  });
  return response.data.data;
}
