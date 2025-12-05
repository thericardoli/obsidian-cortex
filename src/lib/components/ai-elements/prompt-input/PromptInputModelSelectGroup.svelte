<script lang="ts">
    import { cn } from '$lib/utils';
    import * as Select from '$lib/components/ui/select/index.js';

    interface Props {
        class?: string;
        children?: import('svelte').Snippet;
    }

    let { class: className, children, ...props }: Props = $props();
</script>

<Select.Group
    class={cn('border-border bg-muted/30 mx-1 my-1 rounded-lg border py-1', className)}
    {...props}
>
    {#if children}
        {@render children()}
    {/if}
</Select.Group>
