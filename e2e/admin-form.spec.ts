import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL = 'test@desc.org';
const TEST_CODE = '1234';

async function login(page: Page): Promise<void> {
    await page.goto('/admin.html');
    await page.fill('#email-input', TEST_EMAIL);
    await page.fill('#code-input', TEST_CODE);
    await page.click('#login-btn');
    await expect(page.locator('#editor-section')).toBeVisible();
}

async function selectFirstMed(page: Page): Promise<void> {
    await page.locator('#med-select').selectOption({ value: 'vivitrol' });
    await expect(page.locator('.form-tab-bar')).toBeVisible();
}

// ─── Tab bar rendering ────────────────────────────────────────────────────

test.describe('admin form — tab bar', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/admin.html');
        await page.evaluate(() => localStorage.clear());
        await login(page);
        await selectFirstMed(page);
    });

    test('shows tab bar with at least two buttons after selecting a medication', async ({
        page,
    }) => {
        await expect(page.locator('.form-tab-btn')).toHaveCount(
            await page.locator('.form-tab-btn').count(),
        );
        expect(await page.locator('.form-tab-btn').count()).toBeGreaterThanOrEqual(2);
    });

    test('Medication Info is the first tab and is active by default', async ({ page }) => {
        const firstTab = page.locator('.form-tab-btn').first();
        await expect(firstTab).toHaveText('Medication Info');
        await expect(firstTab).toHaveClass(/active/);
    });

    test('Medication Info panel is visible by default', async ({ page }) => {
        await expect(page.locator('[data-path="displayName"]')).toBeVisible();
        await expect(page.locator('[data-path="optgroupLabel"]')).toBeVisible();
    });

    test('Early Guidance tab is present and shows early fields when clicked', async ({ page }) => {
        const tab = page.locator('.form-tab-btn', { hasText: 'Early Guidance' });
        await expect(tab).toBeVisible();
        await tab.click();
        await expect(tab).toHaveClass(/active/);
        await expect(page.locator('[data-path="guidance.early.minDays"]')).toBeVisible();
    });

    test('Shared Notifications tab is present and shows shared fields when clicked', async ({
        page,
    }) => {
        const tab = page.locator('.form-tab-btn', { hasText: 'Shared Notifications' });
        await expect(tab).toBeVisible();
        await tab.click();
        await expect(tab).toHaveClass(/active/);
        await expect(
            page.locator('[data-path="guidance.shared.providerNotifications"]'),
        ).toBeVisible();
    });

    test('Overdue Guidance tab is present and shows late guidance when clicked', async ({
        page,
    }) => {
        const tab = page.locator('.form-tab-btn', { hasText: 'Overdue Guidance' });
        await expect(tab).toBeVisible();
        await tab.click();
        await expect(tab).toHaveClass(/active/);
        await expect(page.locator('.variant-block').first()).toBeVisible();
    });

    test('switching tabs hides the previous panel', async ({ page }) => {
        await expect(page.locator('[data-path="displayName"]')).toBeVisible();

        await page.locator('.form-tab-btn', { hasText: 'Overdue Guidance' }).click();

        await expect(page.locator('[data-path="displayName"]')).not.toBeVisible();
    });

    test('selecting a different medication resets to Medication Info tab', async ({ page }) => {
        await page.locator('.form-tab-btn', { hasText: 'Overdue Guidance' }).click();
        await expect(page.locator('.form-tab-btn').first()).not.toHaveClass(/active/);

        await page.locator('#med-select').selectOption({ index: 2 });
        await expect(page.locator('.form-tab-bar')).toBeVisible();

        await expect(page.locator('.form-tab-btn').first()).toHaveClass(/active/);
        await expect(page.locator('[data-path="displayName"]')).toBeVisible();
    });
});

// ─── Tab bar — field persistence across tabs ──────────────────────────────

test.describe('admin form — edits survive tab switches', () => {
    test.skip(
        !!process.env.PLAYWRIGHT_BASE_URL,
        'localStorage persistence only applies to local dev',
    );

    test.beforeEach(async ({ page }) => {
        await page.goto('/admin.html');
        await page.evaluate(() => localStorage.clear());
        await login(page);
        await selectFirstMed(page);
    });

    test('value entered in Medication Info is preserved after switching tabs and back', async ({
        page,
    }) => {
        const input = page.locator('[data-path="displayName"]');
        await input.fill('Modified Name');

        await page.locator('.form-tab-btn', { hasText: 'Overdue Guidance' }).click();
        await page.locator('.form-tab-btn').first().click();

        await expect(input).toHaveValue('Modified Name');
    });
});
