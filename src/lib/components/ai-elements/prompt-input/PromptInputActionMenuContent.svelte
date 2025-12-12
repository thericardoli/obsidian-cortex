<script lang="ts">
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import { cn } from '$lib/utils';

    interface Props {
        class?: string;
        children?: import('svelte').Snippet;
    }

    let { class: className, children, ...props }: Props = $props();
</script>

<DropdownMenu.Content align="start" class={cn(className)} {...props}>
    {#if children}
        {@render children()}
    {/if}
</DropdownMenu.Content>
