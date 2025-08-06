import { PGlite } from "@electric-sql/pglite";
import type { Plugin } from "obsidian";
import { FileSystemAdapter } from "obsidian";

export type PGliteBackend = "idb" | "file";

export interface DatabaseOptions {
	/** 'idb'（默认，推荐先用）或 'file'（桌面端 NodeFS） */
	backend?: PGliteBackend;
	/** backend='file'时的数据目录（可选，不填则使用默认路径） */
	fileDir?: string;
	/** backend='idb'时的库名（可选） */
	idbName?: string;
}

const CURRENT_SCHEMA_VERSION = 1;

export class DatabaseManager {
	private db: PGlite | null = null;
	private initialized = false;

	constructor(private plugin: Plugin, private opts: DatabaseOptions = {}) {}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		const backend = this.opts.backend ?? "idb";
		let connStr: string;

		if (backend === "file") {
			const adapter = this.plugin.app.vault.adapter;
			if (adapter instanceof FileSystemAdapter) {
				const basePath = (adapter as FileSystemAdapter).getBasePath();
				// 默认数据目录：<vault>/.obsidian/plugins/<plugin-id>/pglite
				const defaultDir = `${basePath}/${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}/pglite`;
				connStr = this.opts.fileDir ?? defaultDir;
			} else {
				// 非 NodeFS 环境下自动回退到 idb
				connStr = `idb://${
					this.opts.idbName ?? `${this.plugin.manifest.id}-pglite`
				}`;
			}
		} else {
			connStr = `idb://${
				this.opts.idbName ?? `${this.plugin.manifest.id}-pglite`
			}`;
		}

		this.db = await PGlite.create(connStr); // 推荐使用 create() 等待 ready
		await this.runMigrations();
		this.initialized = true;
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
