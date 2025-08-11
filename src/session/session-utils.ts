/**
 * Session 便捷工具函数
 * 提供快速创建和管理 Session 的便捷方法
 */

// DEPRECATED MODULE
// 本文件将在后续版本移除：请改用 SessionService API。这里保留 shim 并输出警告一次。
// createSession/getSession 等函数仅在开发期辅助迁移。
import type { ISession } from '../types/session';
import { SessionManager } from './session-manager';
import { createLogger } from '../utils/logger';

// 使用 session scope 复用；消息内含 deprecated 前缀
const logger = createLogger('session');
let warned = false;
function warnOnce() {
	if (warned) return;
	warned = true;
	logger.warn(
		'session-utils 已废弃：请通过 SessionService 获取/管理会话。该 shim 将在后续版本移除。'
	);
}

// 临时独立实例（不与主 SessionService 共享）。仅供兼容，不保证持久化。
const deprecatedShimManager = new SessionManager();

/**
 * 创建新的 Session（使用智能缓存）
 * @param sessionId Session ID
 * @returns 新创建的 Session 实例
 */
export async function createSession(sessionId: string): Promise<ISession> {
	warnOnce();
	return await deprecatedShimManager.createSession(sessionId);
}

/**
 * 获取指定 ID 的 Session（异步版本，支持从数据库加载）
 * @param sessionId Session ID
 * @returns Session 实例，如果不存在则返回 null
 */
export async function getSession(sessionId: string): Promise<ISession | null> {
	warnOnce();
	return await deprecatedShimManager.getSession(sessionId);
}

/**
 * 获取指定 ID 的 Session（同步版本，仅从内存获取）
 * @param sessionId Session ID
 * @returns Session 实例，如果不存在则返回 null
 */
export function getSessionFromMemory(sessionId: string): ISession | null {
	warnOnce();
	return deprecatedShimManager.getSessionFromMemory(sessionId);
}

/**
 * 删除指定 ID 的 Session
 * @param sessionId Session ID
 * @returns 是否成功删除
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
	warnOnce();
	return await deprecatedShimManager.deleteSession(sessionId);
}

/**
 * 获取所有 Session ID
 * @returns Session ID 数组
 */
export function getAllSessionIds(): string[] {
	warnOnce();
	return deprecatedShimManager.getSessionIds();
}

/**
 * 获取 Session 数量
 * @returns Session 总数
 */
export function getSessionCount(): number {
	warnOnce();
	return deprecatedShimManager.getSessionCount();
}

/**
 * 清空所有 Sessions
 */
export async function clearAllSessions(): Promise<void> {
	warnOnce();
	return await deprecatedShimManager.clearAllSessions();
}

/**
 * 创建新的 Session（确保不冲突）
 * @param sessionId 可选的 Session ID，如果不提供则自动生成
 * @returns 新创建的 Session 实例
 */
export async function createNewSession(sessionId?: string): Promise<ISession> {
	warnOnce();
	return await deprecatedShimManager.createNewSession(sessionId);
}

/**
 * 获取所有Session列表
 * @param limit 限制返回数量，默认20
 * @returns Session列表
 */
export async function getAllSessions(
	limit = 20
): Promise<Array<{ id: string; name?: string; createdAt?: string; updatedAt?: string }>> {
	warnOnce();
	return await deprecatedShimManager.getAllSessions(limit);
}

/**
 * 生成唯一的Session ID
 * @returns 新的Session ID
 */
export function generateSessionId(): string {
	warnOnce();
	return deprecatedShimManager.generateSessionId();
}
