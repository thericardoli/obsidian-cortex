/**
 * Session 模块导出
 * 提供会话管理功能，用于管理模型的上下文窗口
 */

// 类型定义
export * from '../types/session';

// Session 实现
export { MemorySession } from './memory-session';

// Session 管理器  
export { SessionManager, globalSessionManager } from './session-manager';

// 便捷函数
export { 
    createSession, 
    getSession, 
    deleteSession, 
    getAllSessionIds, 
    getSessionCount, 
    clearAllSessions, 
    createMemorySession 
} from './session-utils';
