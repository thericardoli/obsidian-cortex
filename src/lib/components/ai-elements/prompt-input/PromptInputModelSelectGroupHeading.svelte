<script lang="ts">
    import { cn } from '$lib/utils';
    import * as Select from '$lib/components/ui/select/index.js';

    interface Props {
        class?: string;
        children?: import('svelte').Snippet;
    }

    let { class: className, children, ...props }: Props = $props();
</script>

<Select.GroupHeading 
    class={cn(
        'px-3 py-2 text-sm font-semibold text-foreground text-center',
        className
    )} 
    {...props}
>
    {#if children}
        {@render children()}
    {/if}
</Select.GroupHeading>
