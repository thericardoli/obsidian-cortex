import { type CortexSettings, SETTINGS_UPDATED_EVENT } from './settings';

import type { App } from 'obsidian';

export function notifySettingsUpdated(app: App, settings: CortexSettings): void {
    // @ts-ignore - Custom event type not in Obsidian's type definitions
    app.workspace.trigger(SETTINGS_UPDATED_EVENT, settings);
}

export function listenSettingsUpdated(
    app: App,
    handler: (settings: CortexSettings) => void
): () => void {
    // @ts-ignore - Custom event type not in Obsidian's type definitions
    const ref = app.workspace.on(SETTINGS_UPDATED_EVENT, handler);
    return () => app.workspace.offref(ref);
}
