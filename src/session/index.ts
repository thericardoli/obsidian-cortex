/**
 * Session 模块导出
 * 提供会话管理功能，用于管理模型的上下文窗口
 */

// 类型定义
export * from '../types/session';

// Session 实现 - 统一使用智能缓存 Session
export { chatSession as CachedSession } from './chat-session';

// Session 管理器
// globalSessionManager 已废弃：仅导出 SessionManager 类
export { SessionManager } from './session-manager';
