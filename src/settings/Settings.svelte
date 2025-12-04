<script lang="ts">
    import { setIcon } from 'obsidian';
    import type { CortexSettings, ModelSettings, ProviderSettings } from './settings';
    import { DEFAULT_PROVIDERS, DEFAULT_SETTINGS } from './settings';

    interface Props {
        settings: CortexSettings;
        onSave: () => Promise<void>;
        onRefresh: () => void;
        onOpenModal: (model: ModelSettings | null, onSaveModel: (model: ModelSettings) => void) => void;
    }

    let { settings = $bindable(), onSave, onRefresh, onOpenModal }: Props = $props();
    
    function iconAction(node: HTMLElement, iconId: string) {
        setIcon(node, iconId);
        return {
            update(newIconId: string) {
                node.empty();
                setIcon(node, newIconId);
            }
        };
    }

    let activeProviderId = $state(settings.activeProviderId || 'openai');

    let currentProvider = $derived(DEFAULT_PROVIDERS.find((p) => p.id === activeProviderId));
    
    function getProviderSettings(): ProviderSettings {
        if (!settings.providers) {
            settings.providers = DEFAULT_SETTINGS.providers;
        }
        const providerConfig = DEFAULT_PROVIDERS.find((p) => p.id === activeProviderId);
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
        activeProviderId;
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

    function openEditModelModal(model: ModelSettings) {
        onOpenModal(model, (updatedModel) => {
            const ps = getProviderSettings();
            ps.models = ps.models.map((m) => m.id === model.id ? updatedModel : m);
        });
    }
</script>

<div class="max-w-[900px] px-2">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6 pb-4 border-b border-border">
        <span class="flex items-center justify-center w-9 h-9 bg-primary rounded-[10px] text-primary-foreground" use:iconAction={'bot'}></span>
        <h2 class="m-0 text-2xl font-semibold text-foreground">Cortex Settings</h2>
    </div>

    <!-- Model Section -->
    <div class="bg-secondary rounded-xl p-5 border border-border">
        <div class="flex items-center gap-2.5 mb-4">
            <span class="flex text-muted-foreground" use:iconAction={'server'}></span>
            <h3 class="m-0 text-base font-semibold text-foreground">Model Configuration</h3>
        </div>

        <!-- Model Tabs -->
        <div class="flex flex-wrap gap-2 mb-4">
            {#each DEFAULT_PROVIDERS as provider}
                <button
                    class="px-4 py-2 border border-border rounded-full bg-background text-foreground text-[13px] font-medium cursor-pointer transition-all duration-150 hover:bg-accent hover:border-border {activeProviderId === provider.id ? 'bg-primary! text-primary-foreground! border-primary!' : ''}"
                    onclick={() => selectProvider(provider.id)}
                >
                    {provider.label}
                </button>
            {/each}
        </div>

        <!-- Model Config Card -->
        {#if currentProvider}
            <div class="bg-background rounded-[10px] p-4 border border-border">
                <!-- API Key Field -->
                <div class="mb-3">
                    <div class="flex items-center gap-2 mb-1.5 text-[13px] font-medium text-muted-foreground">
                        <span class="flex text-muted-foreground/60" use:iconAction={'key'}></span>
                        <span>API Key</span>
                    </div>
                    <input
                        type="password"
                        placeholder="Enter your API key..."
                        value={providerSettings.apiKey}
                        onchange={updateApiKey}
                        class="w-full py-2.5 px-3 bg-secondary border border-border rounded-lg text-foreground text-sm transition-colors duration-150 focus:outline-none focus:border-ring placeholder:text-muted-foreground/50"
                    />
                </div>

                <!-- Base URL Field -->
                <div class="mb-3">
                    <div class="flex items-center gap-2 mb-1.5 text-[13px] font-medium text-muted-foreground">
                        <span class="flex text-muted-foreground/60" use:iconAction={'link'}></span>
                        <span>Base URL</span>
                    </div>
                    <input
                        type="text"
                        placeholder={currentProvider.defaultBaseUrl}
                        value={providerSettings.baseUrl || currentProvider.defaultBaseUrl}
                        onchange={updateBaseUrl}
                        class="w-full py-2.5 px-3 bg-secondary border border-border rounded-lg text-foreground text-sm transition-colors duration-150 focus:outline-none focus:border-ring placeholder:text-muted-foreground/50"
                    />
                </div>

                <!-- Models Section -->
                <div class="mt-4 pt-4 border-t border-border">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                            <span class="flex text-muted-foreground/60" use:iconAction={'cpu'}></span>
                            <span>Models</span>
                        </div>
                        <button 
                            class="flex items-center justify-center w-7 h-7 bg-primary border-none rounded-md text-primary-foreground cursor-pointer transition-opacity duration-150 hover:opacity-90"
                            onclick={openAddModelModal} 
                            title="Add model"
                        >
                            <span use:iconAction={'plus'}></span>
                        </button>
                    </div>

                    <div class="flex flex-col gap-2">
                        {#if !models || models.length === 0}
                            <div class="flex flex-col items-center gap-2 py-6 text-muted-foreground/60 text-[13px]">
                                <span class="opacity-50" use:iconAction={'inbox'}></span>
                                <span>No models configured</span>
                            </div>
                        {:else}
                            {#each models as model (model.id)}
                                <div class="flex items-center justify-between py-2.5 px-3 bg-secondary border border-border rounded-lg transition-colors duration-150 hover:border-border">
                                    <div class="flex items-center gap-2.5">
                                        <span class="flex text-primary" use:iconAction={'sparkles'}></span>
                                        <span class="text-sm font-medium text-foreground">{model.name || model.modelName}</span>
                                    </div>
                                    <div class="flex gap-1">
                                        <button 
                                            class="flex items-center justify-center w-7 h-7 bg-transparent border border-transparent rounded-md text-muted-foreground cursor-pointer transition-all duration-150 hover:bg-accent hover:border-border hover:text-primary" 
                                            title="Edit model" 
                                            onclick={() => openEditModelModal(model)}
                                        >
                                            <span use:iconAction={'pencil'}></span>
                                        </button>
                                        <button 
                                            class="flex items-center justify-center w-7 h-7 bg-transparent border border-transparent rounded-md text-muted-foreground cursor-pointer transition-all duration-150 hover:bg-accent hover:border-border hover:text-destructive" 
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
