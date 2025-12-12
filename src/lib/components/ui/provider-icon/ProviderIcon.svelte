<script lang="ts">
    import { requestUrl } from 'obsidian';

    import anthropicSvgRaw from '$lib/assets/provider-icons/anthropic.svg?raw';
    import googleSvgRaw from '$lib/assets/provider-icons/google.svg?raw';
    import openaiSvgRaw from '$lib/assets/provider-icons/openai.svg?raw';
    import openrouterSvgRaw from '$lib/assets/provider-icons/openrouter.svg?raw';
    import { cn } from '$lib/utils';

    import { modelsDevLogoUrl } from '../../../../utils/models-dev';

    interface Props {
        providerId: string;
        size?: number;
        class?: string;
    }

    let { providerId, size = 14, class: className = '' }: Props = $props();

    const SVG_BY_PROVIDER: Record<string, string> = {
        openai: openaiSvgRaw,
        google: googleSvgRaw,
        anthropic: anthropicSvgRaw,
        openrouter: openrouterSvgRaw,
    };

    const REMOTE_SVG_CACHE: Record<string, string | undefined> = Object.create(null);
    const REMOTE_SVG_INFLIGHT: Record<string, Promise<string> | undefined> = Object.create(null);

    async function fetchModelsDevLogo(providerId: string): Promise<string> {
        const cached = REMOTE_SVG_CACHE[providerId];
        if (cached !== undefined) return cached;

        const inflight = REMOTE_SVG_INFLIGHT[providerId];
        if (inflight) return inflight;

        const task = (async () => {
            try {
                const res = await requestUrl({ url: modelsDevLogoUrl(providerId) });
                if (res.status !== 200) return '';
                const svg = res.text;
                if (!svg || !svg.toLowerCase().includes('<svg')) return '';
                return normalizeSvg(svg);
            } catch {
                return '';
            }
        })()
            .then((svg) => {
                REMOTE_SVG_CACHE[providerId] = svg;
                return svg;
            })
            .finally(() => {
                delete REMOTE_SVG_INFLIGHT[providerId];
            });

        REMOTE_SVG_INFLIGHT[providerId] = task;
        return task;
    }

    function patchSvgOpenTag(svg: string, patch: (openTag: string) => string): string {
        const match = svg.match(/<svg\b[^>]*>/i);
        if (!match) return svg;
        const openTag = match[0];
        return svg.replace(openTag, patch(openTag));
    }

    function normalizeSvg(svg: string): string {
        return patchSvgOpenTag(svg.trim(), (openTag) => {
            let next = openTag;

            next = next.replace(/\s(width|height)="[^"]*"/gi, '');

            if (/\sfill=/i.test(next)) {
                next = next.replace(/\sfill="[^"]*"/gi, ' fill="currentColor"');
            } else {
                next = next.replace('<svg', '<svg fill="currentColor"');
            }

            if (!/\sstyle=/i.test(next)) {
                next = next.replace('<svg', '<svg style="width:100%;height:100%"');
            }

            if (!/\saria-hidden=/i.test(next)) {
                next = next.replace('<svg', '<svg aria-hidden="true"');
            }

            if (!/\sfocusable=/i.test(next)) {
                next = next.replace('<svg', '<svg focusable="false"');
            }

            return next;
        });
    }

    const normalizedProviderId = $derived.by(() => (providerId || '').trim().toLowerCase());

    let remoteSvg = $state('');

    $effect(() => {
        const id = normalizedProviderId;
        if (!id) {
            remoteSvg = '';
            return;
        }

        if (SVG_BY_PROVIDER[id]) {
            remoteSvg = '';
            return;
        }

        let cancelled = false;
        void (async () => {
            const svg = await fetchModelsDevLogo(id);
            if (!cancelled) remoteSvg = svg;
        })();

        return () => {
            cancelled = true;
        };
    });

    const svg = $derived.by(() => {
        const raw = SVG_BY_PROVIDER[normalizedProviderId];
        if (raw) return normalizeSvg(raw);
        return remoteSvg;
    });
</script>

{#if svg}
    <span
        class={cn('inline-flex shrink-0 items-center justify-center', className)}
        style={`width:${size}px;height:${size}px`}
    >
        {@html svg}
    </span>
{/if}
