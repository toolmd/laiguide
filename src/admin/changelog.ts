import './styles/shared.css';
import './styles/changelog.css';
import { createGitHubStore } from '../services/github/store';
import { createLocalStore } from './localStore';
import { getSession } from './session';
import { GITHUB_OWNER, GITHUB_REPO } from './config';
import type { ChangelogEntry } from './types';

// Original med JSONs — copied once to src/data/originals/ and never overwritten by admin saves.
// This ensures "restore to default" always returns to the truly original data regardless of
// how many times admins have modified src/meds/*.json via the GitHub store.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BUNDLED_MED_ENTRIES = Object.entries(
    import.meta.glob<Record<string, unknown>>('../meds/originals/*.json', { eager: true, import: 'default' }),
);

function getBundledSnapshot(): Map<string, Record<string, unknown>> {
    const map = new Map<string, Record<string, unknown>>();
    for (const [path, data] of BUNDLED_MED_ENTRIES) {
        const key = path.replace(/^.*\/(.+)\.json$/, '$1');
        map.set(key, data);
    }
    return map;
}

const _enc = (window as unknown as Record<string, string>).__ADMIN_TOKEN__ ?? '';
const GITHUB_TOKEN = _enc
    ? atob(_enc).split('').map((c) => String.fromCharCode(c.charCodeAt(0) ^ 0x5a)).join('')
    : '';
const store = GITHUB_TOKEN
    ? createGitHubStore(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN)
    : createLocalStore();

const session = getSession();
if (!session) {
    window.location.href = './admin.html';
}

const tbody = document.getElementById('changelog-tbody') as HTMLTableSectionElement;
const statusEl = document.getElementById('changelog-status') as HTMLDivElement;
const restoreBar = document.getElementById('restore-bar') as HTMLDivElement;
const restoreSelect = document.getElementById('restore-time') as HTMLSelectElement;
const restoreBtn = document.getElementById('restore-btn') as HTMLButtonElement;

restoreBar.style.display = 'flex';

function formatTimestamp(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DEFAULT_TARGET = '__default__';

function populateRestoreDropdown(entries: ChangelogEntry[]): void {
    // Keep only update entries that have a snapshot, newest-first (already sorted).
    const savePoints = entries.filter((e) => e.action === 'update' && e.snapshot);

    restoreSelect.innerHTML = '<option value="">Select a save point…</option>';

    // Default data is always available — it's the bundled JSONs, never affected by admin saves.
    const defaultOpt = document.createElement('option');
    defaultOpt.value = DEFAULT_TARGET;
    defaultOpt.textContent = 'Default data (original bundled JSON)';
    restoreSelect.appendChild(defaultOpt);

    for (const entry of savePoints) {
        const opt = document.createElement('option');
        opt.value = entry.timestamp;
        opt.textContent = `${formatTimestamp(entry.timestamp)} — ${entry.displayName}`;
        restoreSelect.appendChild(opt);
    }

    restoreBtn.disabled = false;
}

function renderRow(entry: ChangelogEntry): HTMLTableRowElement[] {
    const tr = document.createElement('tr');
    tr.className =
        entry.action === 'delete'
            ? 'row-delete'
            : entry.action === 'restore'
              ? 'row-restore'
              : 'row-update';

    const tdTime = document.createElement('td');
    tdTime.textContent = formatTimestamp(entry.timestamp);

    const tdEmail = document.createElement('td');
    tdEmail.textContent = entry.email;

    const tdAction = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `action-badge action-${entry.action}`;

    const rows: HTMLTableRowElement[] = [tr];

    if (entry.action === 'update' && entry.changes && entry.changes.length > 0) {
        badge.textContent = `Updated ${entry.changes.length} item${entry.changes.length === 1 ? '' : 's'}`;
        badge.dataset.expandable = 'true';

        const detailsRow = document.createElement('tr');
        detailsRow.className = 'changelog-details';
        const detailsTd = document.createElement('td');
        detailsTd.colSpan = 4;
        const ul = document.createElement('ul');
        for (const change of entry.changes) {
            const li = document.createElement('li');
            if (typeof change === 'string') {
                li.textContent = change;
            } else {
                const pathSpan = document.createElement('span');
                pathSpan.className = 'change-path';
                pathSpan.textContent = change.path;
                const arrow = document.createTextNode(': ');
                const fromSpan = document.createElement('span');
                fromSpan.className = 'change-from';
                fromSpan.textContent = change.from;
                const sep = document.createTextNode(' → ');
                const toSpan = document.createElement('span');
                toSpan.className = 'change-to';
                toSpan.textContent = change.to;
                li.append(pathSpan, arrow, fromSpan, sep, toSpan);
            }
            ul.appendChild(li);
        }
        detailsTd.appendChild(ul);
        detailsRow.appendChild(detailsTd);
        rows.push(detailsRow);

        badge.addEventListener('click', () => {
            detailsRow.classList.toggle('open');
        });
    } else if (entry.action === 'restore' && entry.restoreTarget) {
        badge.textContent = 'Restored';
        badge.dataset.expandable = 'true';

        const detailsRow = document.createElement('tr');
        detailsRow.className = 'changelog-details';
        const detailsTd = document.createElement('td');
        detailsTd.colSpan = 4;
        detailsTd.textContent =
            entry.restoreTarget === DEFAULT_TARGET
                ? 'Restored to: default (original bundled) data'
                : `Restored to: ${formatTimestamp(entry.restoreTarget)}`;
        detailsRow.appendChild(detailsTd);
        rows.push(detailsRow);

        badge.addEventListener('click', () => {
            detailsRow.classList.toggle('open');
        });
    } else {
        badge.textContent = entry.action === 'update' ? 'Updated' : 'Deleted';
    }

    tdAction.appendChild(badge);

    const tdMed = document.createElement('td');
    tdMed.textContent = entry.displayName;

    tr.append(tdTime, tdEmail, tdAction, tdMed);
    return rows;
}

async function loadChangelog(): Promise<void> {
    try {
        const entries = await store.getChangelog();
        populateRestoreDropdown(entries);
        if (entries.length === 0) {
            statusEl.textContent = 'No changes have been recorded yet.';
            return;
        }
        statusEl.textContent = '';
        tbody.innerHTML = '';
        for (const entry of entries) {
            for (const row of renderRow(entry)) {
                tbody.appendChild(row);
            }
        }
    } catch (err) {
        statusEl.textContent = err instanceof Error ? err.message : 'Failed to load changelog.';
        statusEl.style.color = '#c0392b';
    }
}

restoreBtn.addEventListener('click', async () => {
    const targetIso = restoreSelect.value;
    if (!targetIso) {
        alert('Please select a save point to restore to.');
        return;
    }

    const isDefault = targetIso === DEFAULT_TARGET;
    const targetDisplay = isDefault
        ? 'default (original bundled) data'
        : formatTimestamp(targetIso);
    const confirmed = confirm(
        `Restore all medications to ${targetDisplay}?\n\nThis will overwrite all current local changes.`,
    );
    if (!confirmed) return;

    restoreBtn.disabled = true;
    restoreBtn.textContent = 'Restoring…';
    statusEl.textContent = '';

    try {
        let snapshot: Map<string, Record<string, unknown>>;

        if (isDefault) {
            snapshot = getBundledSnapshot();
        } else {
            const allEntries = await store.getChangelog();
            // Entries are newest-first; reverse to process oldest→newest so the
            // last write per medKey wins (i.e. closest to target time).
            snapshot = new Map<string, Record<string, unknown>>();
            for (const entry of [...allEntries].reverse()) {
                if (entry.timestamp <= targetIso && entry.action === 'update' && entry.snapshot) {
                    snapshot.set(entry.medKey, entry.snapshot);
                }
            }
        }

        for (const [key, data] of snapshot) {
            await store.saveMed(key, data);
        }

        if (session && GITHUB_TOKEN) {
            await store.appendChangelog({
                timestamp: new Date().toISOString(),
                email: session.email,
                action: 'restore',
                medKey: '*',
                displayName: `All medications (${snapshot.size} restored)`,
                restoreTarget: isDefault ? DEFAULT_TARGET : targetIso,
            });
        }

        await loadChangelog();
        statusEl.textContent = `✓ Restored ${snapshot.size} medication(s) to ${targetDisplay}`;
        statusEl.style.color = '#2d6a4f';
    } catch (err) {
        statusEl.textContent = err instanceof Error ? err.message : 'Restore failed.';
        statusEl.style.color = '#c0392b';
    } finally {
        restoreBtn.disabled = false;
        restoreBtn.textContent = 'Restore';
    }
});

void loadChangelog();
