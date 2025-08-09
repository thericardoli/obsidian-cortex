import type { Tool } from "@openai/agents";
import { webSearchTool, fileSearchTool, codeInterpreterTool, imageGenerationTool } from "@openai/agents-openai";

export type HostedToolName = "web_search" | "file_search" | "code_interpreter" | "image_generation";

export interface HostedToolProviderData {
    // Arbitrary config surface passed through to the hosted tool factories
    // Use index signature with unknown to avoid any
    [key: string]: unknown;
}

export interface FileSearchProviderData extends HostedToolProviderData {
    vectorStoreIds: string[];
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((x) => typeof x === "string");
}

export function createHostedTool(name: HostedToolName, providerData?: HostedToolProviderData): Tool | null {
    switch (name) {
        case "web_search":
            return webSearchTool(providerData ?? {});
        case "code_interpreter":
            return codeInterpreterTool(providerData ?? {});
        case "image_generation":
            return imageGenerationTool(providerData ?? {});
        case "file_search": {
            const ids = (providerData as Partial<FileSearchProviderData> | undefined)?.vectorStoreIds;
            if (!isStringArray(ids)) {
                console.warn("file_search tool requires providerData.vectorStoreIds: string[]");
                return null;
            }
            return fileSearchTool(ids, providerData ?? {});
        }
        default:
            {
                // Exhaustiveness check (should be unreachable if all HostedToolName variants are handled above)
                const _never: never = name as never;
                console.warn("Unknown hosted tool:", _never);
                return null;
            }
    }
}

