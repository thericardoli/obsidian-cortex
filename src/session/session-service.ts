import { SessionManager } from './session-manager';
import type { ISessionRepository } from '../persistence/repositories/contracts';

export interface SessionServiceApi {
	createNew(): Promise<import('../types/session').ISession>;
	get(id: string): Promise<import('../types/session').ISession | null>;
	list(limit?: number): Promise<Array<{ id: string; name?: string }>>;
	delete(id: string): Promise<boolean>;
	disposeAll(): Promise<void>;
}

export class SessionService implements SessionServiceApi {
	private manager: SessionManager;
	constructor(repository?: ISessionRepository | null) {
		this.manager = new SessionManager({}, repository || undefined);
	}
	setRepository(repository: ISessionRepository) {
		this.manager.setRepository(repository);
	}
	async createNew() {
		return this.manager.createNewSession();
	}
	async get(id: string) {
		return this.manager.getSession(id);
	}
	async list(limit: number) {
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
