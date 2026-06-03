import type { LateTier, GuidanceResult } from '../interfaces/guidance';
import type { RawTier, VariantEntry } from '../interfaces/med';

function days(n: number | null): number {
    return n === null ? Infinity : n;
}

function normalizeGuidance(g: GuidanceResult): GuidanceResult {
    const result: GuidanceResult = { idealSteps: g.idealSteps };
    if (g.pragmaticVariations?.length) result.pragmaticVariations = g.pragmaticVariations;
    if (g.providerNotifications?.length) result.providerNotifications = g.providerNotifications;
    return result;
}

export function buildTier(raw: RawTier): LateTier {
    const maxDays = days(raw['maxDays'] as number | null);
    if (raw['guidanceByDose'] != null || raw['guidanceByDoseRules'] != null) {
        return {
            type: 'dose-variant',
            maxDays,
            ...(raw['guidanceByDose'] != null
                ? {
                      guidanceByDose: Object.fromEntries(
                          Object.entries(raw['guidanceByDose'] as Record<string, GuidanceResult>).map(
                              ([k, v]) => [k, normalizeGuidance(v)],
                          ),
                      ),
                  }
                : {}),
            ...(raw['guidanceByDoseRules'] != null
                ? {
                      guidanceByDoseRules: (
                          raw['guidanceByDoseRules'] as { doses: string[]; guidance: GuidanceResult }[]
                      ).map((r) => ({ ...r, guidance: normalizeGuidance(r.guidance) })),
                      ...(raw['defaultGuidance'] != null
                          ? { defaultGuidance: normalizeGuidance(raw['defaultGuidance'] as GuidanceResult) }
                          : {}),
                  }
                : {}),
        };
    }
    return { type: 'static', maxDays, guidance: normalizeGuidance(raw['guidance'] as GuidanceResult) };
}

export function buildTiers(raws: RawTier[]): LateTier[] {
    return raws.map(buildTier);
}

/** Builds a variant→tiers map; entries with `sameAs` reuse another variant's built value. */
export function buildVariantMap<T>(
    variants: VariantEntry[],
    build: (tiers: RawTier[]) => T,
): Record<string, T> {
    const map: Record<string, T> = {};
    for (const v of variants) {
        if (v.tiers) map[v.key] = build(v.tiers);
    }
    for (const v of variants) {
        if (v.sameAs) map[v.key] = map[v.sameAs];
    }
    return map;
}

export function resolveLateTier(
    tiers: LateTier[],
    daysSince: number,
    dose?: string,
): GuidanceResult {
    try {
        if (!tiers.length) {
            console.error(
                '[resolveLateTier] Empty tiers array for daysSince=%d dose=%s',
                daysSince,
                dose,
            );
            return {
                idealSteps: [
                    'Guidance unavailable: no tiers configured. Please contact the prescriber.',
                ],
            };
        }
        const tier = tiers.find((t) => daysSince <= t.maxDays) ?? tiers[tiers.length - 1];
        if (tier.type === 'dose-variant') {
            if (tier.guidanceByDoseRules) {
                const matched = tier.guidanceByDoseRules.find(
                    (rule) => dose != null && rule.doses.includes(dose),
                );
                if (matched) return matched.guidance;
                if (tier.defaultGuidance) return tier.defaultGuidance;
                console.error(
                    '[resolveLateTier] Missing or unknown dose for rules:',
                    dose,
                    '— available:',
                    tier.guidanceByDoseRules.flatMap((r) => r.doses),
                );
                return {
                    idealSteps: [
                        'Guidance unavailable: dose not recognised. Please contact the prescriber.',
                    ],
                };
            }
            if (!tier.guidanceByDose || !dose || !(dose in tier.guidanceByDose)) {
                console.error(
                    '[resolveLateTier] Missing or unknown dose:',
                    dose,
                    '— available:',
                    Object.keys(tier.guidanceByDose ?? {}),
                );
                return {
                    idealSteps: [
                        'Guidance unavailable: dose not recognised. Please contact the prescriber.',
                    ],
                };
            }
            return tier.guidanceByDose[dose!];
        }
        return tier.guidance;
    } catch (err) {
        console.error(
            '[resolveLateTier] Failed to resolve tier for daysSince=%d dose=%s:',
            daysSince,
            dose,
            err,
        );
        return {
            idealSteps: [
                'Guidance unavailable: an unexpected error occurred. Please contact the prescriber.',
            ],
        };
    }
}
