export type EventMap = {
    providersUpdated: void;
    modelsUpdated: { providerId?: string } | void;
    agentsChanged: void;
    sessionsChanged: void;
};

export interface EventBus {
    on<K extends keyof EventMap>(evt: K, fn: (p: EventMap[K]) => void): () => void;
    emit<K extends keyof EventMap>(evt: K, payload?: EventMap[K]): void;
}

export class SimpleEventBus implements EventBus {
    // Store as unknown to avoid any; cast at call sites per event key
    private listeners = new Map<keyof EventMap, Set<unknown>>();

    on<K extends keyof EventMap>(evt: K, fn: (p: EventMap[K]) => void): () => void {
        const existing = this.listeners.get(evt) as Set<(p: EventMap[K]) => void> | undefined;
        const set: Set<(p: EventMap[K]) => void> = existing ?? new Set<(p: EventMap[K]) => void>();
        if (!existing) this.listeners.set(evt, set as unknown as Set<unknown>);
        set.add(fn);
        return () => {
            set.delete(fn);
        };
    }

    emit<K extends keyof EventMap>(evt: K, payload?: EventMap[K]): void {
        const set = this.listeners.get(evt) as Set<(p: EventMap[K]) => void> | undefined;
        if (!set) return;
        for (const fn of set) {
            try {
                fn(payload as EventMap[K]);
            } catch (e) {
                console.warn(`EventBus handler error for ${String(evt)}`, e);
            }
        }
    }
}
