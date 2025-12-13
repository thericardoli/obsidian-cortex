<script lang="ts">
    import anthropicSvgRaw from '$lib/assets/provider-icons/anthropic.svg?raw';
    import geminiSvgRaw from '$lib/assets/provider-icons/gemini.svg?raw';
    import openaiSvgRaw from '$lib/assets/provider-icons/openai.svg?raw';
    import openrouterSvgRaw from '$lib/assets/provider-icons/openrouter.svg?raw';
    import { cn } from '$lib/utils';

    interface Props {
        providerId: string;
        size?: number;
        class?: string;
    }

    let { providerId, size = 14, class: className = '' }: Props = $props();

    const SVG_BY_PROVIDER: Record<string, string> = {
        openai: openaiSvgRaw,
        gemini: geminiSvgRaw,
        anthropic: anthropicSvgRaw,
        openrouter: openrouterSvgRaw,
    };

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

    const svg = $derived.by(() => {
        const raw = SVG_BY_PROVIDER[normalizedProviderId];
        if (!raw) return '';
        return normalizeSvg(raw);
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
