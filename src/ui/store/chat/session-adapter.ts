import type { AgentItem, UserMessageItem, AssistantMessageItem } from '../../../types/session';
import type { ChatMessage } from '../chat-store';

const isUser = (x: AgentItem): x is UserMessageItem => (x as { role?: unknown }).role === 'user';
const isAssistant = (x: AgentItem): x is AssistantMessageItem =>
	(x as { role?: unknown }).role === 'assistant';

export function mapSessionItemsToChatMessages(items: AgentItem[]): ChatMessage[] {
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
