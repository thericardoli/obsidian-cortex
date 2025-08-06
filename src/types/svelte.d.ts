declare module "*.svelte" {
    import type { Component } from "svelte";
    const comp: Component<Record<string, unknown>>;
    export default comp;
}
