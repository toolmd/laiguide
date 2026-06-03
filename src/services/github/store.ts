import type { MedDataStore } from '../interfaces';
import type { ChangelogEntry } from '../../admin/types';

const MEDS_PATH = 'src/meds';
const CHANGELOG_PATH = 'src/data/changelog.json';

interface GitHubFile {
    name: string;
    path: string;
    sha: string;
    download_url: string;
}

interface GitHubContentResponse {
    sha: string;
    content: string;
    encoding: string;
}

/** Encode a byte array to base64 without spreading into String.fromCodePoint,
 *  which hits the JS call-stack argument limit on arrays larger than ~65 K. */
function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

function headers(token: string): HeadersInit {
    return {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
    };
}

async function ghFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        headers: { ...headers(token), ...init?.headers },
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`GitHub API ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
}

/** PUT a file, retrying once on 409 (SHA mismatch) by re-fetching the current SHA. */
async function putFile(
    api: string,
    filePath: string,
    token: string,
    branch: string,
    message: string,
    content: string,
    sha: string | null,
): Promise<void> {
    const url = `${api}/contents/${filePath}`;
    const body = (currentSha: string | null) =>
        JSON.stringify({ message, content, branch, ...(currentSha ? { sha: currentSha } : {}) });

    const res = await fetch(url, {
        method: 'PUT',
        headers: headers(token),
        body: body(sha),
    });

    if (res.status === 409) {
        // SHA is stale — re-fetch and retry once
        const [owner, repo] = api.replace('https://api.github.com/repos/', '').split('/');
        const freshSha = await getFileSha(owner, repo, filePath, token, branch);
        await ghFetch(url, token, { method: 'PUT', body: body(freshSha) });
        return;
    }

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`GitHub API ${res.status}: ${errBody}`);
    }
}

/** Get the SHA of an existing file (needed for updates and deletes). */
async function getFileSha(
    owner: string,
    repo: string,
    path: string,
    token: string,
    branch: string,
): Promise<string | null> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const res = await fetch(url, { headers: headers(token) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as GitHubContentResponse;
    return data.sha;
}

export function createGitHubStore(
    owner: string,
    repo: string,
    token: string,
    branch = 'main',
): MedDataStore {
    const api = `https://api.github.com/repos/${owner}/${repo}`;

    return {
        async listMedKeys(): Promise<string[]> {
            const files = await ghFetch<GitHubFile[]>(
                `${api}/contents/${MEDS_PATH}?ref=${branch}`,
                token,
            );
            return files
                .filter((f) => f.name.endsWith('.json'))
                .map((f) => f.name.replace(/\.json$/, ''));
        },

        async getMed(key: string): Promise<Record<string, unknown> | null> {
            const filePath = `${MEDS_PATH}/${key}.json`;
            const url = `${api}/contents/${filePath}?ref=${branch}`;
            const res = await fetch(url, { headers: headers(token) });
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
            const data = (await res.json()) as GitHubContentResponse;
            const bytes = Uint8Array.from(atob(data.content), (c) => c.charCodeAt(0));
            return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
        },

        async getAllMeds(): Promise<Record<string, unknown>[]> {
            const keys = await this.listMedKeys();
            const results = await Promise.all(keys.map((k) => this.getMed(k)));
            return results.filter((m): m is Record<string, unknown> => m !== null);
        },

        async saveMed(key: string, data: Record<string, unknown>): Promise<void> {
            const filePath = `${MEDS_PATH}/${key}.json`;
            const sha = await getFileSha(owner, repo, filePath, token, branch);
            const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2) + '\n');
            const content = bytesToBase64(bytes);
            await putFile(api, filePath, token, branch, `Update ${key} via admin portal`, content, sha);
        },

        async deleteMed(key: string): Promise<void> {
            const filePath = `${MEDS_PATH}/${key}.json`;
            const sha = await getFileSha(owner, repo, filePath, token, branch);
            if (!sha) throw new Error(`"${key}" not found in repository.`);
            await ghFetch(`${api}/contents/${filePath}`, token, {
                method: 'DELETE',
                body: JSON.stringify({
                    message: `Delete ${key} via admin portal`,
                    sha,
                    branch,
                }),
            });
        },

        async getChangelog(): Promise<ChangelogEntry[]> {
            const url = `${api}/contents/${CHANGELOG_PATH}?ref=${branch}`;
            const res = await fetch(url, { headers: headers(token) });
            if (res.status === 404) return [];
            if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
            const data = (await res.json()) as GitHubContentResponse;
            const bytes = Uint8Array.from(atob(data.content), (c) => c.charCodeAt(0));
            return JSON.parse(new TextDecoder().decode(bytes)) as ChangelogEntry[];
        },

        async appendChangelog(entry: ChangelogEntry): Promise<void> {
            const url = `${api}/contents/${CHANGELOG_PATH}?ref=${branch}`;
            const res = await fetch(url, { headers: headers(token) });
            let entries: ChangelogEntry[] = [];
            let sha: string | undefined;
            if (res.ok) {
                const data = (await res.json()) as GitHubContentResponse;
                sha = data.sha;
                const clBytes = Uint8Array.from(atob(data.content.replace(/\n/g, '')), (c) => c.charCodeAt(0));
                entries = JSON.parse(new TextDecoder().decode(clBytes)) as ChangelogEntry[];
            } else if (res.status !== 404) {
                throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
            }
            entries.unshift(entry);
            const bytes = new TextEncoder().encode(JSON.stringify(entries, null, 2) + '\n');
            const content = bytesToBase64(bytes);
            await putFile(
                api,
                CHANGELOG_PATH,
                token,
                branch,
                `Log: ${entry.action} ${entry.medKey} via admin portal`,
                content,
                sha ?? null,
            );
        },
    };
}
