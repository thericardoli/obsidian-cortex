<script lang="ts">
    import { Bot } from '@lucide/svelte';
</script>

<div class="text-muted-foreground flex h-full flex-col items-center justify-center gap-3">
    <div class="bg-muted/50 flex h-16 w-16 items-center justify-center rounded-full">
        <Bot class="h-8 w-8" strokeWidth={1.5} />
    </div>
    <div class="text-center">
        <div class="text-lg font-semibold">No agents configured yet</div>
        <p class="mt-1 text-sm">Click "New" on the left to create your first agent</p>
    </div>
</div>
