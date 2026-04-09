import { apiClient } from './client';
import axios from 'axios';
import type {
  AdminSettings,
  AdminUser,
  ApiEnvelope,
  CaptchaSettings,
  CompleteUploadPayload,
  CreateManagedUserPayload,
  DashboardStats,
  FileQuery,
  FileRecord,
  LoginPayload,
  OperationLogQuery,
  OperationLogRecord,
  PermissionTemplate,
  PermissionTemplateSettings,
  PaginatedPayload,
  PreparedUpload,
  PrepareUploadPayload,
  RateLimitSettings,
  UploadSettings,
  UpdateManagedUserPayload,
  UpdateFilePayload,
  UserQuery,
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

export async function fetchAdminUsers(query: UserQuery) {
  const response = await apiClient.get<ApiEnvelope<PaginatedPayload<AdminUser>>>('/admin/users', {
    params: query,
  });
  return response.data.data;
}

export async function createAdminUser(payload: CreateManagedUserPayload) {
  const response = await apiClient.post<ApiEnvelope<AdminUser>>('/admin/users', payload);
  return response.data.data;
}

export async function updateAdminUser(id: number, payload: UpdateManagedUserPayload) {
  const response = await apiClient.put<ApiEnvelope<AdminUser>>(`/admin/users/${id}`, payload);
  return response.data.data;
}

export async function fetchAdminSettings() {
  const response = await apiClient.get<ApiEnvelope<AdminSettings>>('/admin/settings');
  return response.data.data;
}

export async function fetchAdminUploadSettings() {
  const response = await apiClient.get<ApiEnvelope<{ uploadSettings: UploadSettings }>>('/admin/files/upload-settings');
  return response.data.data.uploadSettings;
}

export async function updateRegistrationSetting(registrationEnabled: boolean) {
  const response = await apiClient.put<ApiEnvelope<AdminSettings>>('/admin/settings/registration', {
    registrationEnabled,
  });
  return response.data.data;
}

export async function updateRateLimitSettings(rateLimits: RateLimitSettings) {
  const response = await apiClient.put<ApiEnvelope<{ rateLimits: RateLimitSettings }>>('/admin/settings/rate-limits', rateLimits);
  return response.data.data.rateLimits;
}

export async function updateCaptchaSettings(captcha: CaptchaSettings) {
  const response = await apiClient.put<ApiEnvelope<{ captcha: CaptchaSettings }>>('/admin/settings/captcha', captcha);
  return response.data.data.captcha;
}

export async function updateUploadSettings(uploadSettings: UploadSettings) {
  const response = await apiClient.put<ApiEnvelope<{ uploadSettings: UploadSettings }>>('/admin/settings/upload', uploadSettings);
  return response.data.data.uploadSettings;
}

export async function fetchAdminLogs(query: OperationLogQuery) {
  const response = await apiClient.get<ApiEnvelope<PaginatedPayload<OperationLogRecord>>>('/admin/logs', {
    params: query,
  });
  return {
    ...response.data.data,
    items: response.data.data.items.map((item) => {
      try {
        return { ...item, detailParsed: JSON.parse(item.detail) };
      } catch {
        return { ...item, detailParsed: null };
      }
    }),
  };
}

export async function fetchPermissionTemplates() {
  const response = await apiClient.get<ApiEnvelope<PermissionTemplateSettings>>('/admin/settings/permission-templates');
  return response.data.data.templates;
}

export async function updatePermissionTemplates(templates: PermissionTemplate[]) {
  const response = await apiClient.put<ApiEnvelope<PermissionTemplateSettings>>('/admin/settings/permission-templates', {
    templates,
  });
  return response.data.data.templates;
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
