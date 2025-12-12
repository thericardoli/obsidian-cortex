import { type Readable, readable } from 'svelte/store';

import { listenSettingsUpdated } from './settings-events';

import type { CortexSettings } from './settings';
import type { App } from 'obsidian';

export interface SettingsStoreValue {
    settings: CortexSettings;
    revision: number;
}

export function createSettingsStore(
    app: App,
    getCurrentSettings: () => CortexSettings
): Readable<SettingsStoreValue> {
    return readable<SettingsStoreValue>({ settings: getCurrentSettings(), revision: 0 }, (set) => {
        let revision = 0;
        return listenSettingsUpdated(app, (settings) => {
            revision += 1;
            set({ settings, revision });
        });
    });
}
