import { apiClient } from './client';
import type {
  ApiEnvelope,
  CaptchaChallenge,
  ChangePasswordPayload,
  CommentRecord,
  FileRecord,
  NotificationListPayload,
  RegisterPayload,
  UpdateProfilePayload,
  UserAccount,
  UserDownloadRecord,
  UserLoginPayload,
  PublicRegisterConfig,
  PublicUserProfile,
} from './types';

export async function registerUser(payload: RegisterPayload) {
  const response = await apiClient.post<ApiEnvelope<UserAccount>>('/auth/register', payload);
  return response.data.data;
}

export async function fetchRegisterConfig() {
  const response = await apiClient.get<ApiEnvelope<PublicRegisterConfig>>('/auth/register-config');
  return response.data.data;
}

export async function fetchCaptcha() {
  const response = await apiClient.get<ApiEnvelope<CaptchaChallenge>>('/auth/captcha');
  return response.data.data;
}

export async function loginUser(username: string, password: string, captchaId?: string, captchaAnswer?: string) {
  const response = await apiClient.post<ApiEnvelope<UserLoginPayload>>('/auth/login', {
    username,
    password,
    captchaId,
    captchaAnswer,
  });
  return response.data.data;
}

export async function fetchCurrentUser() {
  const response = await apiClient.get<ApiEnvelope<UserAccount>>('/user/me');
  return response.data.data;
}

export async function updateCurrentUser(payload: UpdateProfilePayload) {
  const response = await apiClient.put<ApiEnvelope<UserAccount>>('/user/me', payload);
  return response.data.data;
}

export async function changeCurrentUserPassword(payload: ChangePasswordPayload) {
  const response = await apiClient.put<ApiEnvelope<null>>('/user/password', payload);
  return response.data;
}

export async function fetchFavoriteFiles() {
  const response = await apiClient.get<ApiEnvelope<FileRecord[]>>('/user/favorites');
  return response.data.data;
}

export async function addFavoriteFile(fileId: number) {
  const response = await apiClient.post<ApiEnvelope<null>>(`/user/favorites/${fileId}`);
  return response.data;
}

export async function removeFavoriteFile(fileId: number) {
  const response = await apiClient.delete<ApiEnvelope<null>>(`/user/favorites/${fileId}`);
  return response.data;
}

export async function fetchDownloadHistory(limit = 50) {
  const response = await apiClient.get<ApiEnvelope<UserDownloadRecord[]>>('/user/downloads', {
    params: { limit },
  });
  return response.data.data;
}

export async function fetchPublicUserProfile(username: string) {
  const response = await apiClient.get<ApiEnvelope<PublicUserProfile>>(`/users/${encodeURIComponent(username)}/profile`);
  return response.data.data;
}

export async function createComment(fileId: number, payload: { content: string; parentId?: number }) {
  const response = await apiClient.post<ApiEnvelope<CommentRecord>>(`/user/files/${fileId}/comments`, payload);
  return response.data.data;
}

export async function deleteComment(commentId: number) {
  const response = await apiClient.delete<ApiEnvelope<null>>(`/user/comments/${commentId}`);
  return response.data;
}

export async function voteComment(commentId: number, value: 1 | -1) {
  const response = await apiClient.post<ApiEnvelope<{ currentVote: number }>>(`/user/comments/${commentId}/vote`, { value });
  return response.data.data;
}

export async function fetchNotifications(page = 1, pageSize = 20, type?: string) {
  const response = await apiClient.get<ApiEnvelope<NotificationListPayload>>('/user/notifications', {
    params: { page, pageSize, type },
  });
  return response.data.data;
}

export async function markNotificationRead(id: number) {
  const response = await apiClient.post<ApiEnvelope<null>>(`/user/notifications/${id}/read`);
  return response.data;
}

export async function markNotificationsRead(type?: string) {
  const response = await apiClient.post<ApiEnvelope<null>>('/user/notifications/read-all', undefined, {
    params: { type },
  });
  return response.data;
}

export async function fetchMyComments(page = 1, pageSize = 20) {
  const response = await apiClient.get<ApiEnvelope<{ items: CommentRecord[]; pagination: NotificationListPayload['pagination'] }>>('/user/comments/mine', {
    params: { page, pageSize },
  });
  return response.data.data;
}
