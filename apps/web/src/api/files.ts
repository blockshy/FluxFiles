import { apiClient } from './client';
import type {
  ApiEnvelope,
  CommentListPayload,
  DownloadPayload,
  FileQuery,
  FileListDisplaySettings,
  FileRecord,
  PaginatedPayload,
  PublicDownloadConfig,
  TaxonomyRecord,
} from './types';

interface CommentQuery {
  rootId?: number;
  page?: number;
  pageSize?: number;
}

export async function fetchPublicFiles(query: FileQuery) {
  const params = {
    ...query,
    categories: query.categories?.length ? query.categories.join(',') : undefined,
    tags: query.tags?.length ? query.tags.join(',') : undefined,
  };
  const response = await apiClient.get<ApiEnvelope<PaginatedPayload<FileRecord>>>('/files', {
    params,
  });
  return response.data.data;
}

export async function fetchPublicCategoryOptions() {
  const response = await apiClient.get<ApiEnvelope<{ items: TaxonomyRecord[] }>>('/files/categories/options');
  return response.data.data.items;
}

export async function fetchPublicTagOptions() {
  const response = await apiClient.get<ApiEnvelope<{ items: TaxonomyRecord[] }>>('/files/tags/options');
  return response.data.data.items;
}

export async function fetchPublicFile(id: number) {
  const response = await apiClient.get<ApiEnvelope<FileRecord>>(`/files/${id}`);
  return response.data.data;
}

export async function fetchPublicDownloadConfig() {
  const response = await apiClient.get<ApiEnvelope<PublicDownloadConfig>>('/files/download-config');
  return response.data.data;
}

export async function fetchPublicFileListDisplayConfig() {
  const response = await apiClient.get<ApiEnvelope<FileListDisplaySettings>>('/files/list-display-config');
  return response.data.data;
}

export async function requestDownloadLink(id: number, captcha?: { captchaId?: string; captchaAnswer?: string }) {
  const response = await apiClient.get<ApiEnvelope<DownloadPayload>>(`/files/${id}/download`, {
    params: captcha,
  });
  return response.data.data;
}

export async function fetchPublicFileComments(id: number, query?: CommentQuery) {
  const response = await apiClient.get<ApiEnvelope<CommentListPayload>>(`/files/${id}/comments`, {
    params: query,
  });
  return response.data.data;
}
