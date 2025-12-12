<script lang="ts">
    import { CollapsibleContent } from '$lib/components/ui/collapsible/index.js';
    import { cn } from '$lib/utils';

    import type { Snippet } from 'svelte';

    interface ChainOfThoughtContentProps {
        children: Snippet;
        class?: string;
    }

    let { children, class: className }: ChainOfThoughtContentProps = $props();
</script>

<CollapsibleContent
    class={cn(
        'mt-2 space-y-3',
        'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in outline-none',
        className
    )}
>
    {@render children()}
</CollapsibleContent>
