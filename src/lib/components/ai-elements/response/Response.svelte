<script lang="ts">
    import { Streamdown, type StreamdownProps } from 'svelte-streamdown';

    import { cn } from '$lib/utils';

    type Props = StreamdownProps & {
        class?: string;
        isDarkMode?: boolean;
    };

    let { class: className, isDarkMode = false, ...restProps }: Props = $props();
</script>

<Streamdown
    class={cn('size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}
    shikiTheme={isDarkMode ? 'github-dark-default' : 'github-light-default'}
    baseTheme="shadcn"
    {...restProps}
/>
