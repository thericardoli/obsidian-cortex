import { type ChatSessionRecord, cortexDb, type SessionItemRecord } from './database';

import type { AgentInputItem, Session } from '@openai/agents-core';

const DEFAULT_SESSION_TITLE = 'New session';

async function touchSessionMetadata(
    sessionId: string,
    patch: Partial<ChatSessionRecord> = {}
): Promise<ChatSessionRecord> {
    const now = Date.now();
    const existing = await cortexDb.chatSessions.get(sessionId);
    const base: ChatSessionRecord = existing ?? {
        id: sessionId,
        agentId: patch.agentId || '',
        title: patch.title || DEFAULT_SESSION_TITLE,
        createdAt: now,
        updatedAt: now,
    };

    const record: ChatSessionRecord = {
        ...base,
        ...patch,
        createdAt: base.createdAt,
        updatedAt: now,
    };

    await cortexDb.chatSessions.put(record);
    return record;
}

export async function upsertSessionRecord(
    sessionId: string,
    agentId?: string,
    title?: string
): Promise<ChatSessionRecord> {
    const patch: Partial<ChatSessionRecord> = {};
    if (agentId !== undefined) patch.agentId = agentId;
    if (title !== undefined) patch.title = title;
    return touchSessionMetadata(sessionId, patch);
}

export async function listSessionRecords(limit = 50): Promise<ChatSessionRecord[]> {
    return cortexDb.chatSessions.orderBy('updatedAt').reverse().limit(limit).toArray();
}

export async function deleteSessionRecord(sessionId: string): Promise<void> {
    await cortexDb.transaction('rw', [cortexDb.sessionItems, cortexDb.chatSessions], async () => {
        await cortexDb.sessionItems.where('sessionId').equals(sessionId).delete();
        await cortexDb.chatSessions.delete(sessionId);
    });
}

export async function getSessionItems(
    sessionId: string,
    limit?: number
): Promise<AgentInputItem[]> {
    const items = await cortexDb.sessionItems
        .where('sessionId')
        .equals(sessionId)
        .sortBy('createdAt');
    const scoped = limit ? items.slice(-limit) : items;
    return scoped.map((item) => item.item);
}

export class PersistentSession implements Session {
    constructor(private sessionId: string) {}

    private sanitize(item: AgentInputItem): AgentInputItem {
        try {
            return structuredClone(item);
        } catch {
            return JSON.parse(JSON.stringify(item)) as AgentInputItem;
        }
    }

    async getSessionId(): Promise<string> {
        return this.sessionId;
    }

    async getItems(limit?: number): Promise<AgentInputItem[]> {
        return getSessionItems(this.sessionId, limit);
    }

    async addItems(items: AgentInputItem[]): Promise<void> {
        if (!items.length) return;
        const baseTime = Date.now();
        const rows: SessionItemRecord[] = items.map((item, index) => ({
            sessionId: this.sessionId,
            item: this.sanitize(item),
            createdAt: baseTime + index,
        }));
        await cortexDb.sessionItems.bulkAdd(rows);
        await touchSessionMetadata(this.sessionId);
    }

    async popItem(): Promise<AgentInputItem | undefined> {
        const last = await cortexDb.sessionItems.where('sessionId').equals(this.sessionId).last();
        if (!last?.id) return undefined;
        await cortexDb.sessionItems.delete(last.id);
        await touchSessionMetadata(this.sessionId);
        return last.item;
    }

    async clearSession(): Promise<void> {
        await cortexDb.sessionItems.where('sessionId').equals(this.sessionId).delete();
        await touchSessionMetadata(this.sessionId);
    }
}
