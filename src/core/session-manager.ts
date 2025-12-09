import type { Session } from '@openai/agents-core';
import { cortexDb } from './persistence/database';
import {
    PersistentSession,
    deleteSessionRecord,
    getSessionItems,
    listSessionRecords,
    upsertSessionRecord,
} from './persistence/session-store';
import type { ChatSessionRecord } from './persistence/database';

export type { Session };

/**
 * SessionManager 负责创建和管理多个会话实例（IndexedDB 持久化）
 */
export class SessionManager {
    private sessions = new Map<string, Session>();

    async getOrCreate(sessionId: string, agentId?: string, title?: string): Promise<Session> {
        await upsertSessionRecord(sessionId, agentId, title);
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, new PersistentSession(sessionId));
        }
        return this.sessions.get(sessionId)!;
    }

    async createNew(
        agentId: string,
        title?: string
    ): Promise<{
        sessionId: string;
        record: ChatSessionRecord;
        session: Session;
    }> {
        const sessionId = crypto.randomUUID();
        const record = await upsertSessionRecord(sessionId, agentId, title);
        const session = new PersistentSession(sessionId);
        this.sessions.set(sessionId, session);
        return { sessionId, record, session };
    }

    async loadHistory(sessionId: string): Promise<Awaited<ReturnType<Session['getItems']>>> {
        return getSessionItems(sessionId);
    }

    has(sessionId: string): boolean {
        return this.sessions.has(sessionId);
    }

    async delete(sessionId: string): Promise<void> {
        this.sessions.delete(sessionId);
        await deleteSessionRecord(sessionId);
    }

    async list(): Promise<ChatSessionRecord[]> {
        return listSessionRecords();
    }

    async clearAll(): Promise<void> {
        await cortexDb.sessionItems.clear();
        await cortexDb.chatSessions.clear();
        this.sessions.clear();
    }
}

// 导出单例实例，方便全局使用
export const sessionManager = new SessionManager();
