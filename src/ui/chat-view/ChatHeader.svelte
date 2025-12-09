<script lang="ts">
    import { Clock3, Plus } from '@lucide/svelte';

    interface Props {
        title: string;
        isLoading?: boolean;
        onCreate?: () => void;
        onOpenHistory?: () => void;
    }

    let { title, isLoading = false, onCreate, onOpenHistory }: Props = $props();
</script>

<div
    class="border-border/70 sticky top-0 z-20 flex items-center justify-between border-b bg-[var(--background-primary)] px-4 py-3"
>
    <div class="min-w-0">
        <div class="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            Chat Session
        </div>
        <div class="text-foreground truncate text-lg font-semibold">{title}</div>
    </div>
    <div class="flex items-center gap-2">
        <button
            class="border-border/80 hover:border-border hover:bg-muted/60 bg-card inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm shadow-sm transition"
            title="新建会话"
            onclick={onCreate}
            disabled={isLoading}
        >
            <Plus class="h-4 w-4" />
        </button>
        <button
            class="border-border/80 hover:border-border hover:bg-muted/60 bg-card inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm shadow-sm transition"
            title="查看历史"
            onclick={onOpenHistory}
            disabled={isLoading}
        >
            <Clock3 class="h-4 w-4" />
        </button>
    </div>
</div>
