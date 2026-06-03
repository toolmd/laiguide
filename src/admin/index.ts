import './styles/shared.css';
import './styles/editor.css';
import { createGitHubStore } from '../services/github/store';
import { createLocalStore } from './localStore';
import { getSession, setSession, clearSession, sha256 } from './session';
import { REQUIRED_EMAIL_VALUE, ACCESS_CODE_HASH, GITHUB_OWNER, GITHUB_REPO } from './config';
import { renderForm, collectFormData, renderDefinitionsForm } from './forms/index';
import { validateMedJson } from './validate';
import { diffMed } from './diffMed';
import type { MedDataStore } from '../services/interfaces';
import type { RawMedJson } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDefinitionsData(data: Record<string, unknown>): boolean {
    return Object.values(data).some(
        (v) => !!v && typeof v === 'object' && !!(v as Record<string, unknown>).groupTitle,
    );
}

// ── Store ────────────────────────────────────────────────────────────────────

// __ADMIN_TOKEN__ is written to admin-rt.js by the deploy workflow at deploy time.
// It holds the XOR-encoded PAT so the token is never baked into the build itself.
const _enc = (window as unknown as Record<string, string>).__ADMIN_TOKEN__ ?? '';
const GITHUB_TOKEN = _enc
    ? atob(_enc).split('').map((c) => String.fromCharCode(c.charCodeAt(0) ^ 0x5a)).join('')
    : '';
const store: MedDataStore = GITHUB_TOKEN
    ? createGitHubStore(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN)
    : createLocalStore();

// ── DOM refs ─────────────────────────────────────────────────────────────────

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const loginSection = $<HTMLDivElement>('login-section');
const editorSection = $<HTMLDivElement>('editor-section');
const emailInput = $<HTMLInputElement>('email-input');
const codeInput = $<HTMLInputElement>('code-input');
const loginBtn = $<HTMLButtonElement>('login-btn');
const loginError = $<HTMLDivElement>('login-error');
const deployStatus = $<HTMLDivElement>('deploy-status');
const userEmail = $<HTMLSpanElement>('user-email');
const logoutBtn = $<HTMLButtonElement>('logout-btn');
const medSelect = $<HTMLSelectElement>('med-select');
const saveBtn = $<HTMLButtonElement>('save-btn');
const deleteBtn = $<HTMLButtonElement>('delete-btn');
const jsonEditor = $<HTMLTextAreaElement>('json-editor');
const jsonSection = $<HTMLDivElement>('json-section');
const formEditorEl = $<HTMLDivElement>('form-editor');
const toggleJsonBtn = $<HTMLButtonElement>('toggle-json-btn');
const topStatus = $<HTMLSpanElement>('top-status');

// ── State ────────────────────────────────────────────────────────────────────

let currentMedData: Record<string, unknown> | null = null;
let jsonMode = false;
let existingGroups: string[] = [];

// ── UI helpers ───────────────────────────────────────────────────────────────

function showLoginError(msg: string): void {
    loginError.textContent = msg;
    loginError.style.display = 'block';
}

function showStatus(msg: string, ok: boolean): void {
    topStatus.textContent = msg;
    topStatus.className = ok ? 'status-ok' : 'status-err';
}

// ── View transitions ─────────────────────────────────────────────────────────

function showEditor(email: string): void {
    loginSection.style.display = 'none';
    editorSection.style.display = 'block';
    userEmail.textContent = email;
    void loadMedList();
}

function showLogin(): void {
    loginSection.style.display = 'block';
    editorSection.style.display = 'none';
    formEditorEl.innerHTML = '';
    jsonEditor.value = '';
    topStatus.textContent = '';
}

// ── Data loading ─────────────────────────────────────────────────────────────

async function loadMedList(): Promise<void> {
    try {
        medSelect.innerHTML = '<option value="">Select a medication…</option>';
        const keys = await store.listMedKeys();
        keys.sort();
        const meds = await Promise.all(
            keys.map(async (k) => {
                const d = await store.getMed(k);
                // Definitions file: use "Definitions" as group, groupTitle of first group as displayName
                const firstDefGroup = Object.values(d ?? {}).find(
                    (v) =>
                        !!v && typeof v === 'object' && !!(v as Record<string, unknown>).groupTitle,
                ) as Record<string, unknown> | undefined;
                if (firstDefGroup) {
                    return {
                        key: k,
                        displayName: firstDefGroup.groupTitle as string,
                        optgroupLabel: 'Definitions',
                    };
                }
                return {
                    key: k,
                    displayName: (d?.displayName as string) ?? k,
                    optgroupLabel: (d?.optgroupLabel as string) ?? '',
                };
            }),
        );

        // Collect unique medication groups for the combobox
        existingGroups = [...new Set(meds.map((m) => m.optgroupLabel).filter(Boolean))].sort();

        // Group by optgroupLabel; entries with no optgroupLabel use the key (first letter capitalised)
        const groups = new Map<string, { key: string; displayName: string }[]>();
        for (const m of meds) {
            let groupLabel = m.optgroupLabel;
            let displayName = m.displayName;
            if (!groupLabel) {
                groupLabel = m.key.charAt(0).toUpperCase() + m.key.slice(1);
                displayName = groupLabel;
            }
            if (!groups.has(groupLabel)) groups.set(groupLabel, []);
            groups.get(groupLabel)!.push({ key: m.key, displayName });
        }

        // Sort groups alphabetically
        const sortedGroupLabels = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
        for (const groupLabel of sortedGroupLabels) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = groupLabel;
            const entries = groups.get(groupLabel)!;
            entries.sort((a, b) => a.displayName.localeCompare(b.displayName));
            for (const entry of entries) {
                const opt = document.createElement('option');
                opt.value = entry.key;
                opt.textContent = entry.displayName;
                optgroup.appendChild(opt);
            }
            medSelect.appendChild(optgroup);
        }
    } catch (err: unknown) {
        console.error('[loadMedList] Failed to load medication list:', err);
        showStatus('Failed to load medication list. Check your connection or token.', false);
    }
}

async function loadMed(key: string): Promise<void> {
    formEditorEl.innerHTML = '';
    jsonEditor.value = '';
    deployStatus.textContent = '';
    currentMedData = null;
    if (!key) {
        toggleJsonBtn.style.display = 'none';
        return;
    }
    try {
        const data = await store.getMed(key);
        if (data) {
            currentMedData = data;
            toggleJsonBtn.style.display = '';
            if (jsonMode) {
                jsonMode = false;
                jsonSection.style.display = 'none';
                formEditorEl.style.display = 'block';
                toggleJsonBtn.textContent = 'JSON View';
            }
            if (isDefinitionsData(data)) {
                renderDefinitionsForm(formEditorEl, data);
            } else {
                renderForm(formEditorEl, data as RawMedJson, existingGroups);
            }
            jsonEditor.value = JSON.stringify(data, null, 2);
        } else {
            showStatus(`"${key}" not found.`, false);
        }
    } catch (err: unknown) {
        console.error(`[loadMed] Failed to load "${key}":`, err);
        showStatus(err instanceof Error ? err.message : `Failed to load "${key}".`, false);
    }
}

// ── Auth flow ─────────────────────────────────────────────────────────────────

loginBtn.addEventListener('click', async () => {
    loginError.style.display = 'none';
    const email = emailInput.value.trim().toLowerCase();
    const code = codeInput.value;

    if (!email) {
        showLoginError('Email is required.');
        return;
    }
    if (!code) {
        showLoginError('Access code is required.');
        return;
    }

    try {
        const hash = await sha256(code);
        if (!email.includes(REQUIRED_EMAIL_VALUE) || hash !== ACCESS_CODE_HASH) {
            showLoginError('Email and/or access code is invalid.');
            return;
        }
        setSession(email);
        showEditor(email);
    } catch (err: unknown) {
        console.error('[loginBtn] Login error:', err);
        showLoginError('An unexpected error occurred. Please try again.');
    }
});

codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

logoutBtn.addEventListener('click', () => {
    clearSession();
    showLogin();
});

const existing = getSession();
if (existing) {
    showEditor(existing.email);
} else {
    showLogin();
}

// ── Editor actions ────────────────────────────────────────────────────────────

medSelect.addEventListener('change', () => {
    loadMed(medSelect.value).catch((err: unknown) => {
        console.error('[medSelect] Failed to load medication:', err);
        showStatus('Failed to load medication.', false);
    });
});

toggleJsonBtn.addEventListener('click', () => {
    jsonMode = !jsonMode;
    if (jsonMode) {
        if (currentMedData) {
            jsonEditor.value = JSON.stringify(
                collectFormData(formEditorEl, currentMedData),
                null,
                2,
            );
        }
        formEditorEl.style.display = 'none';
        jsonSection.style.display = 'block';
        toggleJsonBtn.textContent = 'Form View';
    } else {
        try {
            const parsed = JSON.parse(jsonEditor.value) as Record<string, unknown>;
            currentMedData = parsed;
            renderForm(formEditorEl, parsed as RawMedJson);
        } catch {
            showStatus('Invalid JSON — cannot switch to form view.', false);
            return;
        }
        formEditorEl.style.display = 'block';
        jsonSection.style.display = 'none';
        toggleJsonBtn.textContent = 'JSON View';
    }
});

saveBtn.addEventListener('click', async () => {
    const key = medSelect.value;
    if (!key) {
        showStatus('Select a medication first.', false);
        return;
    }

    let raw: unknown;
    if (jsonMode) {
        try {
            raw = JSON.parse(jsonEditor.value);
        } catch {
            showStatus('Invalid JSON — fix syntax errors before saving.', false);
            return;
        }
    } else {
        raw = currentMedData ? collectFormData(formEditorEl, currentMedData) : {};
    }

    const result = validateMedJson(raw);
    if (!result.ok) {
        showStatus(`⚠ Invalid value: ${result.error}`, false);
        return;
    }

    try {
        const previousData = currentMedData ? { ...currentMedData } : {};
        await store.saveMed(key, result.data);
        currentMedData = result.data;
        const session = getSession();
        if (session && GITHUB_TOKEN) {
            const changes = diffMed(
                previousData as Record<string, unknown>,
                result.data as Record<string, unknown>,
            );
            void store.appendChangelog({
                timestamp: new Date().toISOString(),
                email: session.email,
                action: 'update',
                medKey: key,
                displayName: (result.data.displayName as string) ?? key,
                changes,
                snapshot: result.data,
            });
        }
        showStatus(GITHUB_TOKEN ? `✓ Saved "${key}" — changes will take effect in ~5 mins` : `✓ Saved "${key}" (local only)`, true);
        deployStatus.textContent = '';
    } catch (err: unknown) {
        showStatus(err instanceof Error ? err.message : 'Save failed.', false);
    }
});

deleteBtn.addEventListener('click', async () => {
    const key = medSelect.value;
    if (!key) {
        showStatus('Select a medication to delete.', false);
        return;
    }
    if (!confirm(`Delete "${key}"? This cannot be undone.`)) return;
    const displayNameBeforeDelete = (currentMedData?.displayName as string) ?? key;
    try {
        await store.deleteMed(key);
        const session = getSession();
        if (session && GITHUB_TOKEN) {
            void store.appendChangelog({
                timestamp: new Date().toISOString(),
                email: session.email,
                action: 'delete',
                medKey: key,
                displayName: displayNameBeforeDelete,
            });
        }
        showStatus(`✓ Deleted "${key}"`, true);
        deployStatus.textContent = '';
        await loadMedList();
        jsonEditor.value = '';
    } catch (err: unknown) {
        showStatus(err instanceof Error ? err.message : 'Delete failed.', false);
    }
});

// ── Form event listeners ──────────────────────────────────────────────────────

formEditorEl.addEventListener('addscenario', () => {
    try {
        if (!currentMedData) return;
        const collected = collectFormData(formEditorEl, currentMedData) as RawMedJson;
        collected.guidance.late.variants.push({
            key: 'new-scenario',
            tiers: [{ maxDays: null, guidance: { idealSteps: [''] } }],
        });
        currentMedData = collected;
        renderForm(formEditorEl, collected);
    } catch (err: unknown) {
        console.error('[addscenario] Failed to add scenario:', err);
    }
});

formEditorEl.addEventListener('removescenario', (e) => {
    try {
        if (!currentMedData) return;
        const { variantIdx } = (e as CustomEvent<{ variantIdx: number }>).detail;
        const collected = collectFormData(formEditorEl, currentMedData) as RawMedJson;
        collected.guidance.late.variants.splice(variantIdx, 1);
        currentMedData = collected;
        renderForm(formEditorEl, collected);
    } catch (err: unknown) {
        console.error('[removescenario] Failed to remove scenario:', err);
    }
});
