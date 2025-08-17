import type { AgentInputItem } from '@openai/agents';
import type { UserMessageItem, AssistantMessageItem } from '../../types/session';
import type { ChatMessage } from '../chat-store';

const isUser = (x: AgentInputItem): x is UserMessageItem => (x as { role?: unknown }).role === 'user';
const isAssistant = (x: AgentInputItem): x is AssistantMessageItem =>
	(x as { role?: unknown }).role === 'assistant';

export function mapAgentInputItemsToChatMessages(items: AgentInputItem[]): ChatMessage[] {
	return items
		.filter((it): it is UserMessageItem | AssistantMessageItem => isUser(it) || isAssistant(it))
		.map((it) => ({
			id: crypto.randomUUID(),
			role: it.role,
			content:
				typeof it.content === 'string'
					? it.content
					: Array.isArray(it.content)
						? (it.content as Array<{ text?: string }>).map((p) => p.text ?? '').join('')
						: '',
			timestamp: Date.now(),
		}));
}
