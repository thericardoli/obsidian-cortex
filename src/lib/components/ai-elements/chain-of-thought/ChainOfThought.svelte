<script lang="ts">
    import { Collapsible } from '$lib/components/ui/collapsible/index.js';
    import { cn } from '$lib/utils';

    import {
        ChainOfThoughtContext,
        setChainOfThoughtContext,
    } from './chain-of-thought-context.svelte.js';

    import type { Snippet } from 'svelte';
    import type { HTMLAttributes } from 'svelte/elements';

    interface ChainOfThoughtProps extends HTMLAttributes<HTMLDivElement> {
        open?: boolean;
        defaultOpen?: boolean;
        onOpenChange?: (open: boolean) => void;
        children: Snippet;
        class?: string;
    }

    let {
        open = $bindable(undefined),
        defaultOpen = false,
        onOpenChange,
        children,
        class: className,
        ...restProps
    }: ChainOfThoughtProps = $props();

    // Create context instance with proper controllable state
    // Use getters to ensure reactive updates of props in the context
    const context = new ChainOfThoughtContext({
        get isOpen() {
            return open !== undefined ? open : defaultOpen;
        },
        get onOpenChange() {
            return onOpenChange;
        },
    });

    // Handle controlled mode synchronization
    $effect(() => {
        if (open !== undefined) {
            context.isOpen = open;
        }
    });

    // Set the context for child components
    setChainOfThoughtContext(context);
</script>

<Collapsible open={context.isOpen} onOpenChange={context.setIsOpen}>
    <div class={cn('not-prose max-w-prose space-y-4', className)} {...restProps}>
        {@render children()}
    </div>
</Collapsible>
