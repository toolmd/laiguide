// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderForm, collectFormData } from '../forms/index';
import { NO_PROVIDER_NOTIFICATION } from '../../constants';
import type { RawMedJson } from '../types';

// ── Fixture ──────────────────────────────────────────────────────────────────

function makeMed(overrides: Partial<RawMedJson> = {}): RawMedJson {
    return {
        displayName: 'Test Med',
        optgroupLabel: 'Antipsychotics',
        guidance: {
            shared: { providerNotifications: ['Notify on side effects'] },
            early: { minDays: 21, daysBeforeDue: 2, guidanceNote: ['After initiation'] },
            late: {
                variants: [
                    {
                        key: 'maintenance',
                        tiers: [
                            {
                                maxDays: 30,
                                guidance: {
                                    idealSteps: ['Administer dose.'],
                                    pragmaticVariations: ['Alternative site ok.'],
                                    providerNotifications: ['Notify provider.'],
                                },
                            },
                            {
                                maxDays: null,
                                guidance: { idealSteps: ['Contact prescriber.'] },
                            },
                        ],
                    },
                ],
            },
        },
        ...overrides,
    };
}

let container: HTMLDivElement;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});

// ── renderForm ───────────────────────────────────────────────────────────────

describe('renderForm', () => {
    it('clears previous content before rendering', () => {
        container.innerHTML = '<div id="old-sentinel">old content</div>';
        renderForm(container, makeMed());
        expect(container.querySelector('#old-sentinel')).toBeNull();
    });

    it('renders a text input for displayName with the correct value', () => {
        renderForm(container, makeMed());
        const input = container.querySelector<HTMLInputElement>('input[data-path="displayName"]');
        expect(input).not.toBeNull();
        expect(input?.value).toBe('Test Med');
    });

    it('renders a text input for optgroupLabel', () => {
        renderForm(container, makeMed());
        const input = container.querySelector<HTMLInputElement>('input[data-path="optgroupLabel"]');
        expect(input?.value).toBe('Antipsychotics');
    });

    it('renders the shared providerNotifications list', () => {
        renderForm(container, makeMed());
        const list = container.querySelector<HTMLDivElement>(
            '[data-path="guidance.shared.providerNotifications"]',
        );
        expect(list).not.toBeNull();
        const textarea = list?.querySelector('textarea');
        expect(textarea?.value).toBe('Notify on side effects');
    });

    it('renders early guidance minDays as a number input', () => {
        renderForm(container, makeMed());
        const input = container.querySelector<HTMLInputElement>(
            '[data-path="guidance.early.minDays"]',
        );
        expect(input?.type).toBe('number');
        expect(input?.value).toBe('21');
    });

    it('renders early guidance daysBeforeDue when present', () => {
        renderForm(container, makeMed());
        const input = container.querySelector<HTMLInputElement>(
            'input[data-path="guidance.early.daysBeforeDue"]',
        );
        expect(input?.value).toBe('2');
    });

    it('renders early guidance guidanceNote as list editor', () => {
        renderForm(container, makeMed());
        const editor = container.querySelector<HTMLDivElement>(
            '.list-editor[data-path="guidance.early.guidanceNote"]',
        );
        expect(editor).not.toBeNull();
        expect(editor!.querySelector('textarea')?.value).toBe('After initiation');
    });

    it('does not render daysBeforeDue when absent', () => {
        const med = makeMed();
        delete med.guidance.early!.daysBeforeDue;
        renderForm(container, med);
        expect(container.querySelector('[data-path="guidance.early.daysBeforeDue"]')).toBeNull();
    });

    it('renders a tier block for each tier in a variant', () => {
        renderForm(container, makeMed());
        const tierBlocks = container.querySelectorAll('.tier-block');
        expect(tierBlocks.length).toBe(2);
    });

    it('renders idealSteps for the first tier', () => {
        renderForm(container, makeMed());
        const idealList = container.querySelector<HTMLDivElement>(
            '[data-path="guidance.late.variants.0.tiers.0.guidance.idealSteps"]',
        );
        expect(idealList).not.toBeNull();
        expect(idealList?.querySelector('textarea')?.value).toBe('Administer dose.');
    });

    it('renders an open-ended tier (maxDays null) with empty value', () => {
        renderForm(container, makeMed());
        const maxDaysInput = container.querySelector<HTMLInputElement>(
            '[data-path="guidance.late.variants.0.tiers.1.maxDays"]',
        );
        expect(maxDaysInput?.value).toBe('');
    });

    it('renders a sameAs variant with an inheritance note and no tiers', () => {
        const med = makeMed();
        med.guidance.late.variants.push({ key: 'initiation', sameAs: 'maintenance' });
        renderForm(container, med);
        const note = container.querySelector('.sameAs-note');
        expect(note).not.toBeNull();
        expect(note?.textContent).toContain('Uses the same guidance as');
        expect(note?.textContent).toContain('maintenance');
    });

    it('shows the NO_PROVIDER_NOTIFICATION hint (not a textarea) when providerNotifications is empty', () => {
        const med = makeMed();
        med.guidance.late.variants[0].tiers![1].guidance!.providerNotifications = [];
        renderForm(container, med);
        const list = container.querySelector<HTMLDivElement>(
            '[data-path="guidance.late.variants.0.tiers.1.guidance.providerNotifications"]',
        );
        expect(list?.querySelector('textarea')).toBeNull();
        expect(list?.querySelector('.list-empty-hint')?.textContent).toContain(
            NO_PROVIDER_NOTIFICATION,
        );
    });

    it('shows the NO_PROVIDER_NOTIFICATION hint (not a textarea) when providerNotifications is absent', () => {
        const med = makeMed();
        delete med.guidance.late.variants[0].tiers![1].guidance!.providerNotifications;
        renderForm(container, med);
        const list = container.querySelector<HTMLDivElement>(
            '[data-path="guidance.late.variants.0.tiers.1.guidance.providerNotifications"]',
        );
        expect(list?.querySelector('textarea')).toBeNull();
        expect(list?.querySelector('.list-empty-hint')?.textContent).toContain(
            NO_PROVIDER_NOTIFICATION,
        );
    });

    it('does not show the default when providerNotifications has values', () => {
        renderForm(container, makeMed());
        const list = container.querySelector<HTMLDivElement>(
            '[data-path="guidance.late.variants.0.tiers.0.guidance.providerNotifications"]',
        );
        expect(list?.querySelector('textarea')?.value).toBe('Notify provider.');
        const textareas = list?.querySelectorAll('textarea');
        expect(textareas?.length).toBe(1);
    });

    it('renders dose-rule sub-blocks instead of guidance fields for guidanceByDoseRules tiers', () => {
        const med = makeMed();
        (
            med.guidance.late.variants[0].tiers![0] as unknown as Record<string, unknown>
        ).guidanceByDoseRules = [
            { doses: ['39-to-156'], guidance: { idealSteps: ['Administer dose.'] } },
            { doses: ['234'], guidance: { idealSteps: ['Give 156 mg.'] } },
        ];
        delete (med.guidance.late.variants[0].tiers![0] as unknown as Record<string, unknown>)
            .guidance;
        renderForm(container, med);
        expect(container.querySelector('.dose-rule-block')).not.toBeNull();
        expect(container.querySelectorAll('.dose-rule-block').length).toBe(2);
        expect(
            container.querySelector(
                '[data-path="guidance.late.variants.0.tiers.0.guidance.idealSteps"]',
            ),
        ).toBeNull();
    });

    it('renders dose list editors for each dose rule', () => {
        const med = makeMed();
        (
            med.guidance.late.variants[0].tiers![0] as unknown as Record<string, unknown>
        ).guidanceByDoseRules = [{ doses: ['39-to-156'], guidance: { idealSteps: ['Step 1.'] } }];
        delete (med.guidance.late.variants[0].tiers![0] as unknown as Record<string, unknown>)
            .guidance;
        renderForm(container, med);
        const dosesEditor = container.querySelector<HTMLDivElement>(
            '[data-path="guidance.late.variants.0.tiers.0.guidanceByDoseRules.0.doses"]',
        );
        expect(dosesEditor).not.toBeNull();
        expect(dosesEditor?.querySelector('textarea')?.value).toBe('39-to-156');
    });

    it('renders idealSteps inside each dose rule', () => {
        const med = makeMed();
        (
            med.guidance.late.variants[0].tiers![0] as unknown as Record<string, unknown>
        ).guidanceByDoseRules = [{ doses: ['234'], guidance: { idealSteps: ['Give 156 mg.'] } }];
        delete (med.guidance.late.variants[0].tiers![0] as unknown as Record<string, unknown>)
            .guidance;
        renderForm(container, med);
        const stepsEditor = container.querySelector<HTMLDivElement>(
            '[data-path="guidance.late.variants.0.tiers.0.guidanceByDoseRules.0.guidance.idealSteps"]',
        );
        expect(stepsEditor?.querySelector('textarea')?.value).toBe('Give 156 mg.');
    });
});

// ── tab bar ───────────────────────────────────────────────────────────────────

describe('tab bar', () => {
    it('renders a .form-tab-bar with .form-tab-btn buttons', () => {
        renderForm(container, makeMed());
        const buttons = container.querySelectorAll('.form-tab-btn');
        expect(buttons.length).toBeGreaterThan(0);
    });

    it('renders 4 buttons for a med with shared, early, and late', () => {
        renderForm(container, makeMed());
        expect(container.querySelectorAll('.form-tab-btn').length).toBe(4);
    });

    it('button labels are Medication Info, Shared Notifications, Early Guidance, Overdue Guidance', () => {
        renderForm(container, makeMed());
        const labels = [...container.querySelectorAll('.form-tab-btn')].map((b) => b.textContent);
        expect(labels).toEqual([
            'Medication Info',
            'Shared Notifications',
            'Early Guidance',
            'Overdue Guidance',
        ]);
    });

    it('first tab is active and all others are not by default', () => {
        renderForm(container, makeMed());
        const buttons = container.querySelectorAll('.form-tab-btn');
        expect(buttons[0].classList.contains('active')).toBe(true);
        for (let i = 1; i < buttons.length; i++) {
            expect(buttons[i].classList.contains('active')).toBe(false);
        }
    });

    it('first panel is visible and all others are hidden by default', () => {
        renderForm(container, makeMed());
        const panels = container.querySelectorAll<HTMLElement>('.form-tab-panel');
        expect(panels[0].hidden).toBe(false);
        for (let i = 1; i < panels.length; i++) {
            expect(panels[i].hidden).toBe(true);
        }
    });

    it('clicking a tab activates it and hides all other panels', () => {
        renderForm(container, makeMed());
        const buttons = container.querySelectorAll<HTMLButtonElement>('.form-tab-btn');
        const panels = container.querySelectorAll<HTMLElement>('.form-tab-panel');
        buttons[2].click();
        expect(buttons[2].classList.contains('active')).toBe(true);
        expect(buttons[0].classList.contains('active')).toBe(false);
        expect(panels[2].hidden).toBe(false);
        expect(panels[0].hidden).toBe(true);
        expect(panels[1].hidden).toBe(true);
    });

    it('omits tabs for guidance keys absent from the JSON', () => {
        const med = makeMed();
        delete med.guidance.shared;
        delete med.guidance.early;
        renderForm(container, med);
        const labels = [...container.querySelectorAll('.form-tab-btn')].map((b) => b.textContent);
        expect(labels).toEqual(['Medication Info', 'Overdue Guidance']);
    });

    it('each section is rendered inside its own panel', () => {
        renderForm(container, makeMed());
        const panels = container.querySelectorAll<HTMLElement>('.form-tab-panel');
        expect(panels[0].querySelector('[data-path="displayName"]')).not.toBeNull();
        expect(
            panels[1].querySelector('[data-path="guidance.shared.providerNotifications"]'),
        ).not.toBeNull();
        expect(panels[2].querySelector('[data-path="guidance.early.minDays"]')).not.toBeNull();
        expect(
            panels[3].querySelector(
                '[data-path="guidance.late.variants.0.tiers.0.guidance.idealSteps"]',
            ),
        ).not.toBeNull();
    });
});

// ── collectFormData ──────────────────────────────────────────────────────────

describe('collectFormData', () => {
    it('returns a deep clone — does not mutate currentMedData', () => {
        renderForm(container, makeMed());
        const original = makeMed();
        const collected = collectFormData(container, original);
        collected.displayName = 'Changed';
        expect(original.displayName).toBe('Test Med');
    });

    it('reads updated text input value', () => {
        const med = makeMed();
        renderForm(container, med);
        const input = container.querySelector<HTMLInputElement>('input[data-path="displayName"]')!;
        input.value = 'Updated Name';
        const result = collectFormData(container, med);
        expect(result.displayName).toBe('Updated Name');
    });

    it('reads updated number input value', () => {
        const med = makeMed();
        renderForm(container, med);
        const input = container.querySelector<HTMLInputElement>(
            'input[data-path="guidance.early.minDays"]',
        )!;
        input.value = '28';
        const result = collectFormData(container, med) as {
            guidance: { early: { minDays: number } };
        };
        expect(result.guidance.early.minDays).toBe(28);
    });

    it('stores null for a cleared number input', () => {
        const med = makeMed();
        renderForm(container, med);
        const input = container.querySelector<HTMLInputElement>(
            'input[data-path="guidance.early.minDays"]',
        )!;
        input.value = '';
        const result = collectFormData(container, med) as {
            guidance: { early: { minDays: unknown } };
        };
        expect(result.guidance.early.minDays).toBeNull();
    });

    it('collects list editor items into an array', () => {
        const med = makeMed();
        renderForm(container, med);
        const list = container.querySelector<HTMLDivElement>(
            '[data-path="guidance.shared.providerNotifications"]',
        )!;
        const ta = list.querySelector('textarea')!;
        ta.value = 'Updated notification';
        const result = collectFormData(container, med) as {
            guidance: { shared: { providerNotifications: string[] } };
        };
        expect(result.guidance.shared.providerNotifications).toEqual(['Updated notification']);
    });

    it('omits blank list items and sets empty array when all items are blank', () => {
        const med = makeMed();
        renderForm(container, med);
        const list = container.querySelector<HTMLDivElement>(
            '[data-path="guidance.shared.providerNotifications"]',
        )!;
        const ta = list.querySelector('textarea')!;
        ta.value = '   ';
        const result = collectFormData(container, med) as {
            guidance: { shared: { providerNotifications?: string[] } };
        };
        expect(result.guidance.shared.providerNotifications).toEqual([]);
    });

    it('writes nested values at the correct path', () => {
        const med = makeMed();
        renderForm(container, med);
        const input = container.querySelector<HTMLInputElement>(
            '[data-path="guidance.late.variants.0.tiers.0.maxDays"]',
        )!;
        input.value = '45';
        const result = collectFormData(container, med) as RawMedJson;
        const tier = result.guidance.late.variants[0].tiers![0];
        expect(tier.maxDays).toBe(45);
    });

    it('preserves extra fields not surfaced in the form', () => {
        const med = { ...makeMed(), formGroupsSpec: [{ groupId: 'g1', fields: [] }] };
        renderForm(container, med);
        const result = collectFormData(container, med) as Record<string, unknown>;
        expect(result.formGroupsSpec).toBeDefined();
    });
});
