// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    makeTextInput,
    makeNumberInput,
    makeComboInput,
    makeSection,
    collectFormData,
} from '../helpers';

// makeListEditor uses drag-drop which requires pointer events — mock it here.
vi.mock('../dragDrop', () => ({
    enableDrag: vi.fn(),
    refreshDragHandles: vi.fn(),
}));

// ─── makeTextInput ─────────────────────────────────────────────────────────

describe('makeTextInput', () => {
    it('returns a div.form-row', () => {
        expect(makeTextInput('Label', '', 'path').classList.contains('form-row')).toBe(true);
    });

    it('label text matches argument', () => {
        const row = makeTextInput('Medication Name', '', 'displayName');
        expect(row.querySelector('label')?.textContent).toBe('Medication Name');
    });

    it('input has the given value', () => {
        const input = makeTextInput(
            'Name',
            'Abilify',
            'displayName',
        ).querySelector<HTMLInputElement>('input')!;
        expect(input.value).toBe('Abilify');
        expect(input.type).toBe('text');
    });

    it('input carries data-path attribute', () => {
        const input = makeTextInput('Name', '', 'guidance.note').querySelector<HTMLInputElement>(
            'input',
        )!;
        expect(input.dataset.path).toBe('guidance.note');
    });
});

// ─── makeNumberInput ───────────────────────────────────────────────────────

describe('makeNumberInput', () => {
    it('converts number value to string for input.value', () => {
        const input = makeNumberInput('Days', 28, 'maxDays').querySelector<HTMLInputElement>(
            'input',
        )!;
        expect(input.value).toBe('28');
        expect(input.type).toBe('number');
    });

    it('uses empty string for null value', () => {
        const input = makeNumberInput('Days', null, 'maxDays').querySelector<HTMLInputElement>(
            'input',
        )!;
        expect(input.value).toBe('');
    });

    it('carries data-path attribute', () => {
        const input = makeNumberInput(
            'Days',
            14,
            'tiers.0.maxDays',
        ).querySelector<HTMLInputElement>('input')!;
        expect(input.dataset.path).toBe('tiers.0.maxDays');
    });
});

// ─── makeComboInput ────────────────────────────────────────────────────────

describe('makeComboInput', () => {
    it('input has the given initial value', () => {
        const input = makeComboInput(
            'Group',
            'Antipsychotics',
            'optgroupLabel',
            [],
            'l1',
        ).querySelector<HTMLInputElement>('input')!;
        expect(input.value).toBe('Antipsychotics');
    });

    it('datalist contains all provided options', () => {
        const row = makeComboInput('Group', '', 'optgroupLabel', ['Alpha', 'Beta', 'Gamma'], 'l2');
        const opts = [...row.querySelectorAll<HTMLOptionElement>('datalist option')].map(
            (o) => o.value,
        );
        expect(opts).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('input list attribute matches datalist id', () => {
        const row = makeComboInput('Group', '', 'path', [], 'my-list');
        expect(row.querySelector('input')?.getAttribute('list')).toBe('my-list');
        expect(row.querySelector('datalist')?.id).toBe('my-list');
    });

    it('focus clears the current value so all options appear', () => {
        const input = makeComboInput(
            'Group',
            'Antipsychotics',
            'path',
            ['Antipsychotics', 'Other'],
            'l3',
        ).querySelector<HTMLInputElement>('input')!;
        input.dispatchEvent(new Event('focus'));
        expect(input.value).toBe('');
    });

    it('focus saves the previous value in dataset.saved', () => {
        const input = makeComboInput(
            'Group',
            'Antipsychotics',
            'path',
            [],
            'l4',
        ).querySelector<HTMLInputElement>('input')!;
        input.dispatchEvent(new Event('focus'));
        expect(input.dataset.saved).toBe('Antipsychotics');
    });

    it('blur restores saved value when input is still empty', () => {
        const input = makeComboInput(
            'Group',
            'Antipsychotics',
            'path',
            [],
            'l5',
        ).querySelector<HTMLInputElement>('input')!;
        input.dispatchEvent(new Event('focus'));
        input.dispatchEvent(new Event('blur'));
        expect(input.value).toBe('Antipsychotics');
    });

    it('blur keeps newly entered value when input is non-empty', () => {
        const input = makeComboInput(
            'Group',
            'Antipsychotics',
            'path',
            [],
            'l6',
        ).querySelector<HTMLInputElement>('input')!;
        input.dispatchEvent(new Event('focus'));
        input.value = 'New Group';
        input.dispatchEvent(new Event('blur'));
        expect(input.value).toBe('New Group');
    });

    it('blur removes dataset.saved', () => {
        const input = makeComboInput(
            'Group',
            'Antipsychotics',
            'path',
            [],
            'l7',
        ).querySelector<HTMLInputElement>('input')!;
        input.dispatchEvent(new Event('focus'));
        input.dispatchEvent(new Event('blur'));
        expect(input.dataset.saved).toBeUndefined();
    });

    it('empty initial value stays empty after focus+blur with no selection', () => {
        const input = makeComboInput(
            'Group',
            '',
            'path',
            ['Alpha'],
            'l8',
        ).querySelector<HTMLInputElement>('input')!;
        input.dispatchEvent(new Event('focus'));
        input.dispatchEvent(new Event('blur'));
        expect(input.value).toBe('');
    });
});

// ─── makeSection ──────────────────────────────────────────────────────────

describe('makeSection', () => {
    it('is not collapsed by default', () => {
        expect(makeSection('Title').section.classList.contains('collapsed')).toBe(false);
    });

    it('is collapsed when collapsed=true is passed', () => {
        expect(makeSection('Title', true).section.classList.contains('collapsed')).toBe(true);
    });

    it('clicking the header toggles the collapsed class', () => {
        const { section } = makeSection('Toggle');
        const header = section.querySelector<HTMLDivElement>('.form-section-header')!;
        header.click();
        expect(section.classList.contains('collapsed')).toBe(true);
        header.click();
        expect(section.classList.contains('collapsed')).toBe(false);
    });

    it('returned body has class form-section-body', () => {
        expect(makeSection('S').body.classList.contains('form-section-body')).toBe(true);
    });

    it('title text appears in header', () => {
        const { section } = makeSection('My Section');
        expect(section.querySelector('.form-section-header')?.textContent).toContain('My Section');
    });
});

// ─── collectFormData / setNested (tested indirectly) ─────────────────────

describe('collectFormData', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
    });

    it('collects a top-level text input', () => {
        container.append(makeTextInput('Name', 'Abilify Maintena', 'displayName'));
        expect(collectFormData(container, {}).displayName).toBe('Abilify Maintena');
    });

    it('collects a nested text input via dot-path', () => {
        container.append(makeTextInput('Note', 'hello', 'guidance.note'));
        const result = collectFormData(container, {});
        expect((result.guidance as Record<string, unknown>).note).toBe('hello');
    });

    it('collects number input as a number', () => {
        container.append(makeNumberInput('Days', 28, 'maxDays'));
        expect(collectFormData(container, {}).maxDays).toBe(28);
    });

    it('empty number input preserves null when path already existed in original', () => {
        container.append(makeNumberInput('Days', null, 'maxDays'));
        expect(collectFormData(container, { maxDays: null }).maxDays).toBeNull();
    });

    it('empty number input does not add key when path was absent in original', () => {
        container.append(makeNumberInput('Days', null, 'maxDays'));
        expect(collectFormData(container, {}).maxDays).toBeUndefined();
    });

    it('empty text input removes the key', () => {
        container.append(makeTextInput('Name', '', 'displayName'));
        expect(collectFormData(container, { displayName: 'Old' }).displayName).toBeUndefined();
    });

    it('empty text input does not add key when absent in original', () => {
        container.append(makeTextInput('SameAs', '', 'sameAs'));
        expect(collectFormData(container, {}).sameAs).toBeUndefined();
    });

    it('handles array index in path (tiers.0.maxDays)', () => {
        container.append(makeNumberInput('Days', 14, 'tiers.0.maxDays'));
        const tiers = collectFormData(container, {}).tiers as Record<string, unknown>[];
        expect(tiers[0].maxDays).toBe(14);
    });

    it('preserves fields from currentMedData not present in the form', () => {
        container.append(makeTextInput('Name', 'New', 'displayName'));
        const result = collectFormData(container, { displayName: 'Old', extra: 'preserved' });
        expect(result.extra).toBe('preserved');
    });

    it('does not mutate currentMedData', () => {
        const original = { displayName: 'Old' };
        container.append(makeTextInput('Name', 'New', 'displayName'));
        collectFormData(container, original);
        expect(original.displayName).toBe('Old');
    });

    it('collects list editor items into an array', () => {
        // Build a minimal .list-editor structure manually to avoid drag-drop dependency
        const listEditor = document.createElement('div');
        listEditor.className = 'list-editor';
        listEditor.dataset.path = 'steps';
        const makeItem = (text: string) => {
            const item = document.createElement('div');
            item.className = 'list-item';
            const ta = document.createElement('textarea');
            ta.value = text;
            item.append(ta);
            return item;
        };
        listEditor.append(makeItem('Step one'), makeItem('Step two'), makeItem('  '));
        container.append(listEditor);

        const result = collectFormData(container, {});
        // Blank/whitespace items should be excluded
        expect(result.steps).toEqual(['Step one', 'Step two']);
    });

    it('sets nested array element via path with multiple segments', () => {
        container.append(makeTextInput('Label', 'val', 'a.b.c'));
        const result = collectFormData(container, {});
        expect(((result.a as Record<string, unknown>).b as Record<string, unknown>).c).toBe('val');
    });

    it('sets key to empty array when all list items are blank (preserves empty array)', () => {
        // Build a list editor with only whitespace items
        const listEditor = document.createElement('div');
        listEditor.className = 'list-editor';
        listEditor.dataset.path = 'steps';
        const makeItem = (text: string) => {
            const item = document.createElement('div');
            item.className = 'list-item';
            const ta = document.createElement('textarea');
            ta.value = text;
            item.append(ta);
            return item;
        };
        listEditor.append(makeItem('  '), makeItem('\t'));
        container.append(listEditor);

        // Empty list should produce [] rather than deleting the key
        const result = collectFormData(container, { steps: ['old step'] });
        expect(result.steps).toEqual([]);
    });
});
