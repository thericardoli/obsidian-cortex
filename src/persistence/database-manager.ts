import { PGlite } from "@electric-sql/pglite";
import type { Plugin } from "obsidian";

export interface DatabaseOptions {
	/**
	 * 预加载的 WebAssembly 模块
	 */
	wasmModule?: WebAssembly.Module;
	/**
	 * 预加载的文件系统包
	 */
	fsBundle?: Blob | File;
}

const CURRENT_SCHEMA_VERSION = 1;

export class DatabaseManager {
	private db: PGlite | null = null;
	private initialized = false;

	constructor(private plugin: Plugin, private opts: DatabaseOptions = {}) {}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			// 使用 IndexedDB 存储
			const dataDir = 'idb://cortex-db';
			console.log('Using IndexedDB storage for PGlite:', dataDir);

			// 优先使用预加载的 WASM 模块和文件系统包
			if (this.opts.wasmModule && this.opts.fsBundle) {
				console.log('Initializing PGlite with preloaded WASM module and fsBundle');
				this.db = await PGlite.create({
					wasmModule: this.opts.wasmModule,
					fsBundle: this.opts.fsBundle,
					dataDir: dataDir
				});
			} else {
				// 使用 IndexedDB 存储，避免文件系统路径问题
				console.log('Initializing PGlite with IndexedDB storage:', dataDir);
				this.db = await PGlite.create(dataDir);
			}

			await this.runMigrations();
			this.initialized = true;
		} catch (error) {
			console.error('Failed to initialize PGlite database:', error);
			console.error('This is likely due to import.meta.url issues in Electron environment.');
			console.error('Please provide preloaded wasmModule and fsBundle in DatabaseOptions.');
			throw new Error('Failed to initialize PGlite database. Use preloaded resources to avoid import.meta.url issues.');
		}
	}

	private async runMigrations(): Promise<void> {
		if (!this.db) throw new Error("Database not initialized");

		// 迁移表
		await this.db.exec(`
			CREATE TABLE IF NOT EXISTS migrations (
				version INTEGER PRIMARY KEY,
				name TEXT NOT NULL,
				executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
		`);

		const { rows } = await this.db
			.sql`SELECT MAX(version) as v FROM migrations`;
		const current = ((rows?.[0] as Record<string, unknown>)?.v ??
			0) as number;

		if (current < 1) {
			// 执行 V0 schema
			await this.db.exec(SCHEMA_SQL);
			await this.db.sql`
				INSERT INTO migrations (version, name)
				VALUES (${CURRENT_SCHEMA_VERSION}, ${"V0 schema (agents, sessions)"})
			`;
		}
	}

	getDatabase(): PGlite {
		if (!this.db) throw new Error("Database not initialized");
		return this.db;
	}

	isInitialized(): boolean {
		return this.initialized;
	}

	async close(): Promise<void> {
		if (this.db) {
			await this.db.close();
			this.db = null;
			this.initialized = false;
		}
	}
}

// 两表 Schema（无参数，适合 exec）
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS agents (
	id                UUID PRIMARY KEY,
	name              VARCHAR(100) NOT NULL CHECK (name <> ''),
	instructions      TEXT NOT NULL,

	model_provider    TEXT NOT NULL,   -- modelConfig.provider
	model             TEXT NOT NULL,   -- modelConfig.model
	model_settings    JSONB,           -- modelConfig.settings (JSONB)

	tools             JSONB NOT NULL DEFAULT '[]',
	input_guardrails  JSONB NOT NULL DEFAULT '[]',
	output_guardrails JSONB NOT NULL DEFAULT '[]',
	mcp_servers       JSONB NOT NULL DEFAULT '[]',

	metadata          JSONB NOT NULL DEFAULT '{}',
	created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_updated
	ON agents(updated_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
	id            UUID PRIMARY KEY,
	name          TEXT,
	items         JSONB NOT NULL DEFAULT '[]',  -- AgentItem[]
	metadata      JSONB NOT NULL DEFAULT '{}',
	created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_updated
	ON sessions(updated_at DESC);
`;
