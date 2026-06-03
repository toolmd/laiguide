import { enableDrag, refreshDragHandles } from './dragDrop';

export function createEl<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs?: Record<string, string>,
    children?: (Node | string)[],
): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    if (attrs)
        for (const [k, v] of Object.entries(attrs)) {
            if (k === 'textContent') {
                e.textContent = v;
                continue;
            }
            e.setAttribute(k, v);
        }
    if (children) for (const c of children) e.append(c);
    return e;
}

export function makeSection(
    title: string,
    collapsed = false,
): { section: HTMLDivElement; body: HTMLDivElement } {
    const section = createEl('div', { class: `form-section${collapsed ? ' collapsed' : ''}` });
    const header = createEl('div', { class: 'form-section-header' }, [
        createEl('span', { class: 'chevron', textContent: '▼' }),
        document.createTextNode(title),
    ]);
    header.addEventListener('click', () => section.classList.toggle('collapsed'));
    const body = createEl('div', { class: 'form-section-body' });
    section.append(header, body);
    return { section, body };
}

export function makeTextInput(label: string, value: string, dataPath: string): HTMLDivElement {
    const row = createEl('div', { class: 'form-row' });
    row.append(createEl('label', { textContent: label }));
    row.append(createEl('input', { type: 'text', value, 'data-path': dataPath }));
    return row;
}

export function makeComboInput(
    label: string,
    value: string,
    dataPath: string,
    options: string[],
    listId: string,
): HTMLDivElement {
    const row = createEl('div', { class: 'form-row' });
    row.append(createEl('label', { textContent: label }));
    const input = createEl('input', {
        type: 'text',
        value,
        'data-path': dataPath,
        list: listId,
        autocomplete: 'off',
    });
    const datalist = createEl('datalist', { id: listId });
    for (const opt of options) {
        datalist.append(createEl('option', { value: opt }));
    }
    // Clear on focus so the datalist shows all options (browsers filter by current value).
    // Restore the previous value on blur if the user didn't pick anything.
    input.addEventListener('focus', () => {
        input.dataset.saved = input.value;
        input.value = '';
    });
    input.addEventListener('blur', () => {
        if (input.value === '') input.value = input.dataset.saved ?? '';
        delete input.dataset.saved;
    });
    row.append(datalist, input);
    return row;
}

export function makeNumberInput(
    label: string,
    value: number | null,
    dataPath: string,
): HTMLDivElement {
    const row = createEl('div', { class: 'form-row' });
    row.append(createEl('label', { textContent: label }));
    row.append(
        createEl('input', {
            type: 'number',
            value: value != null ? String(value) : '',
            'data-path': dataPath,
        }),
    );
    return row;
}

export function makeListEditor(
    label: string,
    items: string[],
    dataPath: string,
    emptyHint?: string,
): HTMLDivElement {
    const row = createEl('div', { class: 'form-row' });
    row.append(createEl('label', { textContent: label }));
    const container = createEl('div', { class: 'list-editor', 'data-path': dataPath });
    const hintEl = emptyHint
        ? createEl('span', { class: 'list-empty-hint', textContent: `Default: ${emptyHint}` })
        : null;
    if (hintEl) container.append(hintEl);

    function updateHint() {
        if (hintEl) {
            hintEl.style.display = container.querySelectorAll('.list-item').length === 0 ? '' : 'none';
        }
    }

    function addItem(text: string) {
        const item = createEl('div', { class: 'list-item' });
        const handle = createEl('span', {
            class: 'drag-handle',
            title: 'Drag to reorder',
            textContent: '⠿',
        });
        const ta = createEl('textarea');
        ta.value = text;
        const removeBtn = createEl('button', {
            class: 'remove-btn',
            type: 'button',
            textContent: '×',
        });
        removeBtn.addEventListener('click', () => {
            item.remove();
            refreshDragHandles(container, '.list-item');
            updateHint();
        });
        item.append(handle, ta, removeBtn);
        container.insertBefore(item, addBtnEl);
        refreshDragHandles(container, '.list-item');
        updateHint();
    }

    const addBtnEl = createEl('button', {
        class: 'add-item-btn',
        type: 'button',
        textContent: '+ Add',
    });
    addBtnEl.addEventListener('click', () => addItem(''));
    container.append(addBtnEl);

    for (const t of items) addItem(t);
    enableDrag(container, '.list-item');
    row.append(container);
    return row;
}

function setNested(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    const parents: Array<[Record<string, unknown>, string]> = [];
    let target: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (/^\d+$/.test(parts[i + 1] ?? '')) {
            const idx = Number(parts[i + 1]);
            if (!Array.isArray(target[key])) target[key] = [];
            const arr = target[key] as Record<string, unknown>[];
            if (arr[idx] == null) arr[idx] = {};
            target = arr[idx];
            i++;
        } else {
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            parents.push([target, key]);
            target = target[key] as Record<string, unknown>;
        }
    }
    const lastKey = parts[parts.length - 1];
    if (value === undefined) {
        delete target[lastKey];
        // Clean up any empty plain-object ancestors left behind by the deletion.
        for (let i = parents.length - 1; i >= 0; i--) {
            const [parent, key] = parents[i];
            const child = parent[key];
            if (
                child !== null &&
                typeof child === 'object' &&
                !Array.isArray(child) &&
                Object.keys(child as object).length === 0
            ) {
                delete parent[key];
            } else {
                break;
            }
        }
    } else {
        target[lastKey] = value;
    }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let target: unknown = obj;
    for (const part of parts) {
        if (target == null || typeof target !== 'object') return undefined;
        target = /^\d+$/.test(part)
            ? (target as unknown[])[Number(part)]
            : (target as Record<string, unknown>)[part];
    }
    return target;
}

export function collectFormData(
    formEditor: HTMLDivElement,
    currentMedData: Record<string, unknown>,
): Record<string, unknown> {
    const data = structuredClone(currentMedData);

    formEditor.querySelectorAll<HTMLInputElement>('input[data-path]').forEach((input) => {
        const path = input.dataset.path!;
        const val =
            input.type === 'number'
                ? input.value === ''
                    ? getNestedValue(currentMedData, path) === undefined
                        ? undefined
                        : null
                    : Number(input.value)
                : input.value || undefined;
        setNested(data, path, val);
    });

    formEditor.querySelectorAll<HTMLDivElement>('.list-editor[data-path]').forEach((container) => {
        const items: string[] = [];
        container.querySelectorAll<HTMLTextAreaElement>('.list-item textarea').forEach((ta) => {
            if (ta.value.trim()) items.push(ta.value);
        });
        setNested(data, container.dataset.path!, items);
    });

    return data;
}
