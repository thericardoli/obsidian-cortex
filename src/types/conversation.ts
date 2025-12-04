import type { UIMessage } from 'ai';

export interface Conversation {
    id: string;
    agentId: string;
    messages: UIMessage[];
    createdAt: string;
    updatedAt: string;
}
