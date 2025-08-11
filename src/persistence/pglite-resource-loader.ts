// 使用绝对路径导入二进制文件（绕过 package.json exports 限制）
import wasmBin from '../../node_modules/@electric-sql/pglite/dist/pglite.wasm';
import fsDataBin from '../../node_modules/@electric-sql/pglite/dist/pglite.data';
import { createLogger } from '../utils/logger';

/**
 * PGlite 资源加载器
 * 使用打包时内联的二进制资源，避免运行时路径解析问题
 */
export class PGliteResourceLoader {
	private static logger = createLogger('persistence');

	/**
	 * 从打包的二进制资源加载 PGlite 所需的 WASM 模块和文件系统包
	 * @returns Promise 包含 wasmModule 和 fsBundle，如果加载失败则返回 null
	 */
	static async loadResources(): Promise<{
		wasmModule: WebAssembly.Module;
		fsBundle: Blob;
	} | null> {
		try {
			this.logger.info('Loading PGlite resources from bundled binaries...');

			// esbuild 的 'binary' loader 可能返回 ArrayBuffer 或 Uint8Array
			const toArrayBuffer = (x: ArrayBuffer | Uint8Array): ArrayBuffer => {
				if (x instanceof ArrayBuffer) {
					return x;
				}
				if (x.buffer instanceof ArrayBuffer) {
					return x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength);
				}
				// 最后的兜底方案
				const uint8Array = new Uint8Array(x as ArrayBuffer | Uint8Array);
				return uint8Array.buffer.slice(
					uint8Array.byteOffset,
					uint8Array.byteOffset + uint8Array.byteLength
				);
			};

			const wasmBytes = toArrayBuffer(wasmBin as ArrayBuffer | Uint8Array);
			const fsBytes = toArrayBuffer(fsDataBin as ArrayBuffer | Uint8Array);

			// 编译 WASM 模块
			const wasmModule = await WebAssembly.compile(wasmBytes);

			// 创建文件系统包 Blob
			const fsBundle = new Blob([fsBytes]);

			this.logger.info('✅ PGlite assets loaded from bundled binaries', {
				wasm: wasmBytes.byteLength,
				data: fsBytes.byteLength,
			});

			return { wasmModule, fsBundle };
		} catch (error) {
			this.logger.error('❌ Failed to import PGlite binaries from bundle:', error);
			return null;
		}
	}
}
