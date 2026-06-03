import { describe, it, expect } from 'vitest';
import { MED_REGISTRY, pluralDays, composeEarlyGuidance } from '../medLoader';
import { hasNotif } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _medJsons = import.meta.glob<any>('../meds/*.json', { eager: true, import: 'default' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function earlyOf(key: string): any {
    return _medJsons[`../meds/${key}.json`]?.guidance?.early ?? {};
}
function expectedEarlyGuidance(key: string): string {
    const e = earlyOf(key);
    const notes: string[] | undefined = e.guidanceNote?.length ? (e.guidanceNote as string[]) : undefined;
    return composeEarlyGuidance(e.daysBeforeDue as number | undefined, e.minDays as number | undefined, notes);
}

describe('displayName', () => {
    it('returns full name for known medication keys', () => {
        expect(MED_REGISTRY['invega_sustenna'].displayName).toBe(
            'Invega Sustenna (paliperidone palmitate)',
        );
        expect(MED_REGISTRY['vivitrol'].displayName).toBe('Vivitrol (naltrexone)');
        expect(MED_REGISTRY['uzedy'].displayName).toBe('Uzedy (risperidone subcutaneous)');
    });
});
describe('earlyGuidance', () => {
    // ── pluralDays ──────────────────────────────────────────────────────────
    describe('pluralDays', () => {
        it('1 day  → "1 day"', () => expect(pluralDays(1)).toBe('1 day'));
        it('3 days → "3 days"', () => expect(pluralDays(3)).toBe('3 days'));
        it('6 days → "6 days"', () => expect(pluralDays(6)).toBe('6 days'));
        it('7 days → "1 week"', () => expect(pluralDays(7)).toBe('1 week'));
        it('14 days → "2 weeks"', () => expect(pluralDays(14)).toBe('2 weeks'));
        it('21 days → "3 weeks"', () => expect(pluralDays(21)).toBe('3 weeks'));
        it('26 days → "26 days"', () => expect(pluralDays(26)).toBe('26 days'));
    });

    // ── composeEarlyGuidance ────────────────────────────────────────────────
    describe('composeEarlyGuidance', () => {
        it('before-next, no note', () =>
            expect(composeEarlyGuidance(7, undefined, undefined)).toBe('1 week before due date'));
        it('before-next, with note', () =>
            expect(composeEarlyGuidance(3, undefined, ['DESC created guidance'])).toBe(
                '3 days before due date\n- DESC created guidance',
            ));
        it('since-last, no note', () =>
            expect(composeEarlyGuidance(undefined, 21, undefined)).toBe(
                'No sooner than 3 weeks after last injection',
            ));
        it('since-last, with note', () =>
            expect(
                composeEarlyGuidance(undefined, 21, [
                    'This may be given earlier with provider approval',
                ]),
            ).toBe(
                'No sooner than 3 weeks after last injection\n- This may be given earlier with provider approval',
            ));
        it('since-last, non-week days', () =>
            expect(composeEarlyGuidance(undefined, 26, undefined)).toBe(
                'No sooner than 26 days after last injection',
            ));
        it('dual constraint, no note', () =>
            expect(composeEarlyGuidance(7, 21, undefined)).toBe(
                '1 week before due date; no sooner than 3 weeks after last injection',
            ));
    });

    // ── Registry: earlyGuidance string ─────────────────────────────────────
    describe('registry earlyGuidance string', () => {
        it('returns early guidance content for known medications', () => {
            expect(MED_REGISTRY['invega_trinza'].earlyGuidance).toBe(expectedEarlyGuidance('invega_trinza'));
            expect(MED_REGISTRY['abilify_maintena'].earlyGuidance).toBe(expectedEarlyGuidance('abilify_maintena'));
        });
        const cases: string[] = [
            'aristada', 'invega_sustenna', 'invega_hafyera', 'fluphenazine_decanoate',
            'haloperidol_decanoate', 'uzedy', 'brixadi', 'sublocade', 'vivitrol',
        ];
        for (const key of cases) {
            it(`${key} earlyGuidance`, () =>
                expect(MED_REGISTRY[key as keyof typeof MED_REGISTRY].earlyGuidance).toBe(
                    expectedEarlyGuidance(key),
                ));
        }
    });

    // ── Registry: earlyDaysBeforeDue / earlyMinDays ─────────────────────────
    describe('registry earlyDaysBeforeDue and earlyMinDays', () => {
        const daysBeforeDueKeys = [
            'aristada', 'invega_sustenna', 'invega_trinza', 'invega_hafyera',
            'fluphenazine_decanoate', 'haloperidol_decanoate', 'uzedy',
        ];
        for (const key of daysBeforeDueKeys) {
            it(`${key} earlyDaysBeforeDue = ${earlyOf(key).daysBeforeDue}`, () =>
                expect(MED_REGISTRY[key as keyof typeof MED_REGISTRY].earlyDaysBeforeDue).toBe(
                    earlyOf(key).daysBeforeDue,
                ));
        }
        const minDayKeys = [
            'abilify_maintena', 'brixadi', 'sublocade', 'vivitrol',
            'invega_sustenna', 'aristada', 'uzedy', 'haloperidol_decanoate', 'fluphenazine_decanoate',
        ];
        for (const key of minDayKeys) {
            it(`${key} earlyMinDays = ${earlyOf(key).minDays}`, () =>
                expect(MED_REGISTRY[key as keyof typeof MED_REGISTRY].earlyMinDays).toBe(
                    earlyOf(key).minDays,
                ));
        }
    });
});

// ─── guidance.shared.providerNotifications — loader ──────────────────────────

describe('guidance.shared.providerNotifications — loader', () => {
    it('commonProviderNotifications is undefined for meds whose shared array is empty', () => {
        const medsWithNoShared = Object.entries(MED_REGISTRY)
            .filter(([, entry]) => !entry.commonProviderNotifications)
            .map(([key]) => key);
        // Meds with a non-empty shared array (e.g. Invega family) are excluded automatically
        expect(medsWithNoShared.length).toBeGreaterThan(0);
        for (const key of medsWithNoShared) {
            expect(
                MED_REGISTRY[key as keyof typeof MED_REGISTRY].commonProviderNotifications,
            ).toBeUndefined();
        }
    });

    it('all three Invega meds load the eGFR shared notification', () => {
        const invegaKeys = ['invega_sustenna', 'invega_trinza', 'invega_hafyera'] as const;
        for (const key of invegaKeys) {
            const notifs = MED_REGISTRY[key].commonProviderNotifications;
            expect(
                notifs,
                `${key}: expected commonProviderNotifications to be defined`,
            ).toBeDefined();
            expect(hasNotif(notifs, 'eGFR is < 80 mL/min')).toBe(true);
            expect(hasNotif(notifs, 'If eGFR')).toBe(false);
        }
    });

    it('haloperidol_decanoate loads the albumin/bilirubin shared notification', () => {
        const notifs = MED_REGISTRY['haloperidol_decanoate'].commonProviderNotifications;
        expect(notifs).toBeDefined();
        expect(hasNotif(notifs, 'Albumin is < 3.0')).toBe(true);
        expect(hasNotif(notifs, 'bilirubin')).toBe(true);
        expect(hasNotif(notifs, 'If albumin')).toBe(false);
    });

    it('all antipsychotics include the abnormal involuntary movements notification', () => {
        const antipsychotics = [
            'invega_sustenna',
            'invega_trinza',
            'invega_hafyera',
            'abilify_maintena',
            'aristada',
            'uzedy',
            'haloperidol_decanoate',
            'fluphenazine_decanoate',
        ] as const;
        for (const key of antipsychotics) {
            const notifs = MED_REGISTRY[key].commonProviderNotifications;
            expect(
                notifs,
                `${key}: expected commonProviderNotifications to be defined`,
            ).toBeDefined();
            expect(
                hasNotif(notifs, 'New side effects from recent injection'),
                `${key}: missing side effects notification`,
            ).toBe(true);
            expect(
                hasNotif(notifs, 'abnormal involuntary movements'),
                `${key}: missing AIMS notification`,
            ).toBe(true);
            expect(
                hasNotif(notifs, 'excessive sedation, dizziness'),
                `${key}: missing sedation notification`,
            ).toBe(true);
            // "New side effects" must appear before "New abnormal involuntary movements"
            const sideIdx = notifs!.findIndex((s) => s.includes('New side effects'));
            const aimsIdx = notifs!.findIndex((s) => s.includes('abnormal involuntary'));
            expect(
                sideIdx,
                `${key}: "New side effects" should come before "New abnormal involuntary movements"`,
            ).toBeLessThan(aimsIdx);
        }
    });
});

// ─── renderInfoRow (exercised via buildLateInfoRows) ─────────────────────────

describe('renderInfoRow — all branches', () => {
    // ── static value row ──────────────────────────────────────────────────────
    describe('static value row', () => {
        it('returns the literal value regardless of ctx and daysSince', () => {
            const ctx = { 'invega-type': 'initiation', 'first-injection': '' };
            const rows = MED_REGISTRY['invega_sustenna'].buildLateInfoRows(ctx, 14);
            const row = rows.find(([label]) => label === 'Injection Type:');
            expect(row).toBeDefined();
            expect(row![1]).toBe('Missed/delayed 2nd initiation (156 mg) injection');
        });

        it('maintenance branch has its own static label', () => {
            const ctx = {
                'invega-type': 'maintenance',
                'last-maintenance': '',
                'maintenance-dose': '234',
            };
            const rows = MED_REGISTRY['invega_sustenna'].buildLateInfoRows(ctx, 50);
            const row = rows.find(([label]) => label === 'Injection Type:');
            expect(row).toBeDefined();
            expect(row![1]).toBe('Missed/delayed monthly maintenance injection');
        });
    });

    // ── field row — date format ───────────────────────────────────────────────
    describe('field row — date format', () => {
        it('formats ISO date as localised long date string', () => {
            const ctx = { 'last-trinza': '2026-01-15', 'trinza-dose': '546' };
            const rows = MED_REGISTRY['invega_trinza'].buildLateInfoRows(ctx, 52);
            const row = rows.find(([label]) => label === 'Date of last Trinza injection:');
            expect(row).toBeDefined();
            expect(row![1]).toBe('January 15, 2026');
        });

        it('another date field (sustenna initiation)', () => {
            const ctx = { 'invega-type': 'initiation', 'first-injection': '2025-11-20' };
            const rows = MED_REGISTRY['invega_sustenna'].buildLateInfoRows(ctx, 14);
            const row = rows.find(([label]) => label === 'Date of first (234 mg) injection:');
            expect(row).toBeDefined();
            expect(row![1]).toBe('November 20, 2025');
        });
    });

    // ── field row — option-label format ──────────────────────────────────────
    describe('field row — option-label format', () => {
        it('returns the human-readable label for a known option value', () => {
            const ctx = {
                'invega-type': 'maintenance',
                'last-maintenance': '',
                'maintenance-dose': '39-to-156',
            };
            const rows = MED_REGISTRY['invega_sustenna'].buildLateInfoRows(ctx, 50);
            const row = rows.find(([label]) => label === 'Monthly maintenance dose:');
            expect(row).toBeDefined();
            expect(row![1]).toBe('39 to 156 mg');
        });

        it('returns the other option label correctly', () => {
            const ctx = {
                'invega-type': 'maintenance',
                'last-maintenance': '',
                'maintenance-dose': '234',
            };
            const rows = MED_REGISTRY['invega_sustenna'].buildLateInfoRows(ctx, 50);
            const row = rows.find(([label]) => label === 'Monthly maintenance dose:');
            expect(row![1]).toBe('234 mg');
        });

        it('falls back to the raw value when the option is not found', () => {
            const ctx = {
                'invega-type': 'maintenance',
                'last-maintenance': '',
                'maintenance-dose': 'unknown-val',
            };
            const rows = MED_REGISTRY['invega_sustenna'].buildLateInfoRows(ctx, 50);
            const row = rows.find(([label]) => label === 'Monthly maintenance dose:');
            expect(row![1]).toBe('unknown-val');
        });
    });

    // ── computed time — days-months ───────────────────────────────────────────
    describe('computed time — days-months format (trinza)', () => {
        function timeRow(days: number) {
            const ctx = { 'last-trinza': '', 'trinza-dose': '546' };
            const rows = MED_REGISTRY['invega_trinza'].buildLateInfoRows(ctx, days);
            return rows.find(([label]) => label === 'Time since last injection:')![1];
        }

        it('90 days → approximately 3 months (Math.round(90 / 30.44) = 3)', () => {
            expect(timeRow(90)).toBe('90 days (approximately 3 months)');
        });

        it('30 days → approximately 1 month', () => {
            expect(timeRow(30)).toBe('30 days (approximately 1 month)');
        });

        it('0 days → "0 days" with no parenthetical (today = injection day)', () => {
            expect(timeRow(0)).toBe('0 days');
        });

        it('negative days are clamped to 0 (future date entered)', () => {
            expect(timeRow(-5)).toBe('0 days');
        });
    });

    // ── computed time — days-weeks-months ─────────────────────────────────────
    describe('computed time — days-weeks-months format (hafyera)', () => {
        function timeRow(days: number) {
            const ctx = { 'last-hafyera': '' };
            const rows = MED_REGISTRY['invega_hafyera'].buildLateInfoRows(ctx, days);
            return rows.find(([label]) => label === 'Time since last injection:')![1];
        }

        it('33 days → "4 weeks and 5 days", no "approximately" and no "months"', () => {
            expect(timeRow(33)).toBe('33 days (4 weeks and 5 days)');
            expect(timeRow(33)).not.toContain('approximately');
            expect(timeRow(33)).not.toContain('months');
        });

        it('7 days → "1 week"', () => {
            expect(timeRow(7)).toBe('7 days (1 week)');
        });

        it('14 days → "2 weeks"', () => {
            expect(timeRow(14)).toBe('14 days (2 weeks)');
        });

        it('0 days → "0 days" with no parenthetical', () => {
            expect(timeRow(0)).toBe('0 days');
        });

        it('negative days are clamped to 0 (future date entered)', () => {
            expect(timeRow(-10)).toBe('0 days');
        });
    });

    // ── computed time — days-weeks (default branch, same output as days-weeks-months) ──
    describe('computed time — days-weeks format (sustenna)', () => {
        function timeRow(days: number) {
            const ctx = { 'invega-type': 'initiation', 'first-injection': '' };
            const rows = MED_REGISTRY['invega_sustenna'].buildLateInfoRows(ctx, days);
            return rows.find(([label]) => label === 'Time since first (234 mg) injection:')![1];
        }

        it('21 days → "3 weeks"', () => {
            expect(timeRow(21)).toBe('21 days (3 weeks)');
        });

        it('10 days → "1 week and 3 days"', () => {
            expect(timeRow(10)).toBe('10 days (1 week and 3 days)');
        });

        it('0 days → "0 days" with no parenthetical', () => {
            expect(timeRow(0)).toBe('0 days');
        });

        it('negative days are clamped to 0', () => {
            expect(timeRow(-3)).toBe('0 days');
        });
    });
});

// ─── buildCoreDef ─────────────────────────────────────────────────────────────

describe('buildCoreDef — base fields', () => {
    it('earlyDaysBeforeDue is set from early.daysBeforeDue', () => {
        expect(MED_REGISTRY['uzedy'].earlyDaysBeforeDue).toBe(earlyOf('uzedy').daysBeforeDue);
        expect(MED_REGISTRY['aristada'].earlyDaysBeforeDue).toBe(earlyOf('aristada').daysBeforeDue);
        expect(MED_REGISTRY['invega_hafyera'].earlyDaysBeforeDue).toBe(earlyOf('invega_hafyera').daysBeforeDue);
    });

    it('earlyDaysBeforeDue is absent when JSON has no early.daysBeforeDue', () => {
        expect(MED_REGISTRY['abilify_maintena'].earlyDaysBeforeDue).toBeUndefined();
    });

    it('earlyMinDays is set from early.minDays', () => {
        expect(MED_REGISTRY['abilify_maintena'].earlyMinDays).toBe(earlyOf('abilify_maintena').minDays);
        expect(MED_REGISTRY['uzedy'].earlyMinDays).toBe(earlyOf('uzedy').minDays);
        expect(MED_REGISTRY['aristada'].earlyMinDays).toBe(earlyOf('aristada').minDays);
    });

    it('earlyMinDays is absent when JSON has no early.minDays', () => {
        expect(MED_REGISTRY['invega_hafyera'].earlyMinDays).toBeUndefined();
    });

    it('commonProviderNotifications is populated from guidance.shared.providerNotifications', () => {
        const notifs = MED_REGISTRY['abilify_maintena'].commonProviderNotifications;
        expect(notifs).toBeDefined();
        expect(notifs!.some((s) => s.includes('New side effects'))).toBe(true);
    });

    it('commonProviderNotifications reflects the shared section for any med (invega_hafyera eGFR)', () => {
        const notifs = MED_REGISTRY['invega_hafyera'].commonProviderNotifications;
        expect(notifs).toBeDefined();
        expect(notifs!.some((s) => s.includes('eGFR'))).toBe(true);
    });

    it('commonProviderNotifications is absent when guidance.shared.providerNotifications is empty', () => {
        // sublocade has shared.providerNotifications: [] — zero length → field omitted
        expect(MED_REGISTRY['sublocade'].commonProviderNotifications).toBeUndefined();
    });

    it('commonProviderNotifications is present when guidance.shared.providerNotifications is non-empty (vivitrol)', () => {
        const notifs = MED_REGISTRY['vivitrol'].commonProviderNotifications;
        expect(notifs).toBeDefined();
        expect(notifs!.some((s) => s.includes('minimal or no fentanyl dependence'))).toBe(true);
    });
});

describe('buildCoreDef — getLateGuidance variantKey dispatch', () => {
    // 1. explicit variant → used directly regardless of dose
    it('explicit variant used directly (Abilify "1-2" at 28 days → administer)', () => {
        const r = MED_REGISTRY['abilify_maintena'].getLateGuidance({
            daysSince: 28,
            variant: '1-2',
        });
        expect(
            r.idealSteps.some((s) => s.includes('Administer usual Abilify Maintena monthly dose')),
        ).toBe(true);
    });

    it('explicit variant used directly (Abilify "3+" at 50 days → reinitiation)', () => {
        const r = MED_REGISTRY['abilify_maintena'].getLateGuidance({
            daysSince: 50,
            variant: '3+',
        });
        expect(r.idealSteps.some((s) => s.includes('Re-initiate'))).toBe(true);
    });

    it('variant takes priority over dose — valid variant + unknown dose does not throw', () => {
        // If dose were checked first, 'unknown-dose' would fall through to 'default' (nonexistent in Abilify) → throw.
        // variant being prioritised avoids this.
        expect(() =>
            MED_REGISTRY['abilify_maintena'].getLateGuidance({
                daysSince: 28,
                variant: '1-2',
                dose: 'unknown-dose',
            }),
        ).not.toThrow();
        const r = MED_REGISTRY['abilify_maintena'].getLateGuidance({
            daysSince: 28,
            variant: '1-2',
            dose: 'unknown-dose',
        });
        expect(r.idealSteps.length).toBeGreaterThan(0);
    });

    // 2. dose IS a variant key → dose used as variantKey (Aristada)
    it('dose used as variantKey when it matches a variant key (Aristada 441, 7-day tier)', () => {
        const r = MED_REGISTRY['aristada'].getLateGuidance({ daysSince: 45, dose: '441' });
        expect(r.idealSteps.some((s) => s.includes('7 days'))).toBe(true);
    });

    it('dose used as variantKey when it matches a variant key (Aristada 662, 7-day tier)', () => {
        const r = MED_REGISTRY['aristada'].getLateGuidance({ daysSince: 70, dose: '662' });
        expect(r.idealSteps.some((s) => s.includes('7 days'))).toBe(true);
    });

    it('dose used as variantKey for Aristada 1064 (no-supp tier at 60 days)', () => {
        const r = MED_REGISTRY['aristada'].getLateGuidance({ daysSince: 60, dose: '1064' });
        expect(r.idealSteps.some((s) => s.includes('No supplementation required'))).toBe(true);
    });

    // 3. dose does NOT match a variant key → falls back to 'default' (Uzedy)
    it('falls back to "default" when dose does not match any variant key (Uzedy "150-or-less")', () => {
        // Uzedy only has a "default" variant; "150-or-less" is a guidanceByDoseRules value, not a variant key
        const r = MED_REGISTRY['uzedy'].getLateGuidance({ daysSince: 200, dose: '150-or-less' });
        expect(r.idealSteps.some((s) => s.includes('150 mg or less'))).toBe(true);
    });

    it('falls back to "default" for Uzedy "200-or-more" (not a variant key)', () => {
        const r = MED_REGISTRY['uzedy'].getLateGuidance({ daysSince: 200, dose: '200-or-more' });
        // tier 3 is static — 200-or-more falls back to "default" and gets the same content as 150-or-less
        expect(r.idealSteps.some((s) => s.includes('150 mg or less'))).toBe(true);
    });

    // 4. neither variant nor dose → 'default' used (single-variant med)
    it('uses "default" variant when neither variant nor dose is provided (Invega Hafyera)', () => {
        const r = MED_REGISTRY['invega_hafyera'].getLateGuidance({ daysSince: 220 });
        expect(r.idealSteps.length).toBeGreaterThan(0);
    });

    // 5. unknown variant key → throws with descriptive message
    it('throws a descriptive error for an unknown explicit variant', () => {
        expect(() =>
            MED_REGISTRY['abilify_maintena'].getLateGuidance({
                daysSince: 30,
                variant: 'bad-group',
            }),
        ).toThrow(/Unknown variant key.*bad-group/);
    });

    it('throws when unrecognised dose falls back to "default" but no "default" key exists (Aristada)', () => {
        // Aristada has no "default" variant (only "441", "662", "882", "1064")
        // Unrecognised dose → variantKey resolves to "default" → not found → throws
        expect(() =>
            MED_REGISTRY['aristada'].getLateGuidance({ daysSince: 30, dose: 'bad-dose' }),
        ).toThrow(/Unknown variant key.*default/);
    });

    it('throw message lists all available variant keys', () => {
        try {
            MED_REGISTRY['abilify_maintena'].getLateGuidance({
                daysSince: 30,
                variant: 'bad-group',
            });
            expect.fail('should have thrown');
        } catch (e: unknown) {
            const msg = (e as Error).message;
            expect(msg).toContain('1-2');
            expect(msg).toContain('3+');
        }
    });
});

describe('buildCoreDef — sameAs variant deduplication', () => {
    // Aristada 882 is declared as sameAs: "662" — shares the same LateTier[] reference
    it('882 and 662 produce identical idealSteps (sameAs deduplication)', () => {
        const r662 = MED_REGISTRY['aristada'].getLateGuidance({ daysSince: 70, dose: '662' });
        const r882 = MED_REGISTRY['aristada'].getLateGuidance({ daysSince: 70, dose: '882' });
        expect(r882.idealSteps).toEqual(r662.idealSteps);
    });

    it('882 and 662 share tier boundaries at 56 days (no-supp window tier)', () => {
        const r662 = MED_REGISTRY['aristada'].getLateGuidance({ daysSince: 56, dose: '662' });
        const r882 = MED_REGISTRY['aristada'].getLateGuidance({ daysSince: 56, dose: '882' });
        expect(r882.idealSteps).toEqual(r662.idealSteps);
    });

    it('882 and 662 share tier boundaries at 57 days (7-day supp tier)', () => {
        const r662 = MED_REGISTRY['aristada'].getLateGuidance({ daysSince: 57, dose: '662' });
        const r882 = MED_REGISTRY['aristada'].getLateGuidance({ daysSince: 57, dose: '882' });
        expect(r882.idealSteps).toEqual(r662.idealSteps);
    });

    it('882 and 662 share tier boundaries at 90 days (21-day supp tier)', () => {
        const r662 = MED_REGISTRY['aristada'].getLateGuidance({ daysSince: 90, dose: '662' });
        const r882 = MED_REGISTRY['aristada'].getLateGuidance({ daysSince: 90, dose: '882' });
        expect(r882.idealSteps).toEqual(r662.idealSteps);
    });

    it('sameAs resolved regardless of JSON order — 882 correctly aliases 662 tiers', () => {
        // buildVariantMap processes own-tiers first, then sameAs, so 662 always exists when 882 aliases it
        const r = MED_REGISTRY['aristada'].getLateGuidance({ daysSince: 90, dose: '882' });
        expect(r.idealSteps.length).toBeGreaterThan(0);
    });
});

// ─── buildCoreDef — earlyParamField / earlyDateField / earlyVariantMap ────────

describe('buildCoreDef — earlyVariantMap (Brixadi)', () => {
    it('earlyParamField is set from earlySpec.paramField', () => {
        expect(MED_REGISTRY['brixadi'].earlyParamField).toBe('brixadi-type');
    });

    it('earlyDateField is set from earlySpec.dateField', () => {
        expect(MED_REGISTRY['brixadi'].earlyDateField).toBe('last-brixadi');
    });

    it('earlyVariantMap is populated for all four Brixadi variants', () => {
        const vm = MED_REGISTRY['brixadi'].earlyVariantMap!;
        expect(vm).toBeDefined();
        expect(Object.keys(vm)).toEqual(
            expect.arrayContaining(['monthly-64', 'monthly-96', 'monthly-128', 'weekly']),
        );
    });

    it('monthly-64 variant has minDays matching JSON', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const monthly64 = (earlyOf('brixadi').variants as any[]).find((v) => v.key === 'monthly-64');
        expect(MED_REGISTRY['brixadi'].earlyVariantMap!['monthly-64'].minDays).toBe(monthly64.minDays);
    });

    it('monthly-96 sameAs monthly-64: still has minDays matching JSON', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const monthly64 = (earlyOf('brixadi').variants as any[]).find((v) => v.key === 'monthly-64');
        expect(MED_REGISTRY['brixadi'].earlyVariantMap!['monthly-96'].minDays).toBe(monthly64.minDays);
    });

    it('monthly-128 sameAs monthly-64: still has minDays matching JSON', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const monthly64 = (earlyOf('brixadi').variants as any[]).find((v) => v.key === 'monthly-64');
        expect(MED_REGISTRY['brixadi'].earlyVariantMap!['monthly-128'].minDays).toBe(monthly64.minDays);
    });

    it('monthly-96 and monthly-64 share the same object reference (sameAs deduplication)', () => {
        const vm = MED_REGISTRY['brixadi'].earlyVariantMap!;
        expect(vm['monthly-96']).toBe(vm['monthly-64']);
        expect(vm['monthly-128']).toBe(vm['monthly-64']);
    });

    it('weekly variant has minDays matching JSON', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const weeklyJson = (earlyOf('brixadi').variants as any[]).find((v) => v.key === 'weekly');
        expect(MED_REGISTRY['brixadi'].earlyVariantMap!['weekly'].minDays).toBe(weeklyJson.minDays);
    });

    it('earlyParamField and earlyVariantMap are absent for non-variant-aware meds', () => {
        expect(MED_REGISTRY['abilify_maintena'].earlyParamField).toBeUndefined();
        expect(MED_REGISTRY['abilify_maintena'].earlyVariantMap).toBeUndefined();
        expect(MED_REGISTRY['sublocade'].earlyParamField).toBeUndefined();
        expect(MED_REGISTRY['uzedy'].earlyParamField).toBeUndefined();
    });

    // ── earlySharedNotes / variant guidanceNote ───────────────────────────────

    it('earlySharedNotes is absent when early has no top-level guidanceNote (brixadi)', () => {
        expect(MED_REGISTRY['brixadi'].earlySharedNotes).toBeUndefined();
    });

    it('earlySharedNotes is absent for meds with no early.guidanceNote', () => {
        expect(MED_REGISTRY['abilify_maintena'].earlySharedNotes).toBeUndefined();
        expect(MED_REGISTRY['invega_trinza'].earlySharedNotes).toBeUndefined();
    });

    it('monthly-64 variant has variant-specific guidanceNote', () => {
        const vm = MED_REGISTRY['brixadi'].earlyVariantMap!;
        expect(vm['monthly-64'].guidanceNote).toEqual([
            'This may be given earlier with provider approval; consult provider if wanting to give earlier',
        ]);
    });

    it('weekly variant has its own guidanceNote', () => {
        const vm = MED_REGISTRY['brixadi'].earlyVariantMap!;
        expect(vm['weekly'].guidanceNote).toEqual([
            'This may be given earlier with provider approval; consult provider if wanting to give earlier',
        ]);
    });

    it('weekly variant has minDays matching JSON', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const weeklyJson = (earlyOf('brixadi').variants as any[]).find((v) => v.key === 'weekly');
        expect(MED_REGISTRY['brixadi'].earlyVariantMap!['weekly'].minDays).toBe(weeklyJson.minDays);
    });
});
