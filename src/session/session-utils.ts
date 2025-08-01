/**
 * Session 便捷工具函数
 * 提供快速创建和管理 Session 的便捷方法
 */

import { globalSessionManager } from './session-manager';
import { MemorySession } from './memory-session';
import type { ISession, SessionOptions } from '../types/session';

/**
 * 创建新的 Session
 * @param sessionId 可选的 Session ID，如果不提供则自动生成
 * @returns 新创建的 Session 实例
 */
export async function createSession(sessionId?: string): Promise<ISession> {
    return await globalSessionManager.createSession(sessionId);
}

/**
 * 获取指定 ID 的 Session
 * @param sessionId Session ID
 * @returns Session 实例，如果不存在则返回 undefined
 */
export function getSession(sessionId: string): ISession | undefined {
    return globalSessionManager.getSession(sessionId) || undefined;
}

/**
 * 删除指定 ID 的 Session
 * @param sessionId Session ID
 * @returns 是否成功删除
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
    return await globalSessionManager.deleteSession(sessionId);
}

/**
 * 获取所有 Session ID
 * @returns Session ID 数组
 */
export function getAllSessionIds(): string[] {
    return globalSessionManager.getSessionIds();
}

/**
 * 获取 Session 数量
 * @returns Session 总数
 */
export function getSessionCount(): number {
    return globalSessionManager.getSessionCount();
}

/**
 * 清空所有 Sessions
 */
export async function clearAllSessions(): Promise<void> {
    return await globalSessionManager.clearAllSessions();
}

/**
 * 创建内存 Session 的便捷函数
 * @param sessionId Session ID
 * @param options Session 配置选项（可选）
 * @returns MemorySession 实例
 */
export function createMemorySession(sessionId: string, options?: Partial<SessionOptions>): MemorySession {
    const sessionOptions: SessionOptions = {
        sessionId,
        ...options
    };
    return new MemorySession(sessionOptions);
}
