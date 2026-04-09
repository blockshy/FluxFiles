export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  requestId?: string;
  data: T;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedPayload<T> {
  items: T[];
  pagination: Pagination;
}

export interface FileRecord {
  id: number;
  name: string;
  originalName: string;
  objectKey: string;
  size: number;
  mimeType: string;
  description: string;
  category: string;
  tags: string[];
  isPublic: boolean;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalFiles: number;
  publicFiles: number;
  totalDownloads: number;
  totalStorage: number;
}

export interface AdminUser {
  id: number;
  username: string;
  role: string;
}

export interface LoginPayload {
  token: string;
  expiresAt: string;
  user: AdminUser;
}

export interface DownloadPayload {
  url: string;
  expiresAt: string;
}

export interface FileQuery {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateFilePayload {
  name: string;
  description: string;
  category: string;
  tags: string[];
  isPublic: boolean;
}

export interface PrepareUploadPayload {
  originalName: string;
  size: number;
  mimeType: string;
}

export interface PreparedUpload {
  objectKey: string;
  uploadUrl: string;
  method: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface CompleteUploadPayload extends UpdateFilePayload {
  objectKey: string;
  originalName: string;
}
