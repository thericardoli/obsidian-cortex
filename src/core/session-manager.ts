/**
 * Session Manager - 管理会话历史的持久化存储
 *
 * Phase 1: 使用 SDK 内置的 MemorySession（内存存储）
 * Phase 2: 将实现 ObsidianSession（持久化到 plugin data）
 */

import { MemorySession } from '@openai/agents-core';
import type { Session } from '@openai/agents-core';

export type { Session };

/**
 * SessionManager 负责创建和管理多个会话实例
 */
export class SessionManager {
    private sessions = new Map<string, Session>();

    /**
     * 获取或创建一个 Session 实例
     * @param sessionId - 会话唯一标识符
     * @returns Session 实例
     */
    getOrCreate(sessionId: string): Session {
        if (!this.sessions.has(sessionId)) {
            // Phase 1: 使用 MemorySession（内存存储，程序重启后丢失）
            const session = new MemorySession({ sessionId });
            this.sessions.set(sessionId, session);
        }
        return this.sessions.get(sessionId)!;
    }

    /**
     * 检查是否存在指定的 Session
     */
    has(sessionId: string): boolean {
        return this.sessions.has(sessionId);
    }

    /**
     * 删除指定的 Session
     */
    async delete(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (session) {
            await session.clearSession();
            this.sessions.delete(sessionId);
        }
    }

    /**
     * 获取所有 Session ID 列表
     */
    listSessionIds(): string[] {
        return Array.from(this.sessions.keys());
    }

    /**
     * 清空所有 Sessions
     */
    async clearAll(): Promise<void> {
        for (const session of this.sessions.values()) {
            await session.clearSession();
        }
        this.sessions.clear();
    }
}

// 导出单例实例，方便全局使用
export const sessionManager = new SessionManager();
