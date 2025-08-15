export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogScope = 'persistence' | 'providers' | 'ui' | 'session' | 'agent' | 'main' | 'tool';

export interface Logger {
	debug(message: string, ...args: unknown[]): void;
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
}

export class ScopedLogger implements Logger {
	constructor(
		private scope: LogScope,
		private minLevel: LogLevel = 'info'
	) {}

	private shouldLog(level: LogLevel): boolean {
		const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
		const currentIndex = levels.indexOf(level);
		const minIndex = levels.indexOf(this.minLevel);
		return currentIndex >= minIndex;
	}

	private formatMessage(level: LogLevel, message: string): string {
		return `[Cortex:${this.scope}:${level.toUpperCase()}] ${message}`;
	}

	debug(message: string, ...args: unknown[]): void {
		if (this.shouldLog('debug')) {
			console.debug(this.formatMessage('debug', message), ...args);
		}
	}

	info(message: string, ...args: unknown[]): void {
		if (this.shouldLog('info')) {
			console.log(this.formatMessage('info', message), ...args);
		}
	}

	warn(message: string, ...args: unknown[]): void {
		if (this.shouldLog('warn')) {
			console.warn(this.formatMessage('warn', message), ...args);
		}
	}

	error(message: string, ...args: unknown[]): void {
		if (this.shouldLog('error')) {
			console.error(this.formatMessage('error', message), ...args);
		}
	}
}

// Build-time injected constant (see esbuild.config.mjs). In dev -> 'debug', prod -> 'warn'.
// Declared here so TypeScript is aware; esbuild will replace occurrences.
declare const __CORTEX_DEFAULT_LOG_LEVEL__: LogLevel | undefined;

export function createLogger(scope: LogScope, minLevel?: LogLevel): Logger {
	const effective: LogLevel = minLevel ?? (__CORTEX_DEFAULT_LOG_LEVEL__ || 'info');
	return new ScopedLogger(scope, effective);
}
