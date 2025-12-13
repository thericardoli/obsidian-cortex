import Dexie, { type Table } from 'dexie';

import type { AgentConfig } from '../../types/agent';
import type { AgentInputItem } from '@openai/agents-core';

export interface AgentConfigRecord extends AgentConfig {
    createdAt: number;
    updatedAt: number;
}

export interface ChatSessionRecord {
    id: string;
    agentId: string;
    title: string;
    createdAt: number;
    updatedAt: number;
}

export interface SessionItemRecord {
    id?: number;
    sessionId: string;
    createdAt: number;
    item: AgentInputItem;
}

class CortexDatabase extends Dexie {
    agentConfigs!: Table<AgentConfigRecord, string>;
    chatSessions!: Table<ChatSessionRecord, string>;
    sessionItems!: Table<SessionItemRecord, number>;

    constructor() {
        super('cortex-db');
        this.version(1).stores({
            agentConfigs: '&id, name, enabled, updatedAt',
            chatSessions: '&id, agentId, updatedAt, createdAt',
            sessionItems: '++id, sessionId, createdAt',
        });
    }
}

export const cortexDb = new CortexDatabase();
