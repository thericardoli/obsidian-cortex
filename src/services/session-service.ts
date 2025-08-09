import { SessionManager } from "../session/session-manager";
import type { PersistenceManager } from "../persistence/persistence-manager";

export interface SessionServiceApi {
    createNew(): Promise<import("../types/session").ISession>;
    get(id: string): Promise<import("../types/session").ISession | null>;
    list(limit?: number): Promise<Array<{ id: string; name?: string }>>;
    delete(id: string): Promise<boolean>;
    disposeAll(): Promise<void>;
}

export class SessionService implements SessionServiceApi {
    private manager: SessionManager;

    constructor(persistence?: PersistenceManager | null) {
        this.manager = new SessionManager({}, persistence || undefined);
    }

    setPersistence(persistence: PersistenceManager) {
        this.manager.setPersistenceManager(persistence);
    }

    async createNew() {
        return this.manager.createNewSession();
    }

    async get(id: string) {
        return this.manager.getSession(id);
    }

    async list(limit = 20) {
        const rows = await this.manager.getAllSessions(limit);
        return rows.map((r) => ({ id: r.id, name: r.name }));
    }

    async delete(id: string) {
        return this.manager.deleteSession(id);
    }

    async disposeAll() {
        await this.manager.dispose();
    }
}

