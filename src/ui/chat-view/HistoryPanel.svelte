<script lang="ts">
    import { ChevronLeft, ChevronRight, Trash2, X } from '@lucide/svelte';
    import { cn } from '$lib/utils';
    import type { ChatSessionRecord } from '../../core/persistence/database';

    interface Props {
        isOpen: boolean;
        sessions: ChatSessionRecord[];
        activeSessionId: string;
        page: number;
        totalPages: number;
        totalCount: number;
        formatUpdatedAt: (value: number) => string;
        onClose?: () => void;
        onSelect?: (sessionId: string) => void;
        onDelete?: (sessionId: string) => void;
        onPrev?: () => void;
        onNext?: () => void;
    }

    let {
        isOpen,
        sessions,
        activeSessionId,
        page,
        totalPages,
        totalCount,
        formatUpdatedAt,
        onClose,
        onSelect,
        onDelete,
        onPrev,
        onNext,
    }: Props = $props();
</script>

{#if isOpen}
    <div
        class="bg-background/75 absolute inset-0 z-20 flex items-center justify-center px-4 py-6 backdrop-blur"
    >
        <div class="bg-card/95 w-full max-w-2xl rounded-2xl border shadow-2xl">
            <div class="flex items-center justify-between border-b px-5 py-3">
                <div>
                    <div class="text-muted-foreground text-xs tracking-wide uppercase">History</div>
                    <div class="text-foreground text-base font-semibold">Recent sessions</div>
                </div>
                <button
                    class="hover:bg-muted inline-flex h-8 w-8 items-center justify-center rounded-lg transition"
                    title="Close history"
                    onclick={onClose}
                >
                    <X class="h-4 w-4" />
                </button>
            </div>

            <div class="max-h-[60vh] space-y-2 overflow-y-auto px-5 py-3">
                {#if sessions.length === 0}
                    <div
                        class="text-muted-foreground flex h-28 items-center justify-center text-sm"
                    >
                        暂无历史会话
                    </div>
                {:else}
                    {#each sessions as history (history.id)}
                        <div
                            class={cn(
                                'flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 transition-colors',
                                activeSessionId === history.id
                                    ? 'border-primary bg-primary/10 shadow-sm'
                                    : 'border-border/60 hover:border-border hover:bg-muted/70'
                            )}
                        >
                            <button class="flex-1 text-left" onclick={() => onSelect?.(history.id)}>
                                <div class="flex items-center justify-between gap-2">
                                    <div class="truncate text-sm font-semibold">
                                        {history.title || '未命名会话'}
                                    </div>
                                    <span class="text-muted-foreground text-[11px]">
                                        {formatUpdatedAt(history.updatedAt)}
                                    </span>
                                </div>
                                <div class="text-muted-foreground mt-0.5 text-xs">
                                    Agent: {history.agentId || '未指定'}
                                </div>
                            </button>
                            <button
                                class="text-muted-foreground hover:text-destructive inline-flex h-9 w-9 items-center justify-center rounded-lg transition"
                                onclick={() => onDelete?.(history.id)}
                                title="删除会话"
                            >
                                <Trash2 class="h-4 w-4" />
                            </button>
                        </div>
                    {/each}
                {/if}
            </div>

            <div class="border-t px-5 py-3">
                <div class="flex items-center justify-between">
                    <div
                        class="text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]"
                    >
                        <span>Page {page} / {totalPages}</span>
                        <span class="text-muted-foreground/70">•</span>
                        <span>{totalCount} total</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button
                            class="border-border/70 hover:border-border hover:bg-muted/60 bg-card inline-flex h-9 w-9 items-center justify-center rounded-xl border transition disabled:opacity-60"
                            onclick={onPrev}
                            disabled={page <= 1}
                        >
                            <ChevronLeft class="h-4 w-4" />
                        </button>
                        <button
                            class="border-border/70 hover:border-border hover:bg-muted/60 bg-card inline-flex h-9 w-9 items-center justify-center rounded-xl border transition disabled:opacity-60"
                            onclick={onNext}
                            disabled={page >= totalPages}
                        >
                            <ChevronRight class="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
