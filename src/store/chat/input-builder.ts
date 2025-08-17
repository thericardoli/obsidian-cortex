import type { AgentInputItem } from '@openai/agents';
import type { ChatMessage } from '../chat-store';

// 将当前聊天消息（本地状态）转换为 AgentInputItem 数组（回退策略）
export function buildAgentInputFromState(messages: ChatMessage[]): AgentInputItem[] {
	return messages
		.filter((m) => !m.isStreaming)
		.map((m) => {
			if (m.role === 'user') {
				return {
					type: 'message',
					role: 'user',
					content: [{ type: 'input_text', text: m.content }],
				} as unknown as AgentInputItem;
			}
			return {
				type: 'message',
				role: 'assistant',
				status: 'completed',
				content: [{ type: 'output_text', text: m.content }],
			} as unknown as AgentInputItem;
		});
}

export function composeRunInput(opts: {
	sessionHistory: AgentInputItem[] | null;
	fallbackState: ChatMessage[];
}): AgentInputItem[] {
	const { sessionHistory, fallbackState } = opts;
	if (sessionHistory && sessionHistory.length > 0) return sessionHistory;
	return buildAgentInputFromState(fallbackState);
}
