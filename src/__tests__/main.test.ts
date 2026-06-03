// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
    handleGuidanceTypeChange,
    handleSubGroupSelectorChange,
    handleSubmit,
    startOver,
} from '../ui/handlers';
import { initForm } from '../ui/formInit';
import { MED_REGISTRY } from '../medLoader';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _medJsons = import.meta.glob<any>('../meds/*.json', { eager: true, import: 'default' });
function earlyOf(key: string): { minDays?: number; daysBeforeDue?: number } {
    return (_medJsons[`../meds/${key}.json`] as { guidance?: { early?: { minDays?: number; daysBeforeDue?: number } } })?.guidance?.early ?? {};
}

// vitest 1.6+ provides a typed helper for mocking DOM globals
vi.stubGlobal('alert', vi.fn());
vi.stubGlobal('scrollTo', vi.fn());

// ─── jsdom stubs ──────────────────────────────────────────────────────────────

const HTML = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8');

test('DOM load includes protocol download link', () => {
    document.documentElement.innerHTML = HTML;
    const link = document.querySelector('.protocol-link a') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('./media/protocol.pdf');
    // HTML `download` can specify a user-friendly filename. ensure the
    // attribute reflects the desired name rather than the raw URL.
    expect(link?.getAttribute('download')).toBe('DESC LAI Protocol.pdf');
    expect(link?.textContent).toBe('document');
});

function setupDOM(): void {
    document.documentElement.innerHTML = HTML;
    initForm();
}

function setField(id: string, value: string): void {
    (document.getElementById(id) as HTMLInputElement | HTMLSelectElement).value = value;
}

function isVisible(id: string): boolean {
    return document.getElementById(id)!.style.display !== 'none';
}

/** Returns a YYYY-MM-DD string for a date N days in the past using local time (avoids UTC off-by-one). */
function daysAgo(n: number): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// ─── handleGuidanceTypeChange — field visibility ──────────────────────────────

describe('handleGuidanceTypeChange', () => {
    beforeEach(setupDOM);

    const medFields: [string, string][] = [
        ['invega_sustenna', 'invega-sustenna-options'],
        ['invega_trinza', 'trinza-fields'],
        ['invega_hafyera', 'hafyera-fields'],
        ['abilify_maintena', 'abilify-fields'],
        ['aristada', 'aristada-fields'],
        ['uzedy', 'uzedy-fields'],
    ];

    test.each(medFields)('%s + late → shows %s', (medication, fieldId) => {
        setField('medication', medication);
        setField('guidance-type', 'late');
        handleGuidanceTypeChange();
        expect(isVisible(fieldId)).toBe(true);
    });

    test.each(medFields)('%s + early → hides %s', (medication, fieldId) => {
        setField('medication', medication);
        setField('guidance-type', 'early');
        handleGuidanceTypeChange();
        expect(isVisible(fieldId)).toBe(false);
    });

    test('switching from invega_sustenna to another medication hides invega options', () => {
        setField('medication', 'invega_sustenna');
        setField('guidance-type', 'late');
        handleGuidanceTypeChange();
        expect(isVisible('invega-sustenna-options')).toBe(true);

        setField('medication', 'uzedy');
        handleGuidanceTypeChange();
        expect(isVisible('invega-sustenna-options')).toBe(false);
        expect(isVisible('uzedy-fields')).toBe(true);
    });

    test('vivitrol + late shows vivitrol-fields and hides all other med-specific field groups', () => {
        setField('medication', 'vivitrol');
        setField('guidance-type', 'late');
        handleGuidanceTypeChange();
        expect(isVisible('vivitrol-fields')).toBe(true);
        medFields.forEach(([, fieldId]) => {
            expect(isVisible(fieldId)).toBe(false);
        });
    });
});

// ─── handleSubGroupSelectorChange ────────────────────────────────────────────

describe('handleSubGroupSelectorChange', () => {
    beforeEach(() => {
        setupDOM();
        setField('medication', 'invega_sustenna');
    });

    test('initiation → shows first-injection-date, hides maintenance-fields', () => {
        setField('invega-type', 'initiation');
        handleSubGroupSelectorChange();
        expect(isVisible('first-injection-date')).toBe(true);
        expect(isVisible('maintenance-fields')).toBe(false);
    });

    test('maintenance → shows maintenance-fields, hides first-injection-date', () => {
        setField('invega-type', 'maintenance');
        handleSubGroupSelectorChange();
        expect(isVisible('maintenance-fields')).toBe(true);
        expect(isVisible('first-injection-date')).toBe(false);
    });

    test('switching from initiation to maintenance clears first-injection field', () => {
        setField('invega-type', 'initiation');
        handleSubGroupSelectorChange();
        setField('first-injection', daysAgo(10));

        setField('invega-type', 'maintenance');
        handleSubGroupSelectorChange();
        expect((document.getElementById('first-injection') as HTMLInputElement).value).toBe('');
    });

    test('switching from maintenance to initiation clears last-maintenance and dose fields', () => {
        setField('invega-type', 'maintenance');
        handleSubGroupSelectorChange();
        setField('last-maintenance', daysAgo(35));
        setField('maintenance-dose', '234');

        setField('invega-type', 'initiation');
        handleSubGroupSelectorChange();
        expect((document.getElementById('last-maintenance') as HTMLInputElement).value).toBe('');
        expect((document.getElementById('maintenance-dose') as HTMLSelectElement).value).toBe('');
    });
});

// ─── handleSubmit — form validation ──────────────────────────────────────────

describe('handleSubmit — validation', () => {
    beforeEach(() => {
        setupDOM();
        vi.mocked(window.alert).mockClear();
    });

    test('alerts when no medication selected', () => {
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith('Please select a medication.');
    });

    test('alerts when no guidance type selected', () => {
        setField('medication', 'uzedy');
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith('Please select a guidance type.');
    });

    test('invega_sustenna + late: alerts when no invega type selected', () => {
        setField('medication', 'invega_sustenna');
        setField('guidance-type', 'late');
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith(
            'Please select the Invega Sustenna injection type.',
        );
    });

    test('invega_sustenna + initiation: alerts when no date entered', () => {
        setField('medication', 'invega_sustenna');
        setField('guidance-type', 'late');
        setField('invega-type', 'initiation');
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith(
            'Please enter the date of first (234 mg) injection.',
        );
    });

    test('invega_sustenna + maintenance: alerts when no date entered', () => {
        setField('medication', 'invega_sustenna');
        setField('guidance-type', 'late');
        setField('invega-type', 'maintenance');
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith(
            'Please enter the date of last maintenance injection.',
        );
    });

    test('invega_sustenna + maintenance: alerts when no dose selected', () => {
        setField('medication', 'invega_sustenna');
        setField('guidance-type', 'late');
        setField('invega-type', 'maintenance');
        setField('last-maintenance', daysAgo(35));
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith(
            'Please select the monthly maintenance injection dose.',
        );
    });

    test('invega_trinza + late: alerts when no date entered', () => {
        setField('medication', 'invega_trinza');
        setField('guidance-type', 'late');
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith(
            'Please enter the date of last Trinza injection.',
        );
    });

    test('invega_trinza + late: alerts when no dose selected', () => {
        setField('medication', 'invega_trinza');
        setField('guidance-type', 'late');
        setField('last-trinza', daysAgo(100));
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith('Please select the Trinza injection dose.');
    });

    test('invega_hafyera + late: alerts when no date entered', () => {
        setField('medication', 'invega_hafyera');
        setField('guidance-type', 'late');
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith(
            'Please enter the date of last Hafyera injection.',
        );
    });

    test('abilify_maintena + late: alerts when no date entered', () => {
        setField('medication', 'abilify_maintena');
        setField('guidance-type', 'late');
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith(
            'Please enter the date of last Abilify Maintena injection.',
        );
    });

    test('abilify_maintena + late: alerts when no prior doses selected', () => {
        setField('medication', 'abilify_maintena');
        setField('guidance-type', 'late');
        setField('last-abilify', daysAgo(35));
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith(
            'Please select the number of prior consecutive monthly injections.',
        );
    });

    test('aristada + late: alerts when no date entered', () => {
        setField('medication', 'aristada');
        setField('guidance-type', 'late');
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith(
            'Please enter the date of last Aristada injection.',
        );
    });

    test('aristada + late: alerts when no dose selected', () => {
        setField('medication', 'aristada');
        setField('guidance-type', 'late');
        setField('last-aristada', daysAgo(50));
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith(
            'Please select the dose of last Aristada injection.',
        );
    });

    test('uzedy + late: alerts when no date entered', () => {
        setField('medication', 'uzedy');
        setField('guidance-type', 'late');
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith('Please enter the date of last Uzedy injection.');
    });

    test('uzedy + late: alerts when no dose selected', () => {
        setField('medication', 'uzedy');
        setField('guidance-type', 'late');
        setField('last-uzedy', daysAgo(35));
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith('Please select the Uzedy maintenance dose.');
    });

    test('haloperidol_decanoate + late: alerts when no date entered', () => {
        setField('medication', 'haloperidol_decanoate');
        setField('guidance-type', 'late');
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith(
            'Please enter the date of last Haloperidol Decanoate injection.',
        );
    });

    test('haloperidol_decanoate + late: alerts when no prior doses selected', () => {
        setField('medication', 'haloperidol_decanoate');
        setField('guidance-type', 'late');
        setField('last-haloperidol', daysAgo(60));
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith(
            'Please select the number of prior Haloperidol Decanoate injections.',
        );
    });

    test('fluphenazine_decanoate + late: alerts when no date entered', () => {
        setField('medication', 'fluphenazine_decanoate');
        setField('guidance-type', 'late');
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith(
            'Please enter the date of last Fluphenazine Decanoate injection.',
        );
    });

    test('vivitrol + late: alerts when no indication selected', () => {
        setField('medication', 'vivitrol');
        setField('guidance-type', 'late');
        setField('last-vivitrol', daysAgo(25));
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith('Please select the Vivitrol indication.');
    });

    test('sublocade + late: alerts when no type selected', () => {
        setField('medication', 'sublocade');
        setField('guidance-type', 'late');
        setField('last-sublocade', daysAgo(25));
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith('Please select the Sublocade dose and history.');
    });

    test('brixadi + late: alerts when no type selected', () => {
        setField('medication', 'brixadi');
        setField('guidance-type', 'late');
        setField('last-brixadi', daysAgo(7));
        handleSubmit();
        expect(window.alert).toHaveBeenCalledWith(
            'Please select the Brixadi formulation and dose.',
        );
    });
});

// ─── handleSubmit — guidance rendering ───────────────────────────────────────

describe('handleSubmit — guidance rendering', () => {
    beforeEach(() => {
        setupDOM();
        vi.mocked(window.alert).mockClear();
    });

    function expectGuidanceRendered(): void {
        expect(document.querySelector('.guidance-section')).not.toBeNull();
        expect(document.querySelector<HTMLElement>('.form-section')!.style.display).toBe('none');
    }

    test('early guidance: renders guidance section and hides form', () => {
        setField('medication', 'uzedy');
        setField('guidance-type', 'early');
        setField('next-injection-date', daysAgo(-2));
        setField('last-injection-date', daysAgo(21));
        handleSubmit();
        expectGuidanceRendered();
        expect(window.alert).not.toHaveBeenCalled();
    });

    test('early guidance: shows medication name in output', () => {
        setField('medication', 'uzedy');
        setField('guidance-type', 'early');
        setField('next-injection-date', daysAgo(-2));
        setField('last-injection-date', daysAgo(21));
        handleSubmit();
        expect(document.body.innerHTML).toContain('Uzedy (risperidone subcutaneous)');
    });

    // ── Invega Sustenna early: dual constraint ──
    describe(`invega sustenna early — dual constraint (daysBeforeDue=${earlyOf('invega_sustenna').daysBeforeDue}, minDays=${earlyOf('invega_sustenna').minDays})`, () => {
        const minDays = earlyOf('invega_sustenna').minDays!;
        const beforeDue = earlyOf('invega_sustenna').daysBeforeDue!;

        function submitEarly(daysUntilNext: number, daysSinceLast: number): void {
            setField('medication', 'invega_sustenna');
            setField('guidance-type', 'early');
            setField('next-injection-date', daysAgo(-daysUntilNext));
            setField('last-injection-date', daysAgo(daysSinceLast));
            handleSubmit();
        }

        function resultText(): string {
            return document.querySelector('.guidance-content')!.textContent ?? '';
        }

        test(`allowed: within ${beforeDue}-day window AND ≥${minDays} days since last`, () => {
            submitEarly(beforeDue, minDays);
            expectGuidanceRendered();
            expect(resultText()).toContain('Early administration is allowed');
        });

        test(`allowed: exactly on boundary — ${beforeDue} days until, ${minDays} days since`, () => {
            submitEarly(beforeDue, minDays);
            expect(resultText()).toContain('Early administration is allowed');
        });

        test('allowed: 1 day until (inside window), 30 days since last', () => {
            submitEarly(1, 30);
            expect(resultText()).toContain('Early administration is allowed');
        });

        test(`not allowed: ${beforeDue + 1} days until (outside window), ${minDays} days since last`, () => {
            submitEarly(beforeDue + 1, minDays);
            expect(resultText()).toContain('Too early to administer');
            expect(resultText()).toContain('Not yet within 2-day window');
            expect(resultText()).toContain(`At least ${minDays} days since last injection`);
        });

        test(`not allowed: 1 day until (inside window), ${minDays - 1} days since last (under ${minDays})`, () => {
            submitEarly(1, minDays - 1);
            expect(resultText()).toContain('Too early to administer');
            expect(resultText()).toContain('Within 2-day window');
            expect(resultText()).toContain(`Only ${minDays - 1} day`);
        });

        test(`not allowed: ${beforeDue + 1} days until AND ${minDays - 1} days since — both fail`, () => {
            submitEarly(beforeDue + 1, minDays - 1);
            expect(resultText()).toContain('Too early to administer');
            expect(resultText()).toContain('Not yet within 2-day window');
            expect(resultText()).toContain(`Only ${minDays - 1} day`);
        });

        test(`boundary: ${minDays} days since last is allowed (not ${minDays - 1})`, () => {
            submitEarly(beforeDue, minDays);
            expect(resultText()).toContain('Early administration is allowed');
            setupDOM();
            submitEarly(beforeDue, minDays - 1);
            expect(resultText()).toContain('Too early to administer');
        });

        test(`boundary: ${beforeDue} days before due is allowed (not ${beforeDue + 1})`, () => {
            submitEarly(beforeDue, minDays);
            expect(resultText()).toContain('Early administration is allowed');
            setupDOM();
            submitEarly(beforeDue + 1, minDays);
            expect(resultText()).toContain('Too early to administer');
        });
    });

    test('invega sustenna initiation: renders guidance section', () => {
        setField('medication', 'invega_sustenna');
        setField('guidance-type', 'late');
        setField('invega-type', 'initiation');
        setField('first-injection', daysAgo(30));
        handleSubmit();
        expectGuidanceRendered();
    });

    test('invega sustenna maintenance: renders guidance section', () => {
        setField('medication', 'invega_sustenna');
        setField('guidance-type', 'late');
        setField('invega-type', 'maintenance');
        setField('last-maintenance', daysAgo(50));
        setField('maintenance-dose', '234');
        handleSubmit();
        expectGuidanceRendered();
    });

    // ── Invega Trinza early: single constraint (daysBeforeDue) ──
    describe(`invega trinza early — single constraint (daysBeforeDue=${earlyOf('invega_trinza').daysBeforeDue})`, () => {
        const beforeDue = earlyOf('invega_trinza').daysBeforeDue!;

        function submitEarly(daysUntilNext: number): void {
            setField('medication', 'invega_trinza');
            setField('guidance-type', 'early');
            setField('next-injection-date', daysAgo(-daysUntilNext));
            handleSubmit();
        }

        function resultText(): string {
            return document.querySelector('.guidance-content')!.textContent ?? '';
        }

        test(`allowed: exactly ${beforeDue} days until (on boundary)`, () => {
            submitEarly(beforeDue);
            expectGuidanceRendered();
            expect(resultText()).toContain('Early administration is allowed');
        });

        test('allowed: 1 day until (inside window)', () => {
            submitEarly(1);
            expect(resultText()).toContain('Early administration is allowed');
        });

        test(`not allowed: ${beforeDue + 1} days until (1 day outside window)`, () => {
            submitEarly(beforeDue + 1);
            expect(resultText()).toContain('Too early to administer');
        });

        test(`boundary: ${beforeDue} days → allowed, ${beforeDue + 1} days → not allowed`, () => {
            submitEarly(beforeDue);
            expect(resultText()).toContain('Early administration is allowed');
            setupDOM();
            submitEarly(beforeDue + 1);
            expect(resultText()).toContain('Too early to administer');
        });
    });

    test('invega trinza: renders guidance section', () => {
        setField('medication', 'invega_trinza');
        setField('guidance-type', 'late');
        setField('last-trinza', daysAgo(100));
        setField('trinza-dose', '546');
        handleSubmit();
        expectGuidanceRendered();
    });

    test('invega hafyera: renders guidance section', () => {
        setField('medication', 'invega_hafyera');
        setField('guidance-type', 'late');
        setField('last-hafyera', daysAgo(190));
        handleSubmit();
        expectGuidanceRendered();
    });

    // ── Abilify Maintena early: single constraint (minDays) ──
    describe(`abilify maintena early — single constraint (minDays=${earlyOf('abilify_maintena').minDays})`, () => {
        const minDays = earlyOf('abilify_maintena').minDays!;

        function submitEarly(daysSinceLast: number): void {
            setField('medication', 'abilify_maintena');
            setField('guidance-type', 'early');
            setField('last-injection-date', daysAgo(daysSinceLast));
            handleSubmit();
        }

        function resultText(): string {
            return document.querySelector('.guidance-content')!.textContent ?? '';
        }

        test(`allowed: exactly ${minDays} days since last (on boundary)`, () => {
            submitEarly(minDays);
            expectGuidanceRendered();
            expect(resultText()).toContain('Early administration is allowed');
        });

        test('allowed: 30 days since last (inside window)', () => {
            submitEarly(30);
            expect(resultText()).toContain('Early administration is allowed');
        });

        test(`not allowed: ${minDays - 1} days since last (1 day under minimum)`, () => {
            submitEarly(minDays - 1);
            expect(resultText()).toContain('Too early to administer');
        });

        test(`boundary: ${minDays} days → allowed, ${minDays - 1} days → not allowed`, () => {
            submitEarly(minDays);
            expect(resultText()).toContain('Early administration is allowed');
            setupDOM();
            submitEarly(minDays - 1);
            expect(resultText()).toContain('Too early to administer');
        });
    });

    test('abilify maintena: renders guidance section', () => {
        setField('medication', 'abilify_maintena');
        setField('guidance-type', 'late');
        setField('last-abilify', daysAgo(35));
        setField('abilify-prior-dose-group', '3+');
        handleSubmit();
        expectGuidanceRendered();
    });

    describe(`vivitrol early — single constraint (minDays=${earlyOf('vivitrol').minDays})`, () => {
        const minDays = earlyOf('vivitrol').minDays!;

        function submitEarly(daysSinceLast: number): void {
            setField('medication', 'vivitrol');
            setField('guidance-type', 'early');
            setField('last-injection-date', daysAgo(daysSinceLast));
            handleSubmit();
        }

        function resultText(): string {
            return document.querySelector('.guidance-content')!.textContent ?? '';
        }

        test(`allowed: exactly ${minDays} days since last (on boundary)`, () => {
            submitEarly(minDays);
            expectGuidanceRendered();
            expect(resultText()).toContain('Early administration is allowed');
        });

        test('allowed: 35 days since last (inside window)', () => {
            submitEarly(35);
            expect(resultText()).toContain('Early administration is allowed');
        });

        test(`not allowed: ${minDays - 1} days since last (1 day under minimum)`, () => {
            submitEarly(minDays - 1);
            expect(resultText()).toContain('Too early to administer');
        });

        test(`boundary: ${minDays} days → allowed, ${minDays - 1} days → not allowed`, () => {
            submitEarly(minDays);
            expect(resultText()).toContain('Early administration is allowed');
            setupDOM();
            submitEarly(minDays - 1);
            expect(resultText()).toContain('Too early to administer');
        });
    });

    // ── Sublocade early: single constraint (minDays) ──
    describe(`sublocade early — single constraint (minDays=${earlyOf('sublocade').minDays})`, () => {
        const minDays = earlyOf('sublocade').minDays!;

        function submitEarly(daysSinceLast: number): void {
            setField('medication', 'sublocade');
            setField('guidance-type', 'early');
            setField('last-injection-date', daysAgo(daysSinceLast));
            handleSubmit();
        }

        function resultText(): string {
            return document.querySelector('.guidance-content')!.textContent ?? '';
        }

        test(`allowed: exactly ${minDays} days since last (on boundary)`, () => {
            submitEarly(minDays);
            expectGuidanceRendered();
            expect(resultText()).toContain('Early administration is allowed');
        });

        test('allowed: 28 days since last (inside window)', () => {
            submitEarly(28);
            expect(resultText()).toContain('Early administration is allowed');
        });

        test(`not allowed: ${minDays - 1} days since last (1 day under minimum)`, () => {
            submitEarly(minDays - 1);
            expect(resultText()).toContain('Too early to administer');
        });

        test(`boundary: ${minDays} days → allowed, ${minDays - 1} days → not allowed`, () => {
            submitEarly(minDays);
            expect(resultText()).toContain('Early administration is allowed');
            setupDOM();
            submitEarly(minDays - 1);
            expect(resultText()).toContain('Too early to administer');
        });
    });

    // ── Brixadi early: monthly variant (minDays) ──
    describe(`brixadi early — monthly variant (minDays=${earlyOf('brixadi').minDays})`, () => {
        const minDays = earlyOf('brixadi').minDays!;

        function submitEarly(daysSinceLast: number, variant = 'monthly-64'): void {
            setField('medication', 'brixadi');
            setField('guidance-type', 'early');
            setField('brixadi-type', variant);
            setField('last-brixadi', daysAgo(daysSinceLast));
            handleSubmit();
        }

        function resultText(): string {
            return document.querySelector('.guidance-content')!.textContent ?? '';
        }

        test(`allowed: exactly ${minDays} days since last (on boundary)`, () => {
            submitEarly(minDays);
            expectGuidanceRendered();
            expect(resultText()).toContain('Early administration is allowed');
        });

        test('allowed: 28 days since last (inside window)', () => {
            submitEarly(28);
            expect(resultText()).toContain('Early administration is allowed');
        });

        test(`not allowed: ${minDays - 1} days since last (1 day under minimum)`, () => {
            submitEarly(minDays - 1);
            expect(resultText()).toContain('Too early to administer');
        });

        test(`boundary: ${minDays} days → allowed, ${minDays - 1} days → not allowed`, () => {
            submitEarly(minDays);
            expect(resultText()).toContain('Early administration is allowed');
            setupDOM();
            submitEarly(minDays - 1);
            expect(resultText()).toContain('Too early to administer');
        });

        test(`monthly-96 sameAs monthly-64: ${minDays} days → allowed`, () => {
            submitEarly(minDays, 'monthly-96');
            expect(resultText()).toContain('Early administration is allowed');
        });

        test('weekly variant: shows early guidance using shared minDays', () => {
            setField('medication', 'brixadi');
            setField('guidance-type', 'early');
            setField('brixadi-type', 'weekly');
            setField('last-brixadi', daysAgo(25));
            handleSubmit();
            expectGuidanceRendered();
            expect(document.querySelector('.guidance-content')!.textContent).toMatch(
                /Early administration is allowed|Too early to administer/,
            );
        });
    });

    // ── Aristada early: dual constraint ──
    describe(`aristada early — dual constraint (daysBeforeDue=${earlyOf('aristada').daysBeforeDue}, minDays=${earlyOf('aristada').minDays})`, () => {
        const minDays = earlyOf('aristada').minDays!;
        const beforeDue = earlyOf('aristada').daysBeforeDue!;

        function submitEarly(daysUntilNext: number, daysSinceLast: number): void {
            setField('medication', 'aristada');
            setField('guidance-type', 'early');
            setField('next-injection-date', daysAgo(-daysUntilNext));
            setField('last-injection-date', daysAgo(daysSinceLast));
            handleSubmit();
        }

        function resultText(): string {
            return document.querySelector('.guidance-content')!.textContent ?? '';
        }

        test(`allowed: exactly on boundary — ${beforeDue} days until, ${minDays} days since`, () => {
            submitEarly(beforeDue, minDays);
            expectGuidanceRendered();
            expect(resultText()).toContain('Early administration is allowed');
        });

        test('allowed: 1 day until (inside window), 30 days since last', () => {
            submitEarly(1, 30);
            expect(resultText()).toContain('Early administration is allowed');
        });

        test(`not allowed: ${beforeDue + 1} days until (outside window), ${minDays} days since`, () => {
            submitEarly(beforeDue + 1, minDays);
            expect(resultText()).toContain('Too early to administer');
            expect(resultText()).toContain('Not yet within 2-day window');
            expect(resultText()).toContain(`At least ${minDays} days since last injection`);
        });

        test(`not allowed: ${beforeDue} days until (inside window), ${minDays - 1} days since (under ${minDays})`, () => {
            submitEarly(beforeDue, minDays - 1);
            expect(resultText()).toContain('Too early to administer');
            expect(resultText()).toContain('Within 2-day window');
            expect(resultText()).toContain(`Only ${minDays - 1} day`);
        });

        test(`not allowed: ${beforeDue + 1} days until AND ${minDays - 1} days since — both fail`, () => {
            submitEarly(beforeDue + 1, minDays - 1);
            expect(resultText()).toContain('Too early to administer');
            expect(resultText()).toContain('Not yet within 2-day window');
            expect(resultText()).toContain(`Only ${minDays - 1} day`);
        });

        test(`boundary: ${minDays} days since last is allowed (not ${minDays - 1})`, () => {
            submitEarly(beforeDue, minDays);
            expect(resultText()).toContain('Early administration is allowed');
            setupDOM();
            submitEarly(beforeDue, minDays - 1);
            expect(resultText()).toContain('Too early to administer');
        });

        test(`boundary: ${beforeDue} days before due is allowed (not ${beforeDue + 1})`, () => {
            submitEarly(beforeDue, minDays);
            expect(resultText()).toContain('Early administration is allowed');
            setupDOM();
            submitEarly(beforeDue + 1, minDays);
            expect(resultText()).toContain('Too early to administer');
        });
    });

    test('aristada: renders guidance section', () => {
        setField('medication', 'aristada');
        setField('guidance-type', 'late');
        setField('last-aristada', daysAgo(50));
        setField('aristada-dose', '662');
        handleSubmit();
        expectGuidanceRendered();
    });

    test('aristada late guidance uses Next steps heading format', () => {
        setField('medication', 'aristada');
        setField('guidance-type', 'late');
        setField('last-aristada', daysAgo(90));
        setField('aristada-dose', '662');
        handleSubmit();

        const headings = Array.from(document.querySelectorAll('.guidance-heading')).map(
            (h) => h.textContent ?? '',
        );
        expect(headings).toContain('Next steps:');
        expect(headings).not.toContain('Recommended supplementation:');

        const guidanceText = Array.from(
            document.querySelectorAll('.guidance-text, .guidance-content li'),
        )
            .map((n) => n.textContent ?? '')
            .join(' ');
        expect(guidanceText).toContain(
            'Administer the usual dose as soon as possible. Supplement oral aripiprazole for 21 days',
        );
    });

    // ── Haloperidol Decanoate early: dual constraint ──
    describe(`haloperidol decanoate early — dual constraint (daysBeforeDue=${earlyOf('haloperidol_decanoate').daysBeforeDue}, minDays=${earlyOf('haloperidol_decanoate').minDays})`, () => {
        const minDays = earlyOf('haloperidol_decanoate').minDays!;
        const beforeDue = earlyOf('haloperidol_decanoate').daysBeforeDue!;

        function submitEarly(daysUntilNext: number, daysSinceLast: number): void {
            setField('medication', 'haloperidol_decanoate');
            setField('guidance-type', 'early');
            setField('next-injection-date', daysAgo(-daysUntilNext));
            setField('last-injection-date', daysAgo(daysSinceLast));
            handleSubmit();
        }

        function resultText(): string {
            return document.querySelector('.guidance-content')!.textContent ?? '';
        }

        test(`allowed: exactly on boundary — ${beforeDue} days until, ${minDays} days since`, () => {
            submitEarly(beforeDue, minDays);
            expectGuidanceRendered();
            expect(resultText()).toContain('Early administration is allowed');
        });

        test('allowed: 1 day until (inside window), 20 days since last', () => {
            submitEarly(1, 20);
            expect(resultText()).toContain('Early administration is allowed');
        });

        test(`not allowed: ${beforeDue + 1} days until (outside window), ${minDays} days since`, () => {
            submitEarly(beforeDue + 1, minDays);
            expect(resultText()).toContain('Too early to administer');
            expect(resultText()).toContain('Not yet within 2-day window');
            expect(resultText()).toContain(`At least ${minDays} days since last injection`);
        });

        test(`not allowed: ${beforeDue} days until (inside window), ${minDays - 1} days since (under ${minDays})`, () => {
            submitEarly(beforeDue, minDays - 1);
            expect(resultText()).toContain('Too early to administer');
            expect(resultText()).toContain('Within 2-day window');
            expect(resultText()).toContain(`Only ${minDays - 1} day`);
        });

        test(`not allowed: both fail — ${beforeDue + 1} days until, ${minDays - 1} days since`, () => {
            submitEarly(beforeDue + 1, minDays - 1);
            expect(resultText()).toContain('Too early to administer');
            expect(resultText()).toContain('Not yet within 2-day window');
            expect(resultText()).toContain(`Only ${minDays - 1} day`);
        });

        test(`boundary: ${minDays} days since last is allowed (not ${minDays - 1})`, () => {
            submitEarly(beforeDue, minDays);
            expect(resultText()).toContain('Early administration is allowed');
            setupDOM();
            submitEarly(beforeDue, minDays - 1);
            expect(resultText()).toContain('Too early to administer');
        });

        test(`boundary: ${beforeDue} days before due is allowed (not ${beforeDue + 1})`, () => {
            submitEarly(beforeDue, minDays);
            expect(resultText()).toContain('Early administration is allowed');
            setupDOM();
            submitEarly(beforeDue + 1, minDays);
            expect(resultText()).toContain('Too early to administer');
        });
    });

    // ── Fluphenazine Decanoate early: dual constraint ──
    describe(`fluphenazine decanoate early — dual constraint (daysBeforeDue=${earlyOf('fluphenazine_decanoate').daysBeforeDue}, minDays=${earlyOf('fluphenazine_decanoate').minDays})`, () => {
        const minDays = earlyOf('fluphenazine_decanoate').minDays!;
        const beforeDue = earlyOf('fluphenazine_decanoate').daysBeforeDue!;

        function submitEarly(daysUntilNext: number, daysSinceLast: number): void {
            setField('medication', 'fluphenazine_decanoate');
            setField('guidance-type', 'early');
            setField('next-injection-date', daysAgo(-daysUntilNext));
            setField('last-injection-date', daysAgo(daysSinceLast));
            handleSubmit();
        }

        function resultText(): string {
            return document.querySelector('.guidance-content')!.textContent ?? '';
        }

        test(`allowed: exactly on boundary — ${beforeDue} days until, ${minDays} days since`, () => {
            submitEarly(beforeDue, minDays);
            expectGuidanceRendered();
            expect(resultText()).toContain('Early administration is allowed');
        });

        test('allowed: 1 day until (inside window), 20 days since last', () => {
            submitEarly(1, 20);
            expect(resultText()).toContain('Early administration is allowed');
        });

        test(`not allowed: ${beforeDue + 1} days until (outside window), ${minDays} days since`, () => {
            submitEarly(beforeDue + 1, minDays);
            expect(resultText()).toContain('Too early to administer');
            expect(resultText()).toContain('Not yet within 2-day window');
            expect(resultText()).toContain(`At least ${minDays} days since last injection`);
        });

        test(`not allowed: ${beforeDue} days until (inside window), ${minDays - 1} days since (under ${minDays})`, () => {
            submitEarly(beforeDue, minDays - 1);
            expect(resultText()).toContain('Too early to administer');
            expect(resultText()).toContain('Within 2-day window');
            expect(resultText()).toContain(`Only ${minDays - 1} day`);
        });

        test(`not allowed: both fail — ${beforeDue + 1} days until, ${minDays - 1} days since`, () => {
            submitEarly(beforeDue + 1, minDays - 1);
            expect(resultText()).toContain('Too early to administer');
            expect(resultText()).toContain('Not yet within 2-day window');
            expect(resultText()).toContain(`Only ${minDays - 1} day`);
        });

        test(`boundary: ${minDays} days since last is allowed (not ${minDays - 1})`, () => {
            submitEarly(beforeDue, minDays);
            expect(resultText()).toContain('Early administration is allowed');
            setupDOM();
            submitEarly(beforeDue, minDays - 1);
            expect(resultText()).toContain('Too early to administer');
        });

        test(`boundary: ${beforeDue} days before due is allowed (not ${beforeDue + 1})`, () => {
            submitEarly(beforeDue, minDays);
            expect(resultText()).toContain('Early administration is allowed');
            setupDOM();
            submitEarly(beforeDue + 1, minDays);
            expect(resultText()).toContain('Too early to administer');
        });
    });

    // ── Uzedy early: dual constraint ──
    describe(`uzedy early — dual constraint (daysBeforeDue=${earlyOf('uzedy').daysBeforeDue}, minDays=${earlyOf('uzedy').minDays})`, () => {
        const minDays = earlyOf('uzedy').minDays!;
        const beforeDue = earlyOf('uzedy').daysBeforeDue!;

        function submitEarly(daysUntilNext: number, daysSinceLast: number): void {
            setField('medication', 'uzedy');
            setField('guidance-type', 'early');
            setField('next-injection-date', daysAgo(-daysUntilNext));
            setField('last-injection-date', daysAgo(daysSinceLast));
            handleSubmit();
        }

        function resultText(): string {
            return document.querySelector('.guidance-content')!.textContent ?? '';
        }

        test(`allowed: exactly on boundary — ${beforeDue} days until, ${minDays} days since`, () => {
            submitEarly(beforeDue, minDays);
            expectGuidanceRendered();
            expect(resultText()).toContain('Early administration is allowed');
        });

        test('allowed: 1 day until (inside window), 30 days since last', () => {
            submitEarly(1, 30);
            expect(resultText()).toContain('Early administration is allowed');
        });

        test(`not allowed: ${beforeDue + 1} days until (outside window), ${minDays} days since`, () => {
            submitEarly(beforeDue + 1, minDays);
            expect(resultText()).toContain('Too early to administer');
            expect(resultText()).toContain('Not yet within 2-day window');
            expect(resultText()).toContain(`At least ${minDays} days since last injection`);
        });

        test(`not allowed: ${beforeDue} days until (inside window), ${minDays - 1} days since (under ${minDays})`, () => {
            submitEarly(beforeDue, minDays - 1);
            expect(resultText()).toContain('Too early to administer');
            expect(resultText()).toContain('Within 2-day window');
            expect(resultText()).toContain(`Only ${minDays - 1} day`);
        });

        test(`not allowed: both fail — ${beforeDue + 1} days until, ${minDays - 1} days since`, () => {
            submitEarly(beforeDue + 1, minDays - 1);
            expect(resultText()).toContain('Too early to administer');
            expect(resultText()).toContain('Not yet within 2-day window');
            expect(resultText()).toContain(`Only ${minDays - 1} day`);
        });

        test(`boundary: ${minDays} days since last is allowed (not ${minDays - 1})`, () => {
            submitEarly(beforeDue, minDays);
            expect(resultText()).toContain('Early administration is allowed');
            setupDOM();
            submitEarly(beforeDue, minDays - 1);
            expect(resultText()).toContain('Too early to administer');
        });

        test(`boundary: ${beforeDue} days before due is allowed (not ${beforeDue + 1})`, () => {
            submitEarly(beforeDue, minDays);
            expect(resultText()).toContain('Early administration is allowed');
            setupDOM();
            submitEarly(beforeDue + 1, minDays);
            expect(resultText()).toContain('Too early to administer');
        });
    });

    test('uzedy: renders guidance section', () => {
        setField('medication', 'uzedy');
        setField('guidance-type', 'late');
        setField('last-uzedy', daysAgo(35));
        setField('uzedy-dose', '150-or-less');
        handleSubmit();
        expectGuidanceRendered();
    });

    test('guidance section includes a Start Over button', () => {
        setField('medication', 'uzedy');
        setField('guidance-type', 'early');
        setField('next-injection-date', daysAgo(-2));
        setField('last-injection-date', daysAgo(21));
        handleSubmit();
        const btn = document.querySelector('.guidance-section button');
        expect(btn).not.toBeNull();
        expect(btn!.textContent).toBe('Start Over');
    });
});

// ─── startOver ────────────────────────────────────────────────────────────────

describe('startOver', () => {
    beforeEach(setupDOM);

    test('restores the form section and removes guidance section', () => {
        setField('medication', 'uzedy');
        setField('guidance-type', 'early');
        setField('next-injection-date', daysAgo(-2));
        setField('last-injection-date', daysAgo(21));
        handleSubmit();
        expect(document.querySelector('.guidance-section')).not.toBeNull();

        startOver();
        expect(document.querySelector('.guidance-section')).toBeNull();
        expect(document.querySelector<HTMLElement>('.form-section')!.style.display).toBe('block');
    });

    test('clears all form fields', () => {
        setField('medication', 'uzedy');
        setField('guidance-type', 'late');
        setField('last-uzedy', daysAgo(35));
        setField('uzedy-dose', '150-or-less');

        startOver();

        expect((document.getElementById('medication') as HTMLSelectElement).value).toBe('');
        expect((document.getElementById('guidance-type') as HTMLSelectElement).value).toBe('');
        expect((document.getElementById('last-uzedy') as HTMLInputElement).value).toBe('');
        expect((document.getElementById('uzedy-dose') as HTMLSelectElement).value).toBe('');
    });

    test('hides all conditional field groups', () => {
        setField('medication', 'uzedy');
        setField('guidance-type', 'late');
        handleGuidanceTypeChange();
        expect(isVisible('uzedy-fields')).toBe(true);

        startOver();
        expect(isVisible('uzedy-fields')).toBe(false);
    });
});

// ─── Provider notification aggregation ─────────────────────────────────────

describe('provider notification aggregation', () => {
    // Save originals so afterEach can restore the registry to its loaded state
    let origAbilifyCommon: string[] | undefined;
    let origSustennaCommon: string[] | undefined;
    let origSustennaEarly: string[] | undefined;

    beforeEach(() => {
        setupDOM();
        origAbilifyCommon = MED_REGISTRY['abilify_maintena'].commonProviderNotifications;
        origSustennaCommon = MED_REGISTRY['invega_sustenna'].commonProviderNotifications;
        origSustennaEarly = MED_REGISTRY['invega_sustenna'].earlyProviderNotification;
    });

    afterEach(() => {
        const restore = (entry: any, key: string, orig: string[] | undefined) => {
            if (orig === undefined) delete entry[key];
            else entry[key] = orig;
        };
        restore(MED_REGISTRY['abilify_maintena'], 'commonProviderNotifications', origAbilifyCommon);
        restore(MED_REGISTRY['invega_sustenna'], 'commonProviderNotifications', origSustennaCommon);
        restore(MED_REGISTRY['invega_sustenna'], 'earlyProviderNotification', origSustennaEarly);
    });

    /** Returns the <li> text contents from the "When to notify provider:" section */
    function getNotifListItems(): string[] {
        const section = Array.from(document.querySelectorAll('.guidance-content')).find((el) =>
            el.querySelector('h3')?.textContent?.includes('When to notify provider'),
        );
        return section
            ? Array.from(section.querySelectorAll('li')).map((li) => li.textContent ?? '')
            : [];
    }

    /** Returns text content of the "When to notify provider" section, or null if absent */
    function getNotifSectionText(): string | null {
        const section = Array.from(document.querySelectorAll('.guidance-content')).find((el) =>
            el.querySelector('h3')?.textContent?.includes('When to notify provider'),
        );
        return section ? (section.textContent ?? '') : null;
    }

    // ── Late guidance (threePartGuidance) ────────────────────────────────────
    // Uses abilify_maintena:
    //   daysAgo(50) + '3+' → reinitiate path  (has tier providerNotifications)
    //   daysAgo(30) + '3+' → routine path     (no tier providerNotifications)

    describe('late guidance — threePartGuidance', () => {
        test('tier-only: tier notification appears first, shared notifications last', () => {
            setField('medication', 'abilify_maintena');
            setField('guidance-type', 'late');
            setField('last-abilify', daysAgo(50));
            setField('abilify-prior-dose-group', '3+');
            handleSubmit();

            const items = getNotifListItems();
            expect(items.length).toBeGreaterThanOrEqual(2);
            expect(items[0]).toContain('Post-injection'); // tier first
            // shared items follow — verify both are present somewhere after index 0
            const sharedText = items.slice(1).join(' ');
            expect(sharedText).toContain('abnormal involuntary');
            expect(sharedText).toContain('excessive sedation, dizziness');
        });

        test('shared-only: only shared notification appears when tier has none', () => {
            (MED_REGISTRY['abilify_maintena'] as any).commonProviderNotifications = [
                'SHARED-NOTIF',
            ];
            setField('medication', 'abilify_maintena');
            setField('guidance-type', 'late');
            setField('last-abilify', daysAgo(30));
            setField('abilify-prior-dose-group', '3+');
            handleSubmit();

            const items = getNotifListItems();
            expect(items).toHaveLength(1);
            expect(items[0]).toContain('SHARED-NOTIF');
        });

        test('tier first, shared last: correct order when both are present', () => {
            (MED_REGISTRY['abilify_maintena'] as any).commonProviderNotifications = [
                'SHARED-NOTIF',
            ];
            setField('medication', 'abilify_maintena');
            setField('guidance-type', 'late');
            setField('last-abilify', daysAgo(50));
            setField('abilify-prior-dose-group', '3+');
            handleSubmit();

            const items = getNotifListItems();
            expect(items).toHaveLength(2);
            expect(items[0]).toContain('Post-injection'); // tier first
            expect(items[1]).toContain('SHARED-NOTIF'); // shared last
        });

        test('neither: fallback "No provider notification needed" text is shown', () => {
            delete (MED_REGISTRY['abilify_maintena'] as any).commonProviderNotifications;
            setField('medication', 'abilify_maintena');
            setField('guidance-type', 'late');
            setField('last-abilify', daysAgo(30));
            setField('abilify-prior-dose-group', '3+');
            handleSubmit();

            expect(getNotifListItems()).toHaveLength(0);
            expect(getNotifSectionText()).toContain('No provider notification needed');
        });
    });

    // ── Early guidance (showEarlyGuidance) ───────────────────────────────────
    // Uses invega_sustenna (dual-constraint): next 1 day away, 25 days since last → allowed

    describe('early guidance — showEarlyGuidance', () => {
        function submitEarlyAllowed(): void {
            setField('medication', 'invega_sustenna');
            setField('guidance-type', 'early');
            setField('next-injection-date', daysAgo(-1));
            setField('last-injection-date', daysAgo(25));
            handleSubmit();
        }

        test('neither: "When to notify provider" section renders with fallback text', () => {
            delete (MED_REGISTRY['invega_sustenna'] as any).commonProviderNotifications;
            submitEarlyAllowed();
            expect(getNotifSectionText()).toContain('No provider notification needed');
        });

        test('shared-only: shared notification appears', () => {
            (MED_REGISTRY['invega_sustenna'] as any).commonProviderNotifications = ['SHARED-NOTIF'];
            submitEarlyAllowed();

            const items = getNotifListItems();
            expect(items).toHaveLength(1);
            expect(items[0]).toContain('SHARED-NOTIF');
        });

        test('early-only: early-specific notification appears', () => {
            delete (MED_REGISTRY['invega_sustenna'] as any).commonProviderNotifications;
            (MED_REGISTRY['invega_sustenna'] as any).earlyProviderNotification = ['EARLY-NOTIF'];
            submitEarlyAllowed();

            const items = getNotifListItems();
            expect(items).toHaveLength(1);
            expect(items[0]).toContain('EARLY-NOTIF');
        });

        test('early first, shared last: correct order when both are present', () => {
            (MED_REGISTRY['invega_sustenna'] as any).earlyProviderNotification = ['EARLY-NOTIF'];
            (MED_REGISTRY['invega_sustenna'] as any).commonProviderNotifications = ['SHARED-NOTIF'];
            submitEarlyAllowed();

            const items = getNotifListItems();
            expect(items).toHaveLength(2);
            expect(items[0]).toContain('EARLY-NOTIF'); // early-specific first
            expect(items[1]).toContain('SHARED-NOTIF'); // shared last
        });
    });
});

describe('initForm — double-injection guard', () => {
    beforeEach(setupDOM);

    test('calling initForm twice does not duplicate field group IDs', () => {
        initForm(); // second call
        expect(document.querySelectorAll('#uzedy-fields')).toHaveLength(1);
        expect(document.querySelectorAll('#abilify-fields')).toHaveLength(1);
        expect(document.querySelectorAll('#invega-sustenna-options')).toHaveLength(1);
    });

    test('calling initForm twice does not duplicate medication options', () => {
        initForm(); // second call
        const options = document.querySelectorAll('#medication option[value="uzedy"]');
        expect(options).toHaveLength(1);
    });

    test('calling initForm a third time still produces no duplicates', () => {
        initForm();
        initForm();
        expect(document.querySelectorAll('#trinza-fields')).toHaveLength(1);
    });
});

// ─── Addiction Medicine accordion ──────────────────────────────────────

describe('addiction medicine accordion', () => {
    beforeEach(setupDOM);

    function submitBrixadi(days: number): void {
        setField('medication', 'brixadi');
        setField('guidance-type', 'late');
        setField('last-brixadi', daysAgo(days));
        setField('brixadi-type', 'monthly-64');
        handleSubmit();
    }

    function submitAbilify(days: number): void {
        setField('medication', 'abilify_maintena');
        setField('guidance-type', 'late');
        setField('last-abilify', daysAgo(days));
        setField('abilify-prior-dose-group', '3+');
        handleSubmit();
    }

    test('accordion renders for addiction medicine med on fentanyl-assessment tier (35–41 days)', () => {
        submitBrixadi(38);
        expect(document.querySelector('.fpa-box')).not.toBeNull();
    });

    test('accordion renders for addiction medicine med on fentanyl-assessment tier (42–55 days)', () => {
        submitBrixadi(50);
        expect(document.querySelector('.fpa-box')).not.toBeNull();
    });

    test('accordion renders for addiction medicine med on administer-regardless tier (21–34 days)', () => {
        submitBrixadi(30);
        expect(document.querySelector('.fpa-box')).not.toBeNull();
    });

    test('accordion does NOT render for non-addiction-medicine med (abilify_maintena)', () => {
        submitAbilify(50);
        expect(document.querySelector('.fpa-box')).toBeNull();
    });

    test('accordion contains exactly 3 phase items', () => {
        submitBrixadi(38);
        expect(document.querySelectorAll('.fpa-item')).toHaveLength(3);
    });

    test('all three phase labels are present', () => {
        submitBrixadi(38);
        const summaries = Array.from(document.querySelectorAll('.fpa-summary')).map(
            (s) => s.textContent ?? '',
        );
        expect(summaries.some((t) => t.includes('Minimal or no fentanyl dependence'))).toBe(true);
        expect(summaries.some((t) => t.includes('Moderate fentanyl dependence'))).toBe(true);
        expect(summaries.some((t) => t.includes('Significant fentanyl dependence'))).toBe(true);
    });

    test('allCriteria phases render bullet items', () => {
        submitBrixadi(38);
        const firstItem = document.querySelectorAll('.fpa-item')[0].querySelector('.fpa-body');
        expect(firstItem?.querySelectorAll('li').length).toBeGreaterThanOrEqual(4);
    });

    test('description-only phase renders paragraph text, not a list', () => {
        submitBrixadi(38);
        const secondBody = document.querySelectorAll('.fpa-item')[1].querySelector('.fpa-body');
        expect(secondBody?.querySelector('ul')).toBeNull();
        expect(secondBody?.querySelector('p')?.textContent).toContain('between');
    });
});
