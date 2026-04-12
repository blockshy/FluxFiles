import axios from 'axios';
import type { AppLocale } from '../features/i18n/LocaleProvider';

const zhMessageMap: Record<string, string> = {
  'admin privileges required': '当前账号没有后台管理权限。',
  'authentication service is temporarily unavailable': '认证服务暂时不可用，请稍后再试。',
  'captcha service is temporarily unavailable': '验证码服务暂时不可用，请稍后再试。',
  'captcha verification failed': '验证码错误或已过期，请重新输入。',
  'cannot vote on your own comment': '不能给自己的评论点赞或点踩。',
  'connect database': '数据库连接失败，请稍后再试。',
  'duplicate template key': '模板键重复，请使用新的模板键。',
  'cannot delete current admin user': '不能删除当前正在使用的管理员账号。',
  'cannot delete user with uploaded files': '该用户仍有上传文件，不能删除。',
  'comment not found': '评论不存在或已被删除。',
  'comment service is temporarily unavailable': '评论服务暂时不可用，请稍后再试。',
  'community post created': '社区帖子已发布。',
  'community post deleted': '社区帖子已删除。',
  'community post not found': '社区帖子不存在或已被删除。',
  'community post updated': '社区帖子已更新。',
  'community reply created': '社区回复已发布。',
  'community reply deleted': '社区回复已删除。',
  'community reply not found': '社区回复不存在或已被删除。',
  'community service is temporarily unavailable': '社区服务暂时不可用，请稍后再试。',
  'current password is incorrect': '当前密码不正确。',
  'download history service is temporarily unavailable': '下载历史服务暂时不可用，请稍后再试。',
  'download record service is temporarily unavailable': '下载记录服务暂时不可用，请稍后再试。',
  'download service is temporarily unavailable': '下载服务暂时不可用，请稍后再试。',
  'failed to create download link': '下载链接生成失败，请稍后再试。',
  'failed to login': '登录失败，请稍后再试。',
  'favorite service is temporarily unavailable': '收藏服务暂时不可用，请稍后再试。',
  'file not found': '文件不存在或已被删除。',
  'file service is temporarily unavailable': '文件服务暂时不可用，请稍后再试。',
  'guest downloads are disabled': '当前站点已关闭游客下载，请登录后再下载。',
  'internal server error': '服务器内部错误，请稍后再试。',
  'insufficient permissions': '当前账号没有执行该操作的权限。',
  'invalid email format': '邮箱格式不正确，请检查后重新提交。',
  'invalid or expired token': '登录状态已失效，请重新登录。',
  'invalid avatar': '头像文件读取失败，请重新选择图片。',
  'invalid captcha payload': '验证码请求无效，请刷新页面后重试。',
  'invalid comment payload': '评论内容无效，请检查内容是否为空或过长。',
  'invalid community moderation payload': '社区帖子管理指令无效，请刷新页面后重试。',
  'invalid community post payload': '社区帖子内容无效，请检查标题和正文。',
  'invalid community reply payload': '社区回复内容无效，请检查内容是否为空、过长或帖子已锁定。',
  'invalid download settings payload': '下载设置格式不正确，请检查游客下载开关、验证码开关和链接有效期。',
  'invalid file list display payload': '文件列表显示设置格式不正确，请检查分类和标签显示方式。',
  'invalid endAt': '结束时间格式无效。',
  'invalid login payload': '登录信息格式不正确，请检查账号和密码。',
  'invalid password payload': '密码信息格式不正确，请检查后重新提交。',
  'invalid permission templates payload': '权限模板配置格式不正确。',
  'invalid profile payload': '个人资料格式不正确，请检查邮箱、昵称、头像或简介。',
  'invalid rate limit payload': '限流配置格式不正确，请检查次数和时间窗口。',
  'invalid register payload': '注册信息格式不正确，请检查账号、邮箱、昵称和密码。',
  'invalid request payload': '提交内容格式不正确，请检查表单。',
  'invalid settings payload': '系统设置格式不正确，请刷新后重试。',
  'invalid startAt': '开始时间格式无效。',
  'invalid taxonomy payload': '分类或标签内容格式不正确。',
  'invalid upload settings payload': '上传限制配置格式不正确。',
  'invalid user payload': '用户信息格式不正确，请检查账号、邮箱、昵称、角色和权限。',
  'invalid vote payload': '点赞/点踩参数无效，请刷新页面后重试。',
  'invalid permission': '包含无效权限项，请刷新页面后重新选择。',
  'at least one permission is required': '至少需要选择一项权限。',
  'file edit/delete permissions require own-file or all-file scope': '后台文件编辑或删除权限依赖“自己的文件范围”或“全部文件范围”。',
  'download record view permission requires own-file or all-file scope': '下载记录查看权限依赖“自己的文件范围”或“全部文件范围”。',
  'community moderation requires community view permission': '社区管理权限依赖“社区帖子查看”。',
  'public file actions require public file list view permission': '前台文件操作依赖“前台文件列表查看”。',
  'public file interactions require public file detail permission': '前台下载、收藏和评论依赖“前台文件详情查看”。',
  'comment reply permission requires comment create permission': '评论回复权限依赖“评论发布”。',
  'community actions require community view permission': '社区操作权限依赖“社区查看”。',
  'community post edit/delete permissions require post create permission': '编辑或删除自己的帖子权限依赖“社区发帖”。',
  'community reply delete permission requires reply create permission': '删除自己的社区回复权限依赖“社区回复”。',
  'profile edit permission requires own profile view permission': '个人资料编辑权限依赖“个人中心查看”。',
  'taxonomy management and log permissions require view permission': '分类或标签的维护、日志权限依赖对应查看权限。',
  'notification service is temporarily unavailable': '消息通知服务暂时不可用，请稍后再试。',
  'operation log service is temporarily unavailable': '操作日志服务暂时不可用，请稍后再试。',
  'registration is currently disabled': '当前站点暂未开放注册。',
  'settings service is temporarily unavailable': '系统设置服务暂时不可用，请稍后再试。',
  'statistics service is temporarily unavailable': '统计服务暂时不可用，请稍后再试。',
  'storage service is temporarily unavailable': '文件存储服务暂时不可用，请稍后再试。',
  'target not found': '回复目标不存在或已被删除。',
  'taxonomy not found': '分类或标签不存在，可能已被删除。',
  'taxonomy service is temporarily unavailable': '分类/标签服务暂时不可用，请稍后再试。',
  'too many failed login attempts': '登录失败次数过多，请稍后再试。',
  'user still has operation logs': '该用户仍有关联的操作日志，暂不允许删除。',
  'user still has tag records': '该用户仍有关联的标签记录，暂不允许删除。',
  'taxonomy still contains child nodes': '当前分类或标签下仍有子项，暂不允许删除。',
  'user still has taxonomy change logs': '该用户仍有关联的分类标签变更记录，暂不允许删除。',
  'user still owns category records': '该用户仍有关联的分类记录，暂不允许删除。',
  'user account is disabled': '该账号已被停用，请联系管理员。',
  'user not found': '用户不存在或已被删除。',
  'user service is temporarily unavailable': '用户服务暂时不可用，请稍后再试。',
  'username already exists': '用户名已存在，请更换后再试。',
  'username or password is incorrect': '账号或密码不正确。',
  'email already exists': '邮箱已被占用，请更换后再试。',
  'name already exists': '名称已存在，请更换后再试。',
  'taxonomy is still used by files': '当前分类或标签仍被文件使用，暂不允许删除。',
  'category does not exist': '所选分类不存在，请刷新页面后重试。',
  'tag does not exist': '所选标签不存在，请刷新页面后重试。',
  'taxonomy cannot be its own parent': '不能把当前节点移动到自身下面。',
  'parent taxonomy does not exist': '父级节点不存在，请刷新页面后重试。',
  'taxonomy hierarchy cannot contain cycles': '层级结构不能形成循环引用。',
  'template key and name are required': '模板键和模板名称不能为空。',
  'at least one enabled admin with user edit permission must remain': '系统中至少需要保留一个启用中的、具备用户编辑权限的管理员。',
  'post is locked': '该帖子已锁定，暂时不能继续回复。',
  'failed to upload file': '上传文件失败，请稍后再试。',
  'failed to prepare upload': '上传准备失败，请检查文件信息后重试。',
  'failed to update file': '文件更新失败，请稍后再试。',
  'failed to delete file': '文件删除失败，请稍后再试。',
  'rate limit exceeded, please retry later': '操作过于频繁，请稍后再试。',
  'access denied': '当前访问已被拒绝。',
  'vote service is temporarily unavailable': '互动投票服务暂时不可用，请稍后再试。',
};

function translateMessage(message: string, locale: AppLocale) {
  const normalized = message.trim();
  if (!normalized) {
    return '';
  }
  if (locale !== 'zh-CN') {
    return normalized;
  }
  const direct = zhMessageMap[normalized];
  if (direct) {
    return direct;
  }
  const parts = normalized.split(':').map((item) => item.trim()).filter(Boolean);
  if (parts.length > 1) {
    const translatedParts = parts.map((part) => zhMessageMap[part] ?? part);
    return translatedParts.join('：');
  }
  return normalized;
}

export function getApiErrorMessage(error: unknown, fallback: string, locale: AppLocale) {
  if (axios.isAxiosError(error)) {
    const text = error.response?.data?.message;
    if (typeof text === 'string' && text.trim()) {
      return translateMessage(text, locale);
    }
    if (error.response?.status === 401) {
      return locale === 'zh-CN' ? '登录状态已失效，请重新登录。' : 'Your session expired. Please sign in again.';
    }
    if (error.response?.status === 403) {
      return locale === 'zh-CN' ? '当前账号没有执行该操作的权限。' : 'You do not have permission to perform this action.';
    }
    if (error.response?.status === 404) {
      return locale === 'zh-CN' ? '请求的资源不存在或已被删除。' : 'The requested resource does not exist or was deleted.';
    }
    if (error.code === 'ECONNABORTED') {
      return locale === 'zh-CN' ? '请求超时，请检查网络后重试。' : 'The request timed out. Please check your connection and try again.';
    }
    if (!error.response) {
      return locale === 'zh-CN' ? '无法连接服务器，请检查网络或稍后再试。' : 'Unable to connect to the server. Please check your connection or try again later.';
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return translateMessage(error.message, locale);
  }
  return fallback;
}
