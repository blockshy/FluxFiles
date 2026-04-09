import { apiClient } from './client';
import type {
  ApiEnvelope,
  CaptchaChallenge,
  ChangePasswordPayload,
  FileRecord,
  RegisterPayload,
  UpdateProfilePayload,
  UserAccount,
  UserDownloadRecord,
  UserLoginPayload,
  PublicRegisterConfig,
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
