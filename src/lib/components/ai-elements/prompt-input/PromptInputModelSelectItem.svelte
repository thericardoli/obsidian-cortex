<script lang="ts">
    import * as Select from '$lib/components/ui/select/index.js';
    import { cn } from '$lib/utils';

    interface Props {
        class?: string;
        value: string;
        disabled?: boolean;
        children?: import('svelte').Snippet;
    }

    let { class: className, value, children, ...props }: Props = $props();
</script>

<Select.Item class={cn(className)} {value} {...props}>
    {#if children}
        {@render children()}
    {/if}
</Select.Item>
