import { getContext, setContext } from 'svelte';

export interface FileUIPart {
    type: 'file';
    url?: string;
    mediaType?: string;
    filename?: string;
}

export interface FileWithId extends FileUIPart {
    id: string;
}

export interface PromptInputMessage {
    text?: string;
    files?: FileUIPart[];
}

export type ChatStatus = 'submitted' | 'streaming' | 'error' | 'idle';

export class AttachmentsContext {
    files = $state<FileWithId[]>([]);
    fileInputRef = $state<HTMLInputElement | null>(null);

    constructor(
        private getAccept: () => string | undefined = () => undefined,
        private getMultiple: () => boolean | undefined = () => undefined,
        private getMaxFiles: () => number | undefined = () => undefined,
        private getMaxFileSize: () => number | undefined = () => undefined,
        private getOnError: () =>
            | ((err: { code: 'max_files' | 'max_file_size' | 'accept'; message: string }) => void)
            | undefined = () => undefined
    ) {}

    // Getters to access current prop values
    private get accept() {
        return this.getAccept();
    }
    private get multiple() {
        return this.getMultiple();
    }
    private get maxFiles() {
        return this.getMaxFiles();
    }
    private get maxFileSize() {
        return this.getMaxFileSize();
    }
    private get onError() {
        return this.getOnError();
    }

    openFileDialog = () => {
        this.fileInputRef?.click();
    };

    matchesAccept = (file: File): boolean => {
        if (!this.accept || this.accept.trim() === '') {
            return true;
        }
        if (this.accept.includes('image/*')) {
            return file.type.startsWith('image/');
        }
        return true;
    };

    add = (files: File[] | FileList) => {
        const incoming = Array.from(files);
        const accepted = incoming.filter((f) => this.matchesAccept(f));

        if (accepted.length === 0) {
            this.onError?.({
                code: 'accept',
                message: 'No files match the accepted types.',
            });
            return;
        }

        const withinSize = (f: File) => (this.maxFileSize ? f.size <= this.maxFileSize : true);
        const sized = accepted.filter(withinSize);

        if (sized.length === 0 && accepted.length > 0) {
            this.onError?.({
                code: 'max_file_size',
                message: 'All files exceed the maximum size.',
            });
            return;
        }

        const capacity =
            typeof this.maxFiles === 'number'
                ? Math.max(0, this.maxFiles - this.files.length)
                : undefined;
        const capped = typeof capacity === 'number' ? sized.slice(0, capacity) : sized;

        if (typeof capacity === 'number' && sized.length > capacity) {
            this.onError?.({
                code: 'max_files',
                message: 'Too many files. Some were not added.',
            });
        }

        const next: FileWithId[] = [];
        for (const file of capped) {
            next.push({
                id: crypto.randomUUID(),
                type: 'file',
                url: URL.createObjectURL(file),
                mediaType: file.type,
                filename: file.name,
            });
        }

        this.files = [...this.files, ...next];
    };

    remove = (id: string) => {
        const found = this.files.find((file) => file.id === id);
        if (found?.url) {
            URL.revokeObjectURL(found.url);
        }
        this.files = this.files.filter((file) => file.id !== id);
    };

    clear = () => {
        for (const file of this.files) {
            if (file.url) {
                URL.revokeObjectURL(file.url);
            }
        }
        this.files = [];
    };
}

// ============================================================================
// Provider Context for Global State Management
// ============================================================================

export class TextInputController {
    value = $state('');

    setInput = (newValue: string) => {
        this.value = newValue;
    };

    clear = () => {
        this.value = '';
    };
}

export class PromptInputController {
    textInput: TextInputController;
    attachments: AttachmentsContext;

    constructor(
        getInitialInput: () => string = () => '',
        getAccept: () => string | undefined = () => undefined,
        getMultiple: () => boolean | undefined = () => undefined
    ) {
        this.textInput = new TextInputController();
        this.textInput.value = getInitialInput();
        this.attachments = new AttachmentsContext(getAccept, getMultiple);
    }
}

const ATTACHMENTS_CONTEXT_KEY = Symbol('attachments');
const PROVIDER_CONTEXT_KEY = Symbol('prompt-input-provider');

export function setAttachmentsContext(context: AttachmentsContext) {
    setContext(ATTACHMENTS_CONTEXT_KEY, context);
}

export function getAttachmentsContext(): AttachmentsContext {
    const context = getContext<AttachmentsContext>(ATTACHMENTS_CONTEXT_KEY);
    if (!context) {
        throw new Error('usePromptInputAttachments must be used within a PromptInput');
    }
    return context;
}

// Provider context (optional, for external state management)
export function setPromptInputProvider(controller: PromptInputController) {
    setContext(PROVIDER_CONTEXT_KEY, controller);
}

export function getPromptInputProvider(): PromptInputController | null {
    return getContext<PromptInputController>(PROVIDER_CONTEXT_KEY) || null;
}

export function getPromptInputController(): PromptInputController {
    const context = getContext<PromptInputController>(PROVIDER_CONTEXT_KEY);
    if (!context) {
        throw new Error('getPromptInputController must be used within a PromptInputProvider');
    }
    return context;
}
