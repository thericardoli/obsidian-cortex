/**
 * Session 便捷工具函数
 * 提供快速创建和管理 Session 的便捷方法
 */

import { globalSessionManager } from './session-manager';
import type { ISession } from '../types/session';

/**
 * 创建新的 Session（使用智能缓存）
 * @param sessionId Session ID
 * @returns 新创建的 Session 实例
 */
export async function createSession(sessionId: string): Promise<ISession> {
    return await globalSessionManager.createSession(sessionId);
}

/**
 * 获取指定 ID 的 Session（异步版本，支持从数据库加载）
 * @param sessionId Session ID
 * @returns Session 实例，如果不存在则返回 null
 */
export async function getSession(sessionId: string): Promise<ISession | null> {
    return await globalSessionManager.getSession(sessionId);
}

/**
 * 获取指定 ID 的 Session（同步版本，仅从内存获取）
 * @param sessionId Session ID
 * @returns Session 实例，如果不存在则返回 null
 */
export function getSessionFromMemory(sessionId: string): ISession | null {
    return globalSessionManager.getSessionFromMemory(sessionId);
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
 * 创建新的 Session（确保不冲突）
 * @param sessionId 可选的 Session ID，如果不提供则自动生成
 * @returns 新创建的 Session 实例
 */
export async function createNewSession(sessionId?: string): Promise<ISession> {
    return await globalSessionManager.createNewSession(sessionId);
}

/**
 * 获取所有Session列表
 * @param limit 限制返回数量，默认20
 * @returns Session列表
 */
export async function getAllSessions(
    limit = 20
): Promise<Array<{ id: string; name?: string; createdAt?: string; updatedAt?: string }>> {
    return await globalSessionManager.getAllSessions(limit);
}

/**
 * 生成唯一的Session ID
 * @returns 新的Session ID
 */
export function generateSessionId(): string {
    return globalSessionManager.generateSessionId();
}
