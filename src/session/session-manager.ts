import type { ISession, SessionOptions } from '../types/session';
import { MemorySession } from './memory-session';
import { EventEmitter } from 'events';

/**
 * Session 管理器
 * 
 * 负责创建、管理和销毁 Session 实例
 */
export class SessionManager extends EventEmitter {
    private sessions: Map<string, ISession> = new Map();
    private defaultOptions: Partial<SessionOptions> = {};

    constructor(defaultOptions?: Partial<SessionOptions>) {
        super();
        if (defaultOptions) {
            this.defaultOptions = { ...this.defaultOptions, ...defaultOptions };
        }
    }

    /**
     * 创建新的 Session
     */
    public createSession(sessionId?: string, options?: Partial<SessionOptions>): ISession {
        const id = sessionId || this.generateSessionId();
        
        if (this.sessions.has(id)) {
            throw new Error(`Session with id ${id} already exists`);
        }

        const sessionOptions: SessionOptions = {
            sessionId: id,
            ...this.defaultOptions,
            ...options
        };

        const session = new MemorySession(sessionOptions);
        
        // 监听 session 事件
        session.on('error', (error) => {
            this.emit('sessionError', { sessionId: id, error });
        });

        session.on('itemAdded', (items) => {
            this.emit('sessionItemAdded', { sessionId: id, items });
        });

        session.on('sessionCleared', () => {
            this.emit('sessionCleared', { sessionId: id });
        });

        this.sessions.set(id, session);
        this.emit('sessionCreated', { sessionId: id });

        return session;
    }

    /**
     * 获取现有的 Session
     */
    public getSession(sessionId: string): ISession | null {
        return this.sessions.get(sessionId) || null;
    }

    /**
     * 删除 Session
     */
    public async deleteSession(sessionId: string): Promise<boolean> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        try {
            await session.dispose();
            this.sessions.delete(sessionId);
            this.emit('sessionDeleted', { sessionId });
            return true;
        } catch (error) {
            this.emit('sessionError', { sessionId, error });
            throw error;
        }
    }

    /**
     * 获取所有 Session ID
     */
    public getSessionIds(): string[] {
        return Array.from(this.sessions.keys());
    }

    /**
     * 获取 Session 数量
     */
    public getSessionCount(): number {
        return this.sessions.size;
    }

    /**
     * 清空所有 Sessions
     */
    public async clearAllSessions(): Promise<void> {
        const sessionIds = this.getSessionIds();
        
        for (const sessionId of sessionIds) {
            try {
                await this.deleteSession(sessionId);
            } catch (error) {
                console.error(`Failed to delete session ${sessionId}:`, error);
            }
        }
    }

    /**
     * 生成唯一的 Session ID
     */
    private generateSessionId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `session_${timestamp}_${random}`;
    }

    /**
     * 释放所有资源
     */
    public async dispose(): Promise<void> {
        await this.clearAllSessions();
        this.removeAllListeners();
    }
}

/**
 * 全局 Session 管理器实例
 */
export const globalSessionManager = new SessionManager();
