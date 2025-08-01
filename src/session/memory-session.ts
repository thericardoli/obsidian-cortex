import { ISession, ConversationItem, SessionOptions } from '../types/session';
import { EventEmitter } from 'events';

/**
 * 内存中的 Session 实现
 */
export class MemorySession extends EventEmitter implements ISession {
    public readonly sessionId: string;
    private items: ConversationItem[] = [];

    constructor(options: SessionOptions) {
        super();
        this.sessionId = options.sessionId;
    }

    public get itemCount(): number {
        return this.items.length;
    }

    /**
     * 获取对话历史项目
     */
    public async getItems(limit?: number): Promise<ConversationItem[]> {
        try {
            let result = [...this.items];
            
            if (limit && limit > 0) {
                // 返回最近的 limit 个项目
                result = result.slice(-limit);
            }
            
            return result;
        } catch (error) {
            this.emit('error', new Error(`Failed to get items: ${error}`));
            throw error;
        }
    }

    /**
     * 添加新的对话项目
     */
    public async addItems(items: ConversationItem[]): Promise<void> {
        try {
            if (!Array.isArray(items) || items.length === 0) {
                return;
            }

            // 验证项目格式
            for (const item of items) {
                this.validateItem(item);
            }

            // 添加项目
            this.items.push(...items);

            this.emit('itemAdded', items);
        } catch (error) {
            this.emit('error', new Error(`Failed to add items: ${error}`));
            throw error;
        }
    }

    /**
     * 移除并返回最近的一个项目
     */
    public async popItem(): Promise<ConversationItem | null> {
        try {
            const item = this.items.pop();
            if (item) {
                this.emit('itemRemoved', item);
            }
            return item || null;
        } catch (error) {
            this.emit('error', new Error(`Failed to pop item: ${error}`));
            throw error;
        }
    }

    /**
     * 清空当前 session 的所有项目
     */
    public async clearSession(): Promise<void> {
        try {
            this.items = [];
            this.emit('sessionCleared');
        } catch (error) {
            this.emit('error', new Error(`Failed to clear session: ${error}`));
            throw error;
        }
    }

    /**
     * 获取 session 的统计信息
     */
    public async getStats(): Promise<{
        itemCount: number;
        totalTokens?: number;
        firstItemTimestamp?: number;
        lastItemTimestamp?: number;
    }> {
        try {
            const stats = {
                itemCount: this.items.length,
                totalTokens: this.estimateTokens(),
                firstItemTimestamp: this.items.length > 0 ? this.items[0].timestamp : undefined,
                lastItemTimestamp: this.items.length > 0 ? this.items[this.items.length - 1].timestamp : undefined,
            };

            return stats;
        } catch (error) {
            this.emit('error', new Error(`Failed to get stats: ${error}`));
            throw error;
        }
    }

    /**
     * 释放资源
     */
    public async dispose(): Promise<void> {
        try {
            this.items = [];
            this.removeAllListeners();
        } catch (error) {
            this.emit('error', new Error(`Failed to dispose session: ${error}`));
            throw error;
        }
    }

    /**
     * 验证对话项目的格式
     */
    private validateItem(item: ConversationItem): void {
        if (!item.id || typeof item.id !== 'string') {
            throw new Error('Item must have a valid id');
        }
        
        if (!item.role || !['user', 'assistant', 'system', 'tool'].includes(item.role)) {
            throw new Error('Item must have a valid role');
        }
        
        if (typeof item.content !== 'string') {
            throw new Error('Item content must be a string');
        }
        
        if (!item.timestamp || typeof item.timestamp !== 'number') {
            throw new Error('Item must have a valid timestamp');
        }
    }

    /**
     * 估算总令牌数（简单的字符数估算）
     */
    private estimateTokens(): number {
        return this.items.reduce((total, item) => {
            // 简单估算：平均每4个字符约等于1个token
            return total + Math.ceil(item.content.length / 4);
        }, 0);
    }

    /**
     * 添加单个项目的便捷方法
     */
    public async addItem(item: ConversationItem): Promise<void> {
        await this.addItems([item]);
    }

    /**
     * 根据角色筛选项目
     */
    public async getItemsByRole(role: ConversationItem['role'], limit?: number): Promise<ConversationItem[]> {
        try {
            let filtered = this.items.filter(item => item.role === role);
            
            if (limit && limit > 0) {
                filtered = filtered.slice(-limit);
            }
            
            return filtered;
        } catch (error) {
            this.emit('error', new Error(`Failed to get items by role: ${error}`));
            throw error;
        }
    }

    /**
     * 获取指定时间范围内的项目
     */
    public async getItemsInTimeRange(startTime: number, endTime: number): Promise<ConversationItem[]> {
        try {
            return this.items.filter(item => 
                item.timestamp >= startTime && item.timestamp <= endTime
            );
        } catch (error) {
            this.emit('error', new Error(`Failed to get items in time range: ${error}`));
            throw error;
        }
    }
}
