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
  totalPages?: number;
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
  createdBy?: number;
  createdByUsername?: string;
  createdByDisplayName?: string;
  createdByAvatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentAuthor {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface CommentRecord {
  id: number;
  fileId: number;
  parentId?: number;
  rootId?: number;
  content: string;
  likeCount: number;
  dislikeCount: number;
  currentUserVote: number;
  createdAt: string;
  updatedAt: string;
  canDelete: boolean;
  replyCount: number;
  author: CommentAuthor;
  replyTo?: CommentAuthor;
}

export interface CommentListPayload {
  items: CommentRecord[];
  pagination: Pagination;
  overallTotal: number;
}

export interface NotificationRecord {
  id: number;
  userId: number;
  actorUserId?: number;
  type: string;
  title: string;
  content: string;
  data: Record<string, unknown>;
  isRead: boolean;
  actorUsername?: string;
  actorDisplayName?: string;
  actorAvatarUrl?: string;
  relatedCommentId?: number;
  relatedCommentBody?: string;
  relatedCommentFileId?: number;
  createdAt: string;
}

export interface DashboardStats {
  totalFiles: number;
  publicFiles: number;
  totalDownloads: number;
  totalStorage: number;
}

export interface UserAccount {
  id: number;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  role: string;
  permissions: string[];
  profileVisibility: UserProfileVisibility;
  isEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileVisibility {
  showBio: boolean;
  showStats: boolean;
  showPublishedFiles: boolean;
  showFavorites: boolean;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  role: string;
  permissions: string[];
  isEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginPayload {
  token: string;
  expiresAt: string;
  user: AdminUser;
}

export interface UserLoginPayload {
  token: string;
  expiresAt: string;
  user: UserAccount;
}

export interface RegisterPayload {
  username: string;
  email: string;
  displayName: string;
  password: string;
  captchaId?: string;
  captchaAnswer?: string;
}

export interface CaptchaSettings {
  loginEnabled: boolean;
  registrationEnabled: boolean;
}

export interface CaptchaChallenge {
  id: string;
  question: string;
}

export interface PublicRegisterConfig {
  registrationEnabled: boolean;
  captcha: CaptchaSettings;
}

export interface UpdateProfilePayload {
  email: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  profileVisibility: UserProfileVisibility;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface UserDownloadRecord extends FileRecord {
  downloadedAt: string;
}

export interface PublicUserProfileStats {
  publishedFiles: number;
  favorites: number;
}

export interface PublicUserProfile {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  createdAt: string;
  profileVisibility: UserProfileVisibility;
  stats?: PublicUserProfileStats;
  publishedFiles?: FileRecord[];
  favorites?: FileRecord[];
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

export interface UserQuery {
  page: number;
  pageSize: number;
  search?: string;
}

export interface TaxonomyQuery {
  page: number;
  pageSize: number;
  search?: string;
}

export interface OperationLogQuery {
  page: number;
  pageSize: number;
  search?: string;
  action?: string;
  targetType?: string;
}

export interface CreateManagedUserPayload {
  username: string;
  email: string;
  displayName: string;
  password: string;
  role: string;
  permissions: string[];
  isEnabled: boolean;
}

export interface UpdateManagedUserPayload {
  email: string;
  displayName: string;
  role: string;
  permissions: string[];
  isEnabled: boolean;
}

export interface AdminSettings {
  registrationEnabled: boolean;
  captcha: CaptchaSettings;
  rateLimits: RateLimitSettings;
  uploadSettings: UploadSettings;
}

export interface RateLimitRuleSettings {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitSettings {
  login: RateLimitRuleSettings;
  download: RateLimitRuleSettings;
  upload: RateLimitRuleSettings;
  list: RateLimitRuleSettings;
}

export interface UploadSettings {
  restrictFileSize: boolean;
  maxSizeBytes: number;
  restrictFileTypes: boolean;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
}

export interface PermissionTemplate {
  key: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface PermissionTemplateSettings {
  templates: PermissionTemplate[];
}

export interface AuditFieldChange {
  field: string;
  label: string;
  before?: unknown;
  after?: unknown;
}

export interface AuditDetail {
  summary: string;
  changes?: AuditFieldChange[];
  meta?: Record<string, unknown>;
}

export interface OperationLogRecord {
  id: number;
  adminUserId: number;
  adminUsername: string;
  adminDisplayName: string;
  adminAvatarUrl: string;
  adminIsEnabled: boolean;
  action: string;
  targetType: string;
  targetId: string;
  targetUserId?: number;
  targetUsername?: string;
  targetDisplayName?: string;
  targetEmail?: string;
  targetRole?: string;
  targetAvatarUrl?: string;
  targetPermissions?: string[];
  targetUserIsEnabled: boolean;
  detail: string;
  detailParsed?: AuditDetail | null;
  ip: string;
  createdAt: string;
}

export interface TaxonomyRecord {
  id: number;
  name: string;
  createdBy: number;
  updatedBy: number;
  createdByUsername?: string;
  updatedByUsername?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaveTaxonomyPayload {
  name: string;
}

export interface TaxonomyLogRecord {
  id: number;
  taxonomyType: string;
  taxonomyId: number;
  action: string;
  beforeData: string;
  afterData: string;
  adminUserId: number;
  adminUsername?: string;
  createdAt: string;
}

export interface NotificationListPayload {
  items: NotificationRecord[];
  pagination: Pagination;
  unread: number;
}
