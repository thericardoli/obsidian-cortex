<script lang="ts">
    import * as Select from '$lib/components/ui/select/index.js';
    import { cn } from '$lib/utils';

    interface Props {
        class?: string;
        children?: import('svelte').Snippet;
    }

    let { class: className, children, ...props }: Props = $props();
</script>

<Select.Content class={cn(className)} {...props}>
    {#if children}
        {@render children()}
    {/if}
</Select.Content>
