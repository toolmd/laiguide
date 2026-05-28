import { describe, it, expect } from 'vitest';
import { MED_REGISTRY } from '../medLoader';
import type { GuidanceResult } from '../interfaces/guidance';
import { hasNotif, localDaysAgo } from './helpers';

function getBrixadiGuidance(days: number, variant: string): GuidanceResult {
    return MED_REGISTRY['brixadi'].getLateGuidance({ daysSince: days, variant }) as GuidanceResult;
}

describe('getBrixadiGuidance', () => {
    describe('monthly (64/96/128 mg) — 5 tiers', () => {
        it('≤20 days: not yet overdue', () => {
            const r = getBrixadiGuidance(20, 'monthly-64');
            expect(r.idealSteps.some((s) => s.includes('not yet overdue'))).toBe(true);
            expect(r.providerNotifications).toBeUndefined();
        });

        it('21–35 days: administer regardless', () => {
            const r = getBrixadiGuidance(30, 'monthly-64');
            expect(r.idealSteps.some((s) => s.includes('Administer the next injection'))).toBe(
                true,
            );
            expect(
                r.idealSteps.some((s) =>
                    s.includes('regardless of the level of unregulated opioid use'),
                ),
            ).toBe(true);
            expect(r.providerNotifications).toBeUndefined();
        });

        it('36–42 days: fentanyl assessment (moderate dependence OK)', () => {
            const r = getBrixadiGuidance(38, 'monthly-64');
            expect(
                r.idealSteps.some((s) => s.includes('Conduct a fentanyl dependence assessment')),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(true);
            expect(
                hasNotif(r.providerNotifications, 'Consult prescriber if patient does not meet'),
            ).toBe(true);
        });

        it('43–56 days: fentanyl assessment (must meet criteria or 8 mg subl)', () => {
            const r = getBrixadiGuidance(50, 'monthly-64');
            expect(
                r.idealSteps.some((s) => s.includes('Conduct a fentanyl dependence assessment')),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(
                false,
            );
            expect(
                r.idealSteps.some((s) =>
                    s.includes('8 mg of sublingual buprenorphine in the last 24 hours'),
                ),
            ).toBe(true);
            expect(
                hasNotif(
                    r.providerNotifications,
                    'Consult prescriber if patient does not meet minimal/no fentanyl dependence',
                ),
            ).toBe(true);
        });

        it('56+ days: consult prescriber in real-time', () => {
            const r = getBrixadiGuidance(70, 'monthly-64');
            expect(r.idealSteps.some((s) => s.includes('Consult a prescriber in real-time'))).toBe(
                true,
            );
            expect(
                hasNotif(r.providerNotifications, 'Consult prescriber before any injection'),
            ).toBe(true);
        });

        it('exact tier boundaries: 20/21, 35/36, 42/43, 56/57', () => {
            expect(
                getBrixadiGuidance(20, 'monthly-64').idealSteps.some((s) =>
                    s.includes('not yet overdue'),
                ),
            ).toBe(true);
            expect(
                getBrixadiGuidance(21, 'monthly-64').idealSteps.some((s) =>
                    s.includes('Administer the next injection'),
                ),
            ).toBe(true);
            expect(
                getBrixadiGuidance(35, 'monthly-64').idealSteps.some((s) =>
                    s.includes('Administer the next injection'),
                ),
            ).toBe(true);
            expect(
                getBrixadiGuidance(36, 'monthly-64').idealSteps.some((s) =>
                    s.includes('moderate fentanyl dependence'),
                ),
            ).toBe(true);
            expect(
                getBrixadiGuidance(42, 'monthly-64').idealSteps.some((s) =>
                    s.includes('moderate fentanyl dependence'),
                ),
            ).toBe(true);
            expect(
                getBrixadiGuidance(43, 'monthly-64').idealSteps.some((s) =>
                    s.includes('moderate fentanyl dependence'),
                ),
            ).toBe(false);
            expect(
                getBrixadiGuidance(56, 'monthly-64').idealSteps.some((s) =>
                    s.includes('8 mg of sublingual buprenorphine in the last 24 hours'),
                ),
            ).toBe(true);
            expect(
                getBrixadiGuidance(57, 'monthly-64').idealSteps.some((s) =>
                    s.includes('Consult a prescriber in real-time'),
                ),
            ).toBe(true);
        });

        it('monthly-96 and monthly-128 use same tiers as monthly-64 (sameAs)', () => {
            const r64 = getBrixadiGuidance(30, 'monthly-64');
            const r96 = getBrixadiGuidance(30, 'monthly-96');
            const r128 = getBrixadiGuidance(30, 'monthly-128');
            expect(r96.idealSteps).toEqual(r64.idealSteps);
            expect(r128.idealSteps).toEqual(r64.idealSteps);
        });
    });

    describe('weekly (24 mg / 32 mg) — 3 tiers', () => {
        it('≤5 days: not yet due', () => {
            const r = getBrixadiGuidance(5, 'weekly');
            expect(r.idealSteps.some((s) => s.includes('not yet due'))).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('early administration guidance'))).toBe(
                true,
            );
            expect(r.providerNotifications).toBeUndefined();
        });

        it('7–9 days: administer per standing order', () => {
            const r = getBrixadiGuidance(8, 'weekly');
            expect(
                r.idealSteps.some((s) => s.includes('Administer the weekly Brixadi injection')),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('9 days'))).toBe(true);
        });

        it('10+ days: prescriber guidance required', () => {
            const r = getBrixadiGuidance(15, 'weekly');
            expect(r.idealSteps.some((s) => s.includes('more than 9 days overdue'))).toBe(true);
            expect(hasNotif(r.providerNotifications, 'Contact prescriber for guidance')).toBe(true);
        });

        it('exact boundaries: day 5/6 and day 9/10', () => {
            expect(
                getBrixadiGuidance(5, 'weekly').idealSteps.some((s) => s.includes('not yet due')),
            ).toBe(true);
            expect(
                getBrixadiGuidance(6, 'weekly').idealSteps.some((s) =>
                    s.includes('Administer the weekly Brixadi injection'),
                ),
            ).toBe(true);
            expect(
                getBrixadiGuidance(9, 'weekly').idealSteps.some((s) =>
                    s.includes('Administer the weekly Brixadi injection'),
                ),
            ).toBe(true);
            expect(
                getBrixadiGuidance(10, 'weekly').idealSteps.some((s) =>
                    s.includes('more than 9 days overdue'),
                ),
            ).toBe(true);
        });
    });

    describe('date-derived boundaries (via buildLateParams)', () => {
        const entry = MED_REGISTRY['brixadi'];

        it('monthly-64: day 20 → not due; day 21 → administer; day 36 → fentanyl assessment; day 57 → prescriber', () => {
            const p20 = entry.buildLateParams({
                'last-brixadi': localDaysAgo(20),
                'brixadi-type': 'monthly-64',
            });
            const p21 = entry.buildLateParams({
                'last-brixadi': localDaysAgo(21),
                'brixadi-type': 'monthly-64',
            });
            const p36 = entry.buildLateParams({
                'last-brixadi': localDaysAgo(36),
                'brixadi-type': 'monthly-64',
            });
            const p57 = entry.buildLateParams({
                'last-brixadi': localDaysAgo(57),
                'brixadi-type': 'monthly-64',
            });
            expect(
                (entry.getLateGuidance(p20) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('not yet overdue'),
                ),
            ).toBe(true);
            expect(
                (entry.getLateGuidance(p21) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('Administer the next injection'),
                ),
            ).toBe(true);
            expect(
                (entry.getLateGuidance(p36) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('Conduct a fentanyl dependence assessment'),
                ),
            ).toBe(true);
            expect(
                (entry.getLateGuidance(p57) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('Consult a prescriber in real-time'),
                ),
            ).toBe(true);
        });

        it('weekly: day 5 → not due; day 6 → administer; day 10 → prescriber guidance', () => {
            const p6 = entry.buildLateParams({
                'last-brixadi': localDaysAgo(5),
                'brixadi-type': 'weekly',
            });
            const p7 = entry.buildLateParams({
                'last-brixadi': localDaysAgo(6),
                'brixadi-type': 'weekly',
            });
            const p10 = entry.buildLateParams({
                'last-brixadi': localDaysAgo(10),
                'brixadi-type': 'weekly',
            });
            expect(
                (entry.getLateGuidance(p6) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('not yet due'),
                ),
            ).toBe(true);
            expect(
                (entry.getLateGuidance(p7) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('Administer the weekly Brixadi injection'),
                ),
            ).toBe(true);
            expect(
                (entry.getLateGuidance(p10) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('more than 9 days overdue'),
                ),
            ).toBe(true);
        });

        // ── monthly-64: all 5 exact tier boundaries ──────────────────────
        it('monthly-64: exact boundary day 35 → still "administer regardless" (maxDays=35)', () => {
            const p = entry.buildLateParams({
                'last-brixadi': localDaysAgo(35),
                'brixadi-type': 'monthly-64',
            });
            expect(p.daysSince).toBe(35);
            expect(
                (entry.getLateGuidance(p) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('Administer the next injection'),
                ),
            ).toBe(true);
        });

        it('monthly-64: exact boundary day 36 → fentanyl assessment with moderate OK (first day of tier 3)', () => {
            const p = entry.buildLateParams({
                'last-brixadi': localDaysAgo(36),
                'brixadi-type': 'monthly-64',
            });
            expect(p.daysSince).toBe(36);
            expect(
                (entry.getLateGuidance(p) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('moderate fentanyl dependence'),
                ),
            ).toBe(true);
        });

        it('monthly-64: exact boundary day 42 → still fentanyl assessment with moderate OK (maxDays=42)', () => {
            const p = entry.buildLateParams({
                'last-brixadi': localDaysAgo(42),
                'brixadi-type': 'monthly-64',
            });
            expect(p.daysSince).toBe(42);
            expect(
                (entry.getLateGuidance(p) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('moderate fentanyl dependence'),
                ),
            ).toBe(true);
        });

        it('monthly-64: exact boundary day 43 → stricter fentanyl assessment, no moderate-OK (first day of tier 4)', () => {
            const p = entry.buildLateParams({
                'last-brixadi': localDaysAgo(43),
                'brixadi-type': 'monthly-64',
            });
            expect(p.daysSince).toBe(43);
            const r = entry.getLateGuidance(p) as GuidanceResult;
            expect(
                r.idealSteps.some((s) =>
                    s.includes('8 mg of sublingual buprenorphine in the last 24 hours'),
                ),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(
                false,
            );
        });

        it('monthly-64: exact boundary day 56 → still stricter assessment (maxDays=56)', () => {
            const p = entry.buildLateParams({
                'last-brixadi': localDaysAgo(56),
                'brixadi-type': 'monthly-64',
            });
            expect(p.daysSince).toBe(56);
            expect(
                (entry.getLateGuidance(p) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('8 mg of sublingual buprenorphine in the last 24 hours'),
                ),
            ).toBe(true);
        });

        it('monthly-64: exact boundary day 57 → consult prescriber in real-time (first day of tier 5)', () => {
            const p = entry.buildLateParams({
                'last-brixadi': localDaysAgo(57),
                'brixadi-type': 'monthly-64',
            });
            expect(p.daysSince).toBe(57);
            expect(
                (entry.getLateGuidance(p) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('Consult a prescriber in real-time'),
                ),
            ).toBe(true);
        });

        // ── monthly-96 sameAs monthly-64: all 5 boundaries ───────────────
        it('monthly-96: exact boundaries 20/21, 35/36, 42/43, 56/57', () => {
            const g = (d: number) =>
                entry.getLateGuidance(
                    entry.buildLateParams({
                        'last-brixadi': localDaysAgo(d),
                        'brixadi-type': 'monthly-96',
                    }),
                ) as GuidanceResult;
            expect(g(20).idealSteps.some((s) => s.includes('not yet overdue'))).toBe(true);
            expect(g(21).idealSteps.some((s) => s.includes('Administer the next injection'))).toBe(
                true,
            );
            expect(g(35).idealSteps.some((s) => s.includes('Administer the next injection'))).toBe(
                true,
            );
            expect(g(36).idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(
                true,
            );
            expect(g(42).idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(
                true,
            );
            expect(g(43).idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(
                false,
            );
            expect(
                g(56).idealSteps.some((s) =>
                    s.includes('8 mg of sublingual buprenorphine in the last 24 hours'),
                ),
            ).toBe(true);
            expect(
                g(57).idealSteps.some((s) => s.includes('Consult a prescriber in real-time')),
            ).toBe(true);
        });

        // ── monthly-128 sameAs monthly-64: all 5 boundaries ──────────────
        it('monthly-128: exact boundaries 20/21, 35/36, 42/43, 56/57', () => {
            const g = (d: number) =>
                entry.getLateGuidance(
                    entry.buildLateParams({
                        'last-brixadi': localDaysAgo(d),
                        'brixadi-type': 'monthly-128',
                    }),
                ) as GuidanceResult;
            expect(g(20).idealSteps.some((s) => s.includes('not yet overdue'))).toBe(true);
            expect(g(21).idealSteps.some((s) => s.includes('Administer the next injection'))).toBe(
                true,
            );
            expect(g(35).idealSteps.some((s) => s.includes('Administer the next injection'))).toBe(
                true,
            );
            expect(g(36).idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(
                true,
            );
            expect(g(42).idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(
                true,
            );
            expect(g(43).idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(
                false,
            );
            expect(
                g(56).idealSteps.some((s) =>
                    s.includes('8 mg of sublingual buprenorphine in the last 24 hours'),
                ),
            ).toBe(true);
            expect(
                g(57).idealSteps.some((s) => s.includes('Consult a prescriber in real-time')),
            ).toBe(true);
        });

        // ── weekly: all 3 boundaries including day 9 ─────────────────────
        it('weekly: exact boundary day 9 → still administerable (maxDays=9)', () => {
            const p = entry.buildLateParams({
                'last-brixadi': localDaysAgo(9),
                'brixadi-type': 'weekly',
            });
            expect(p.daysSince).toBe(9);
            expect(
                (entry.getLateGuidance(p) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('Administer the weekly Brixadi injection'),
                ),
            ).toBe(true);
        });

        it('weekly: exact boundary day 10 → prescriber guidance required (first day of tier 3)', () => {
            const p = entry.buildLateParams({
                'last-brixadi': localDaysAgo(10),
                'brixadi-type': 'weekly',
            });
            expect(p.daysSince).toBe(10);
            expect(
                (entry.getLateGuidance(p) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('more than 9 days overdue'),
                ),
            ).toBe(true);
        });
    });
});

// ─── getBrixadiGuidance — buildLateInfoRows ──────────────────────────────────

describe('getBrixadiGuidance — buildLateInfoRows', () => {
    const entry = MED_REGISTRY['brixadi'];

    function infoRows(dateField: string, typeField: string, days: number) {
        return entry.buildLateInfoRows(
            { 'last-brixadi': dateField, 'brixadi-type': typeField },
            days,
        );
    }

    function findRow(rows: [string, string][], label: string): string {
        const row = rows.find(([l]) => l === label);
        if (!row) throw new Error(`Row "${label}" not found`);
        return row[1];
    }

    describe('Formulation/dose — option-label format', () => {
        it('monthly-64 maps to "Monthly 64 mg"', () => {
            const rows = infoRows('2026-01-15', 'monthly-64', 30);
            expect(findRow(rows, 'Formulation/dose:')).toBe('Monthly 64 mg');
        });

        it('monthly-96 maps to "Monthly 96 mg"', () => {
            const rows = infoRows('2026-01-15', 'monthly-96', 30);
            expect(findRow(rows, 'Formulation/dose:')).toBe('Monthly 96 mg');
        });

        it('monthly-128 maps to "Monthly 128 mg"', () => {
            const rows = infoRows('2026-01-15', 'monthly-128', 30);
            expect(findRow(rows, 'Formulation/dose:')).toBe('Monthly 128 mg');
        });

        it('weekly maps to "Weekly 24 mg or 32 mg"', () => {
            const rows = infoRows('2026-01-15', 'weekly', 8);
            expect(findRow(rows, 'Formulation/dose:')).toBe('Weekly 24 mg or 32 mg');
        });
    });

    describe('Date of last injection — date format', () => {
        it('formats ISO date as localised long date string', () => {
            const rows = infoRows('2026-03-01', 'monthly-64', 15);
            expect(findRow(rows, 'Date of last injection:')).toBe('March 1, 2026');
        });

        it('formats a date mid-year correctly', () => {
            const rows = infoRows('2025-07-04', 'monthly-64', 30);
            expect(findRow(rows, 'Date of last injection:')).toBe('July 4, 2025');
        });

        it('no UTC off-by-one: day entered matches day displayed', () => {
            // Using a fixed date that is unambiguous regardless of timezone
            const rows = infoRows('2026-01-31', 'weekly', 5);
            expect(findRow(rows, 'Date of last injection:')).toBe('January 31, 2026');
        });
    });

    describe('Time since last injection — days-weeks format', () => {
        it('0 days → "0 days" (no parenthetical)', () => {
            const rows = infoRows('2026-01-01', 'monthly-64', 0);
            expect(findRow(rows, 'Time since last injection:')).toBe('0 days');
        });

        it('1 day → "1 day" (singular, no parenthetical)', () => {
            const rows = infoRows('2026-01-01', 'monthly-64', 1);
            expect(findRow(rows, 'Time since last injection:')).toBe('1 day');
        });

        it('6 days → "6 days" (no duplicate parenthetical)', () => {
            const rows = infoRows('2026-01-01', 'monthly-64', 6);
            expect(findRow(rows, 'Time since last injection:')).toBe('6 days');
        });

        it('7 days → "7 days (1 week)"', () => {
            const rows = infoRows('2026-01-01', 'monthly-64', 7);
            expect(findRow(rows, 'Time since last injection:')).toBe('7 days (1 week)');
        });

        it('21 days → "21 days (3 weeks)"', () => {
            const rows = infoRows('2026-01-01', 'monthly-64', 21);
            expect(findRow(rows, 'Time since last injection:')).toBe('21 days (3 weeks)');
        });

        it('35 days → "35 days (5 weeks)"', () => {
            const rows = infoRows('2026-01-01', 'monthly-64', 35);
            expect(findRow(rows, 'Time since last injection:')).toBe('35 days (5 weeks)');
        });

        it('38 days → "38 days (5 weeks and 3 days)"', () => {
            const rows = infoRows('2026-01-01', 'monthly-64', 38);
            expect(findRow(rows, 'Time since last injection:')).toBe(
                '38 days (5 weeks and 3 days)',
            );
        });

        it('works identically for weekly variant', () => {
            const rows = infoRows('2026-01-01', 'weekly', 9);
            expect(findRow(rows, 'Time since last injection:')).toBe('9 days (1 week and 2 days)');
        });
    });

    describe('full row set structure', () => {
        it('monthly variant returns exactly 3 rows with the correct labels', () => {
            const rows = infoRows('2026-01-15', 'monthly-64', 30);
            const labels = rows.map(([l]) => l);
            expect(labels).toEqual([
                'Formulation/dose:',
                'Date of last injection:',
                'Time since last injection:',
            ]);
        });

        it('weekly variant returns exactly 3 rows with the correct labels', () => {
            const rows = infoRows('2026-01-15', 'weekly', 8);
            const labels = rows.map(([l]) => l);
            expect(labels).toEqual([
                'Formulation/dose:',
                'Date of last injection:',
                'Time since last injection:',
            ]);
        });
    });
});
