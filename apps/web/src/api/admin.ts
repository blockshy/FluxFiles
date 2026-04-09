import { apiClient } from './client';
import axios from 'axios';
import type {
  AdminUser,
  ApiEnvelope,
  CompleteUploadPayload,
  DashboardStats,
  FileQuery,
  FileRecord,
  LoginPayload,
  PaginatedPayload,
  PreparedUpload,
  PrepareUploadPayload,
  UpdateFilePayload,
} from './types';

export async function adminLogin(username: string, password: string) {
  const response = await apiClient.post<ApiEnvelope<LoginPayload>>('/admin/login', {
    username,
    password,
  });
  return response.data.data;
}

export async function fetchAdminMe() {
  const response = await apiClient.get<ApiEnvelope<AdminUser>>('/admin/me');
  return response.data.data;
}

export async function fetchAdminFiles(query: FileQuery) {
  const response = await apiClient.get<ApiEnvelope<PaginatedPayload<FileRecord>>>('/admin/files', {
    params: query,
  });
  return response.data.data;
}

export async function fetchAdminStats() {
  const response = await apiClient.get<ApiEnvelope<DashboardStats>>('/admin/stats');
  return response.data.data;
}

export async function prepareAdminUpload(payload: PrepareUploadPayload) {
  const response = await apiClient.post<ApiEnvelope<PreparedUpload>>('/admin/files/upload-prepare', payload);
  return response.data.data;
}

export async function uploadFileToOSS(uploadUrl: string, file: File, headers: Record<string, string>) {
  await axios.put(uploadUrl, file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      ...headers,
    },
    timeout: 120000,
  });
}

export async function createAdminFile(payload: CompleteUploadPayload) {
  const response = await apiClient.post<ApiEnvelope<FileRecord>>('/admin/files', payload);
  return response.data.data;
}

export async function updateAdminFile(id: number, payload: UpdateFilePayload) {
  const response = await apiClient.put<ApiEnvelope<FileRecord>>(`/admin/files/${id}`, payload);
  return response.data.data;
}

export async function deleteAdminFile(id: number) {
  const response = await apiClient.delete<ApiEnvelope<null>>(`/admin/files/${id}`);
  return response.data;
}
