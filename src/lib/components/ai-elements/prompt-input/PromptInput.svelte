<script lang="ts">
    import { watch } from 'runed';
    import { onMount } from 'svelte';

    import { cn } from '$lib/utils';

    import {
        AttachmentsContext,
        type PromptInputMessage,
        setAttachmentsContext,
    } from './attachments-context.svelte.js';

    interface Props {
        class?: string;
        accept?: string;
        multiple?: boolean;
        globalDrop?: boolean;
        syncHiddenInput?: boolean;
        clearOnSubmit?: boolean;
        maxFiles?: number;
        maxFileSize?: number; // bytes
        onError?: (err: {
            code: 'max_files' | 'max_file_size' | 'accept';
            message: string;
        }) => void;
        onSubmit: (message: PromptInputMessage, event: SubmitEvent) => void | Promise<void>;
        children?: import('svelte').Snippet;
    }

    let {
        class: className,
        accept,
        multiple,
        globalDrop,
        syncHiddenInput,
        clearOnSubmit = true,
        maxFiles,
        maxFileSize,
        onError,
        onSubmit,
        children,
        ...props
    }: Props = $props();

    let anchorRef = $state<HTMLSpanElement | null>(null);
    let formRef = $state<HTMLFormElement | null>(null);
    let attachmentsContext = new AttachmentsContext(
        () => accept,
        () => multiple,
        () => maxFiles,
        () => maxFileSize,
        () => onError
    );

    // Find nearest form to scope drag & drop
    onMount(() => {
        let root = anchorRef?.closest('form');
        if (root instanceof HTMLFormElement) {
            formRef = root;
        }
    });

    // Attach drop handlers on nearest form
    watch(
        () => formRef,
        (formRef) => {
            if (!formRef) return;

            let onDragOver = (e: DragEvent) => {
                if (e.dataTransfer?.types?.includes('Files')) {
                    e.preventDefault();
                }
            };

            let onDrop = (e: DragEvent) => {
                if (e.dataTransfer?.types?.includes('Files')) {
                    e.preventDefault();
                }
                if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                    attachmentsContext.add(e.dataTransfer.files);
                }
            };

            formRef.addEventListener('dragover', onDragOver);
            formRef.addEventListener('drop', onDrop);

            return () => {
                formRef?.removeEventListener('dragover', onDragOver);
                formRef?.removeEventListener('drop', onDrop);
            };
        }
    );

    // Global drop handlers
    watch(
        () => globalDrop,
        (globalDrop) => {
            if (!globalDrop) return;

            let onDragOver = (e: DragEvent) => {
                if (e.dataTransfer?.types?.includes('Files')) {
                    e.preventDefault();
                }
            };

            let onDrop = (e: DragEvent) => {
                if (e.dataTransfer?.types?.includes('Files')) {
                    e.preventDefault();
                }
                if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                    attachmentsContext.add(e.dataTransfer.files);
                }
            };

            document.addEventListener('dragover', onDragOver);
            document.addEventListener('drop', onDrop);

            return () => {
                document.removeEventListener('dragover', onDragOver);
                document.removeEventListener('drop', onDrop);
            };
        }
    );

    // Note: File input cannot be programmatically set for security reasons
    // The syncHiddenInput prop is no longer functional
    watch(
        () => attachmentsContext.files,
        () => {
            if (syncHiddenInput && attachmentsContext.fileInputRef) {
                // Clear the input when items are cleared
                if (attachmentsContext.files.length === 0) {
                    attachmentsContext.fileInputRef.value = '';
                }
            }
        }
    );

    let handleChange = (event: Event) => {
        let target = event.currentTarget as HTMLInputElement;
        if (target.files) {
            attachmentsContext.add(target.files);
        }
    };

    // Convert blob URLs to data URLs for proper serialization
    async function convertBlobUrlToDataUrl(url: string): Promise<string> {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    let handleSubmit = async (event: SubmitEvent) => {
        event.preventDefault();

        let form = event.currentTarget as HTMLFormElement;
        let formData = new FormData(form);
        let text = (formData.get('message') as string) || '';

        // Convert blob URLs to data URLs asynchronously
        let filesPromises = attachmentsContext.files.map(async ({ id: _id, ...item }) => {
            if (item.url && item.url.startsWith('blob:')) {
                return {
                    ...item,
                    url: await convertBlobUrlToDataUrl(item.url),
                };
            }
            return item;
        });

        try {
            let files = await Promise.all(filesPromises);

            // Clear form immediately before calling onSubmit
            // This provides better UX - user sees their message sent right away
            if (clearOnSubmit) {
                attachmentsContext.clear();
                form.reset();
            }

            // Call onSubmit (don't await - let it run in background)
            // The caller is responsible for handling errors
            onSubmit({ text, files }, event);
        } catch (error) {
            // Error during file conversion - don't clear
            console.error('Submit failed:', error);
        }
    };

    setAttachmentsContext(attachmentsContext);
</script>

<span aria-hidden="true" class="hidden" bind:this={anchorRef}></span>
<input
    {accept}
    class="hidden"
    {multiple}
    onchange={handleChange}
    bind:this={attachmentsContext.fileInputRef}
    type="file"
/>
<form
    class={cn(
        'bg-background w-full divide-y overflow-hidden rounded-xl border shadow-sm',
        className
    )}
    onsubmit={handleSubmit}
    {...props}
>
    {#if children}
        {@render children()}
    {/if}
</form>
