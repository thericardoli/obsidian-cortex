<script lang="ts">
    import { setIcon } from 'obsidian';

    import { BUILTIN_PROVIDER_IDS, BUILTIN_PROVIDERS, DEFAULT_SETTINGS } from './settings';

    import type { ModelConfig } from '../types/model';
    import type { CortexSettings, CustomProviderConfig, ProviderSettings } from './settings';

    interface Props {
        settings: CortexSettings;
        onSave: () => Promise<void>;
        onRefresh: () => void;
        onOpenModal: (model: ModelConfig | null, onSaveModel: (model: ModelConfig) => void) => void;
        onOpenProviderModal: (
            provider: CustomProviderConfig | null,
            onSaveProvider: (provider: CustomProviderConfig) => void
        ) => void;
    }

    let {
        settings = $bindable(),
        onSave,
        onRefresh,
        onOpenModal,
        onOpenProviderModal,
    }: Props = $props();

    function iconAction(node: HTMLElement, iconId: string) {
        setIcon(node, iconId);
        return {
            update(newIconId: string) {
                node.empty();
                setIcon(node, newIconId);
            },
        };
    }

    let activeProviderId = $state(settings.activeProviderId || 'openai');

    // 合并内置 Provider 和自定义 Provider
    let allProviders = $derived([
        ...BUILTIN_PROVIDER_IDS.map((id) => ({
            id,
            label: BUILTIN_PROVIDERS[id].label,
            defaultBaseUrl: BUILTIN_PROVIDERS[id].defaultBaseUrl,
            isCustom: false,
        })),
        ...(settings.customProviders || []).map((p) => ({
            id: p.id,
            label: p.name,
            defaultBaseUrl: p.baseUrl,
            isCustom: true,
        })),
    ]);

    let currentProvider = $derived(allProviders.find((p) => p.id === activeProviderId));

    function getProviderSettings(): ProviderSettings {
        if (!settings.providers) {
            settings.providers = DEFAULT_SETTINGS.providers;
        }
        const providerConfig = allProviders.find((p) => p.id === activeProviderId);
        if (!settings.providers[activeProviderId]) {
            settings.providers[activeProviderId] = {
                apiKey: '',
                baseUrl: providerConfig?.defaultBaseUrl || '',
                models: [],
            };
        }
        return settings.providers[activeProviderId];
    }

    function buildProviderSettingsSnapshot(): ProviderSettings {
        const ps = getProviderSettings();
        return {
            ...ps,
        };
    }

    let providerSettings = $state(buildProviderSettingsSnapshot());

    let models = $derived(getProviderSettings().models || []);

    // 当当前 provider 变化时，重新同步 providerSettings
    $effect(() => {
        void activeProviderId;
        providerSettings = buildProviderSettingsSnapshot();
    });

    async function selectProvider(providerId: string) {
        activeProviderId = providerId;
        settings.activeProviderId = providerId;
        providerSettings = buildProviderSettingsSnapshot();
        await onSave();
    }

    async function updateApiKey(event: Event) {
        const input = event.target as HTMLInputElement;
        getProviderSettings().apiKey = input.value.trim();
        providerSettings = buildProviderSettingsSnapshot();
        await onSave();
    }

    async function updateBaseUrl(event: Event) {
        const input = event.target as HTMLInputElement;
        getProviderSettings().baseUrl = input.value.trim();
        providerSettings = buildProviderSettingsSnapshot();
        await onSave();
    }

    async function deleteModel(modelId: string) {
        const ps = getProviderSettings();
        ps.models = ps.models.filter((m) => m.id !== modelId);
        await onSave();
        onRefresh();
    }

    function openAddModelModal() {
        onOpenModal(null, (model) => {
            const ps = getProviderSettings();
            if (!ps.models) {
                ps.models = [];
            }
            ps.models = [...ps.models, model];
        });
    }

    function openEditModelModal(model: ModelConfig) {
        onOpenModal(model, (updatedModel) => {
            const ps = getProviderSettings();
            ps.models = ps.models.map((m) => (m.id === model.id ? updatedModel : m));
        });
    }

    function openAddProviderModal() {
        onOpenProviderModal(null, (provider) => {
            if (!settings.customProviders) {
                settings.customProviders = [];
            }
            settings.customProviders = [...settings.customProviders, provider];
            // 初始化 provider settings
            settings.providers[provider.id] = {
                apiKey: provider.apiKey,
                baseUrl: provider.baseUrl,
                models: [],
            };
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function openEditProviderModal(providerId: string) {
        const customProvider = settings.customProviders?.find((p) => p.id === providerId);
        if (!customProvider) return;

        onOpenProviderModal(customProvider, (updatedProvider) => {
            settings.customProviders = settings.customProviders.map((p) =>
                p.id === customProvider.id ? updatedProvider : p
            );
            // 更新 provider settings
            const ps = settings.providers[providerId];
            if (ps) {
                ps.apiKey = updatedProvider.apiKey;
                ps.baseUrl = updatedProvider.baseUrl;
            }
        });
    }

    async function deleteCustomProvider(providerId: string) {
        settings.customProviders = settings.customProviders.filter((p) => p.id !== providerId);
        delete settings.providers[providerId];
        // 如果删除的是当前选中的 provider，切换到 openai
        if (activeProviderId === providerId) {
            activeProviderId = 'openai';
            settings.activeProviderId = 'openai';
        }
        await onSave();
        onRefresh();
    }
</script>

<div class="max-w-[900px] px-2">
    <!-- Header -->
    <div class="border-border mb-6 flex items-center gap-3 border-b pb-4">
        <span
            class="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-[10px]"
            use:iconAction={'bot'}
        ></span>
        <h2 class="text-foreground m-0 text-2xl font-semibold">Cortex Settings</h2>
    </div>

    <!-- Model Section -->
    <div class="bg-secondary border-border rounded-xl border p-5">
        <div class="mb-4 flex items-center gap-2.5">
            <span class="text-muted-foreground flex" use:iconAction={'server'}></span>
            <h3 class="text-foreground m-0 text-base font-semibold">Model Configuration</h3>
        </div>

        <!-- Model Tabs -->
        <div class="mb-4 flex flex-wrap items-center gap-2">
            {#each allProviders as provider (provider.id)}
                <button
                    class="border-border bg-background text-foreground hover:bg-accent cursor-pointer rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-150 {activeProviderId ===
                    provider.id
                        ? 'bg-primary! text-primary-foreground! border-primary! shadow-primary/25 shadow-sm'
                        : ''}"
                    onclick={() => selectProvider(provider.id)}
                >
                    {provider.label}
                </button>
            {/each}
            <button
                class="border-border text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer rounded-full border border-dashed bg-transparent px-4 py-2 text-[13px] font-medium transition-all duration-150"
                onclick={openAddProviderModal}
                title="Add custom provider"
            >
                + Add Provider
            </button>
        </div>

        <!-- Model Config Card -->
        {#if currentProvider}
            <div class="bg-background border-border rounded-[10px] border p-4">
                <!-- Custom Provider Header with Delete Button -->
                {#if currentProvider.isCustom}
                    <div class="border-border mb-4 flex items-center justify-between border-b pb-3">
                        <div class="flex items-center gap-2">
                            <span class="text-foreground text-sm font-medium"
                                >{currentProvider.label}</span
                            >
                            <span
                                class="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-medium"
                                >Custom</span
                            >
                        </div>
                        <button
                            class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent transition-all duration-150"
                            title="Delete provider"
                            onclick={() => deleteCustomProvider(currentProvider.id)}
                        >
                            <span use:iconAction={'trash-2'}></span>
                        </button>
                    </div>
                {/if}

                <!-- API Key Field -->
                <div class="mb-4">
                    <div
                        class="text-muted-foreground mb-2 flex items-center gap-2 text-[13px] font-medium"
                    >
                        <span class="text-muted-foreground/60 flex" use:iconAction={'key'}></span>
                        <span>API Key</span>
                    </div>
                    <input
                        type="password"
                        placeholder="Enter your API key..."
                        value={providerSettings.apiKey}
                        onchange={updateApiKey}
                        class="bg-secondary border-border text-foreground focus:border-primary focus:ring-primary/20 placeholder:text-muted-foreground/50 w-full rounded-lg border px-3 py-2.5 text-sm transition-all duration-150 focus:ring-2 focus:outline-none"
                    />
                </div>

                <!-- Base URL Field -->
                <div class="mb-4">
                    <div
                        class="text-muted-foreground mb-2 flex items-center gap-2 text-[13px] font-medium"
                    >
                        <span class="text-muted-foreground/60 flex" use:iconAction={'link'}></span>
                        <span>Base URL</span>
                    </div>
                    <input
                        type="text"
                        placeholder={currentProvider.defaultBaseUrl}
                        value={providerSettings.baseUrl || currentProvider.defaultBaseUrl}
                        onchange={updateBaseUrl}
                        class="bg-secondary border-border text-foreground focus:border-primary focus:ring-primary/20 placeholder:text-muted-foreground/50 w-full rounded-lg border px-3 py-2.5 text-sm transition-all duration-150 focus:ring-2 focus:outline-none"
                    />
                </div>

                <!-- Models Section -->
                <div class="border-border mt-5 border-t pt-5">
                    <div class="mb-4 flex items-center justify-between">
                        <div
                            class="text-muted-foreground flex items-center gap-2 text-[13px] font-medium"
                        >
                            <span class="text-muted-foreground/60 flex" use:iconAction={'cpu'}
                            ></span>
                            <span>Models</span>
                        </div>
                        <button
                            class="bg-primary text-primary-foreground flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none transition-opacity duration-150 hover:opacity-90"
                            onclick={openAddModelModal}
                            title="Add model"
                        >
                            <span use:iconAction={'plus'}></span>
                        </button>
                    </div>

                    <div class="flex flex-col gap-2.5">
                        {#if !models || models.length === 0}
                            <div
                                class="bg-secondary/50 border-border/50 flex flex-col items-center gap-3 rounded-lg border border-dashed py-8 text-[13px]"
                            >
                                <span class="text-muted-foreground/40" use:iconAction={'inbox'}
                                ></span>
                                <div class="flex flex-col items-center gap-1">
                                    <span class="text-muted-foreground">No models configured</span>
                                    <span class="text-muted-foreground/60 text-[12px]"
                                        >Click + to add your first model</span
                                    >
                                </div>
                            </div>
                        {:else}
                            {#each models as model (model.id)}
                                <div
                                    class="bg-secondary border-border hover:border-primary/30 flex items-center justify-between rounded-lg border px-4 py-3 transition-all duration-150 hover:shadow-sm"
                                >
                                    <div class="flex items-center gap-3">
                                        <span class="text-primary flex" use:iconAction={'sparkles'}
                                        ></span>
                                        <span class="text-foreground text-sm font-medium"
                                            >{model.name || model.modelID}</span
                                        >
                                    </div>
                                    <div class="flex gap-1">
                                        <button
                                            class="text-muted-foreground hover:bg-accent hover:text-primary flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent transition-all duration-150"
                                            title="Edit model"
                                            onclick={() => openEditModelModal(model)}
                                        >
                                            <span use:iconAction={'pencil'}></span>
                                        </button>
                                        <button
                                            class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent transition-all duration-150"
                                            title="Delete model"
                                            onclick={() => deleteModel(model.id)}
                                        >
                                            <span use:iconAction={'trash-2'}></span>
                                        </button>
                                    </div>
                                </div>
                            {/each}
                        {/if}
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>
