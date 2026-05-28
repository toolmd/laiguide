import { describe, it, expect } from 'vitest';
import { MED_REGISTRY } from '../medLoader';
import type { GuidanceResult } from '../interfaces/guidance';
import { hasNotif, localDaysAgo } from './helpers';

function getGuidance(days: number, variant: string): GuidanceResult {
    return MED_REGISTRY['vivitrol'].getLateGuidance({ daysSince: days, variant }) as GuidanceResult;
}

describe('vivitrol getLateGuidance', () => {
    // ── OUD — 5 tiers ─────────────────────────────────────────────────────────
    describe('OUD — 5 tiers', () => {
        it('≤20 days: not yet overdue', () => {
            const r = getGuidance(20, 'oud');
            expect(r.idealSteps.some((s) => s.includes('not yet overdue'))).toBe(true);
            expect(r.providerNotifications).toBeUndefined();
        });

        it('21–28 days: administer, no UDS required', () => {
            const r = getGuidance(25, 'oud');
            expect(r.idealSteps.some((s) => s.includes('Administer Vivitrol 380 mg'))).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('No urine drug screen required'))).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('minimal or no fentanyl dependence'))).toBe(
                true,
            );
            expect(r.providerNotifications).toBeUndefined();
        });

        it('29–35 days: conditional on intentional fentanyl use report', () => {
            const r = getGuidance(31, 'oud');
            expect(r.idealSteps.some((s) => s.includes('NO intentional fentanyl use'))).toBe(true);
            expect(
                r.idealSteps.some((s) => s.includes('intentional fentanyl use IS reported')),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('point-of-care urine drug screen'))).toBe(true);
            expect(hasNotif(r.providerNotifications, 'Consult provider if the urine drug screen is positive')).toBe(
                true,
            );
        });

        it('36–56 days: UDS required before administering', () => {
            const r = getGuidance(45, 'oud');
            expect(r.idealSteps.some((s) => s.includes('point-of-care urine drug screen'))).toBe(
                true,
            );
            expect(r.idealSteps.some((s) => s.includes('UDS negative'))).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('UDS positive'))).toBe(true);
            expect(
                hasNotif(r.providerNotifications, 'Consult provider if unable to obtain UDS'),
            ).toBe(true);
        });

        it('57+ days: consult provider, injection overdue', () => {
            const r = getGuidance(65, 'oud');
            expect(
                r.idealSteps.some((s) =>
                    s.includes('Consult provider before administering Vivitrol'),
                ),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('more than 8 weeks overdue'))).toBe(true);
            expect(hasNotif(r.providerNotifications, 'Consult provider before any injection')).toBe(
                true,
            );
        });

        it('exact tier boundaries: 20/21, 28/29, 35/36, 56/57', () => {
            expect(
                getGuidance(20, 'oud').idealSteps.some((s) => s.includes('not yet overdue')),
            ).toBe(true);
            expect(
                getGuidance(21, 'oud').idealSteps.some((s) => s.includes('No urine drug screen required')),
            ).toBe(true);
            expect(
                getGuidance(28, 'oud').idealSteps.some((s) => s.includes('No urine drug screen required')),
            ).toBe(true);
            expect(
                getGuidance(29, 'oud').idealSteps.some((s) => s.includes('intentional fentanyl')),
            ).toBe(true);
            expect(
                getGuidance(35, 'oud').idealSteps.some((s) => s.includes('intentional fentanyl')),
            ).toBe(true);
            expect(
                getGuidance(36, 'oud').idealSteps.some((s) =>
                    s.includes('point-of-care urine drug screen'),
                ),
            ).toBe(true);
            expect(
                getGuidance(56, 'oud').idealSteps.some((s) =>
                    s.includes('point-of-care urine drug screen'),
                ),
            ).toBe(true);
            expect(
                getGuidance(57, 'oud').idealSteps.some((s) =>
                    s.includes('Consult provider before administering'),
                ),
            ).toBe(true);
        });
    });

    // ── Overdose prevention — 5 tiers ─────────────────────────────────────────
    describe('overdose prevention — 5 tiers', () => {
        it('≤20 days: not yet overdue', () => {
            const r = getGuidance(10, 'overdose-prevention');
            expect(r.idealSteps.some((s) => s.includes('not yet overdue'))).toBe(true);
            expect(r.providerNotifications).toBeUndefined();
        });

        it('21–34 days: administer if no daily opioid use, no UDS required', () => {
            const r = getGuidance(25, 'overdose-prevention');
            expect(
                r.idealSteps.some((s) => s.includes('no intentional daily use of opioids')),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('No UDS required'))).toBe(true);
            expect(
                hasNotif(
                    r.providerNotifications,
                    'Consult provider if patient has regular opioid use',
                ),
            ).toBe(true);
        });

        it('35–41 days: UDS unless confident, conditional administration', () => {
            const r = getGuidance(38, 'overdose-prevention');
            expect(r.idealSteps.some((s) => s.includes('unless you have strong confidence'))).toBe(
                true,
            );
            expect(r.idealSteps.some((s) => s.includes('UDS negative'))).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('UDS positive'))).toBe(true);
            expect(hasNotif(r.providerNotifications, 'Consult provider if UDS positive')).toBe(
                true,
            );
        });

        it('42–56 days: UDS required before administering', () => {
            const r = getGuidance(48, 'overdose-prevention');
            expect(r.idealSteps.some((s) => s.includes('point-of-care urine drug screen'))).toBe(
                true,
            );
            expect(r.idealSteps.some((s) => s.includes('UDS negative'))).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('UDS positive'))).toBe(true);
            expect(
                hasNotif(r.providerNotifications, 'Consult provider if unable to obtain UDS'),
            ).toBe(true);
        });

        it('57+ days: consult provider, injection overdue', () => {
            const r = getGuidance(65, 'overdose-prevention');
            expect(
                r.idealSteps.some((s) =>
                    s.includes('Consult provider before administering Vivitrol'),
                ),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('more than 8 weeks overdue'))).toBe(true);
            expect(hasNotif(r.providerNotifications, 'Consult provider before any injection')).toBe(
                true,
            );
        });

        it('exact tier boundaries: 20/21, 34/35, 41/42, 56/57', () => {
            expect(
                getGuidance(20, 'overdose-prevention').idealSteps.some((s) =>
                    s.includes('not yet overdue'),
                ),
            ).toBe(true);
            expect(
                getGuidance(21, 'overdose-prevention').idealSteps.some((s) =>
                    s.includes('no intentional daily use'),
                ),
            ).toBe(true);
            expect(
                getGuidance(34, 'overdose-prevention').idealSteps.some((s) =>
                    s.includes('no intentional daily use'),
                ),
            ).toBe(true);
            expect(
                getGuidance(35, 'overdose-prevention').idealSteps.some((s) =>
                    s.includes('unless you have strong confidence'),
                ),
            ).toBe(true);
            expect(
                getGuidance(41, 'overdose-prevention').idealSteps.some((s) =>
                    s.includes('unless you have strong confidence'),
                ),
            ).toBe(true);
            expect(
                getGuidance(42, 'overdose-prevention').idealSteps.some((s) =>
                    s.includes('point-of-care urine drug screen'),
                ),
            ).toBe(true);
            expect(
                getGuidance(56, 'overdose-prevention').idealSteps.some((s) =>
                    s.includes('point-of-care urine drug screen'),
                ),
            ).toBe(true);
            expect(
                getGuidance(57, 'overdose-prevention').idealSteps.some((s) =>
                    s.includes('Consult provider before administering'),
                ),
            ).toBe(true);
        });
    });

    // ── Date-derived params (buildLateParams) ─────────────────────────────────
    describe('date-derived boundaries (via buildLateParams)', () => {
        const entry = MED_REGISTRY['vivitrol'];

        it('OUD: day 20 → not due; day 21 → administer; day 29 → conditional; day 36 → UDS; day 57 → consult', () => {
            const g = (d: number) =>
                entry.getLateGuidance(
                    entry.buildLateParams({
                        'last-vivitrol': localDaysAgo(d),
                        'vivitrol-indication': 'oud',
                    }),
                ) as GuidanceResult;
            expect(g(20).idealSteps.some((s) => s.includes('not yet overdue'))).toBe(true);
            expect(g(21).idealSteps.some((s) => s.includes('No urine drug screen required'))).toBe(true);
            expect(g(29).idealSteps.some((s) => s.includes('intentional fentanyl'))).toBe(true);
            expect(
                g(36).idealSteps.some((s) => s.includes('point-of-care urine drug screen')),
            ).toBe(true);
            expect(
                g(57).idealSteps.some((s) => s.includes('Consult provider before administering')),
            ).toBe(true);
        });

        it('overdose-prevention: day 34 → no UDS; day 35 → conditional UDS; day 42 → UDS required; day 57 → consult', () => {
            const g = (d: number) =>
                entry.getLateGuidance(
                    entry.buildLateParams({
                        'last-vivitrol': localDaysAgo(d),
                        'vivitrol-indication': 'overdose-prevention',
                    }),
                ) as GuidanceResult;
            expect(g(34).idealSteps.some((s) => s.includes('no intentional daily use'))).toBe(true);
            expect(
                g(35).idealSteps.some((s) => s.includes('unless you have strong confidence')),
            ).toBe(true);
            expect(
                g(42).idealSteps.some((s) => s.includes('point-of-care urine drug screen')),
            ).toBe(true);
            expect(
                g(57).idealSteps.some((s) => s.includes('Consult provider before administering')),
            ).toBe(true);
        });

        it('variant is captured correctly in params', () => {
            const p = entry.buildLateParams({
                'last-vivitrol': localDaysAgo(25),
                'vivitrol-indication': 'overdose-prevention',
            });
            expect(p.variant).toBe('overdose-prevention');
        });

        it('validates: missing date field', () => {
            expect(entry.validateLate({ 'vivitrol-indication': 'oud' })).toMatch(/date/i);
        });

        it('validates: missing indication field', () => {
            expect(entry.validateLate({ 'last-vivitrol': localDaysAgo(30) })).toMatch(
                /indication/i,
            );
        });

        it('validates: both fields present → null', () => {
            expect(
                entry.validateLate({
                    'last-vivitrol': localDaysAgo(30),
                    'vivitrol-indication': 'oud',
                }),
            ).toBeNull();
        });
    });
});
