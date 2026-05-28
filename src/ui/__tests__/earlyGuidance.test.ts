// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { showEarlyGuidance } from '../earlyGuidance';

vi.stubGlobal('scrollTo', vi.fn());

function localDaysAgo(n: number): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysFromNow(n: number): string {
    return localDaysAgo(-n);
}

function setInputVal(id: string, value: string): void {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.value = value;
}

function guidance(): Element | null {
    return document.querySelector('.guidance-section');
}

function setupDOM(): void {
    document.body.innerHTML = `
        <div class="form-section" style="display:block;"></div>
        <div class="disclaimer"></div>
        <input type="date" id="last-injection-date" value="" />
        <input type="date" id="next-injection-date" value="" />
        <input type="date" id="last-brixadi" value="" />
        <div id="start-over-bar" style="display:block;"></div>
    `;
}

// ── minDays-only path (abilify_maintena) ──────────────────────────────────────

describe('showEarlyGuidance — minDays-only path (abilify_maintena)', () => {
    beforeEach(setupDOM);

    it('shows "Early administration is allowed" when days >= minDays', () => {
        setInputVal('last-injection-date', localDaysAgo(30));
        showEarlyGuidance('abilify_maintena');
        expect(guidance()!.innerHTML).toContain('Early administration is allowed');
        expect(guidance()!.querySelector('.early-allowed')).not.toBeNull();
    });

    it('shows "Too early to administer" when days < minDays', () => {
        setInputVal('last-injection-date', localDaysAgo(10));
        showEarlyGuidance('abilify_maintena');
        expect(guidance()!.innerHTML).toContain('Too early to administer');
        expect(guidance()!.querySelector('.early-not-allowed')).not.toBeNull();
    });

    it('renders the "Early administration window:" section', () => {
        setInputVal('last-injection-date', localDaysAgo(30));
        showEarlyGuidance('abilify_maintena');
        expect(guidance()!.innerHTML).toContain('Early administration window:');
    });

    it('renders the "When to notify provider:" section with notify-box class', () => {
        setInputVal('last-injection-date', localDaysAgo(30));
        showEarlyGuidance('abilify_maintena');
        expect(guidance()!.querySelector('.notify-box')).not.toBeNull();
        expect(guidance()!.innerHTML).toContain('When to notify provider:');
    });

    it('hides the form section after rendering', () => {
        setInputVal('last-injection-date', localDaysAgo(30));
        showEarlyGuidance('abilify_maintena');
        expect(document.querySelector<HTMLElement>('.form-section')!.style.display).toBe('none');
    });

    it('includes medication name in the info rows', () => {
        setInputVal('last-injection-date', localDaysAgo(30));
        showEarlyGuidance('abilify_maintena');
        expect(guidance()!.innerHTML).toContain('Abilify Maintena');
    });

    it('shows remaining days message when too early', () => {
        setInputVal('last-injection-date', localDaysAgo(10));
        showEarlyGuidance('abilify_maintena');
        expect(guidance()!.innerHTML).toContain('remaining');
    });
});

// ── window-only path (invega_trinza) ──────────────────────────────────────────

describe('showEarlyGuidance — window-only path (invega_trinza)', () => {
    beforeEach(setupDOM);

    it('shows "Administer today" when scheduled for today', () => {
        setInputVal('next-injection-date', localDaysAgo(0));
        showEarlyGuidance('invega_trinza');
        expect(guidance()!.innerHTML).toContain('Administer today');
        expect(guidance()!.querySelector('.early-allowed')).not.toBeNull();
    });

    it('shows "Early administration is allowed" when within early window', () => {
        setInputVal('next-injection-date', daysFromNow(3));
        showEarlyGuidance('invega_trinza');
        expect(guidance()!.innerHTML).toContain('Early administration is allowed');
        expect(guidance()!.querySelector('.early-allowed')).not.toBeNull();
    });

    it('shows "Too early to administer" when outside early window', () => {
        setInputVal('next-injection-date', daysFromNow(60));
        showEarlyGuidance('invega_trinza');
        expect(guidance()!.innerHTML).toContain('Too early to administer');
        expect(guidance()!.querySelector('.early-not-allowed')).not.toBeNull();
    });

    it('renders the early administration window section', () => {
        setInputVal('next-injection-date', daysFromNow(3));
        showEarlyGuidance('invega_trinza');
        expect(guidance()!.innerHTML).toContain('Early administration window:');
    });
});

// ── dual-constraint path (aristada) ───────────────────────────────────────────

describe('showEarlyGuidance — dual-constraint path (aristada)', () => {
    beforeEach(setupDOM);

    it('shows allowed when both criteria are met', () => {
        setInputVal('next-injection-date', daysFromNow(1));
        setInputVal('last-injection-date', localDaysAgo(35));
        showEarlyGuidance('aristada');
        expect(guidance()!.innerHTML).toContain('Early administration is allowed');
        expect(guidance()!.querySelector('.early-allowed')).not.toBeNull();
    });

    it('shows denied when within window but not past minimum days', () => {
        setInputVal('next-injection-date', daysFromNow(1));
        setInputVal('last-injection-date', localDaysAgo(5));
        showEarlyGuidance('aristada');
        expect(guidance()!.innerHTML).toContain('Too early to administer');
        expect(guidance()!.querySelector('.early-not-allowed')).not.toBeNull();
    });

    it('shows denied when past minimum days but outside early window', () => {
        setInputVal('next-injection-date', daysFromNow(60));
        setInputVal('last-injection-date', localDaysAgo(35));
        showEarlyGuidance('aristada');
        expect(guidance()!.innerHTML).toContain('Too early to administer');
    });

    it('shows both criteria status lines when denied', () => {
        setInputVal('next-injection-date', daysFromNow(60));
        setInputVal('last-injection-date', localDaysAgo(5));
        showEarlyGuidance('aristada');
        const html = guidance()!.innerHTML;
        // Both window and min-days checks should appear
        expect(html).toContain('window');
        expect(html).toContain('remaining');
    });

    it('shows "Both criteria are met" message when allowed', () => {
        setInputVal('next-injection-date', daysFromNow(1));
        setInputVal('last-injection-date', localDaysAgo(35));
        showEarlyGuidance('aristada');
        expect(guidance()!.innerHTML).toContain('Both criteria are met');
    });
});

// ── variant path (brixadi) ────────────────────────────────────────────────────

describe('showEarlyGuidance — variant path (brixadi)', () => {
    beforeEach(setupDOM);

    it('shows early guidance for weekly variant using shared minDays', () => {
        setInputVal('last-brixadi', localDaysAgo(25));
        showEarlyGuidance('brixadi', 'weekly');
        const html = guidance()!.innerHTML;
        expect(html).toMatch(/Early administration is allowed|Too early to administer/);
    });

    it('shows "Early administration is allowed" for monthly variant when >= minDays', () => {
        setInputVal('last-brixadi', localDaysAgo(25));
        showEarlyGuidance('brixadi', 'monthly-64');
        expect(guidance()!.innerHTML).toContain('Early administration is allowed');
        expect(guidance()!.querySelector('.early-allowed')).not.toBeNull();
    });

    it('shows "Too early to administer" for monthly variant when < minDays', () => {
        setInputVal('last-brixadi', localDaysAgo(10));
        showEarlyGuidance('brixadi', 'monthly-64');
        expect(guidance()!.innerHTML).toContain('Too early to administer');
        expect(guidance()!.querySelector('.early-not-allowed')).not.toBeNull();
    });

    it('renders "Formulation:" info row for variant path', () => {
        setInputVal('last-brixadi', localDaysAgo(25));
        showEarlyGuidance('brixadi', 'monthly-64');
        expect(guidance()!.innerHTML).toContain('Formulation:');
    });

    it('renders the notify-box for monthly variant', () => {
        setInputVal('last-brixadi', localDaysAgo(25));
        showEarlyGuidance('brixadi', 'monthly-64');
        expect(guidance()!.querySelector('.notify-box')).not.toBeNull();
    });

    it('monthly-96 allowed when >= minDays', () => {
        setInputVal('last-brixadi', localDaysAgo(25));
        showEarlyGuidance('brixadi', 'monthly-96');
        expect(guidance()!.innerHTML).toContain('Early administration is allowed');
    });

    it('monthly-64 variant guidanceNote appears in guidance text', () => {
        setInputVal('last-brixadi', localDaysAgo(25));
        showEarlyGuidance('brixadi', 'monthly-64');
        expect(guidance()!.innerHTML).toContain('This may be given earlier with provider approval');
    });

    it('renders variant guidanceNote as list items', () => {
        setInputVal('last-brixadi', localDaysAgo(25));
        showEarlyGuidance('brixadi', 'monthly-64');
        expect(guidance()!.querySelector('.guidance-text ul')).not.toBeNull();
        const items = [...guidance()!.querySelectorAll('.guidance-text ul li')].map(
            (li) => li.textContent ?? '',
        );
        expect(items.some((t) => t.includes('This may be given earlier with provider approval'))).toBe(
            true,
        );
    });

    it('weekly variant shows its own guidanceNote', () => {
        setInputVal('last-brixadi', localDaysAgo(10));
        showEarlyGuidance('brixadi', 'weekly');
        expect(guidance()!.innerHTML).toContain(
            'This may be given earlier with provider approval',
        );
    });

    it('variant guidanceNote appears before earlySharedNotes', async () => {
        const { MED_REGISTRY } = await import('../../medLoader');
        const origShared = MED_REGISTRY['brixadi'].earlySharedNotes;
        MED_REGISTRY['brixadi'].earlySharedNotes = ['Shared note'];
        setInputVal('last-brixadi', localDaysAgo(25));
        showEarlyGuidance('brixadi', 'monthly-64');
        const items = [...guidance()!.querySelectorAll('.guidance-text ul li')].map(
            (li) => li.textContent ?? '',
        );
        const variantIdx = items.findIndex((t) => t.includes('This may be given earlier'));
        const sharedIdx = items.findIndex((t) => t.includes('Shared note'));
        expect(variantIdx).toBeGreaterThanOrEqual(0);
        expect(sharedIdx).toBeGreaterThanOrEqual(0);
        expect(variantIdx).toBeLessThan(sharedIdx);
        MED_REGISTRY['brixadi'].earlySharedNotes = origShared;
    });
});

// ── error recovery ────────────────────────────────────────────────────────────

describe('showEarlyGuidance — error recovery and robustness', () => {
    beforeEach(setupDOM);

    it('renders an error UI when called with an unknown medication key', () => {
        showEarlyGuidance('totally_unknown_medication_xyz');
        expect(guidance()).not.toBeNull();
        expect(guidance()!.innerHTML).toContain('error');
    });
});
