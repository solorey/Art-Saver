"use strict";
class VirtualList {
    parent;
    createRow;
    values;
    container;
    viewport_height;
    rows = new Map();
    row_height = 18;
    wait = false;
    constructor(parent, createRow, values) {
        // firefox max scroll height 17_895_697px ~ 994_205 rows at 18px per row
        // rows blank out after around 466_040 Rows
        // safe max 466_000 rows
        this.createRow = createRow;
        this.values = values ?? [];
        this.viewport_height = parent.offsetHeight;
        const container = document.createElement('div');
        container.classList.add('list');
        parent.append(container);
        const default_height = 180;
        parent.style.height = `${default_height}px`;
        parent.addEventListener('scroll', () => {
            if (!this.wait) {
                this.wait = true;
                window.requestAnimationFrame(() => {
                    this.renderRows();
                    this.wait = false;
                });
            }
        });
        const observer = new ResizeObserver((entries) => {
            this.viewport_height = entries.pop()?.borderBoxSize[0].blockSize ?? 0;
            this.renderRows();
        });
        observer.observe(parent);
        this.container = container;
        this.parent = parent;
        this.refreshList();
    }
    refreshList() {
        this.rows.forEach((r) => r.parentElement?.removeChild(r));
        this.rows.clear();
        this.container.style.height = `${this.row_height * this.values.length}px`;
        this.renderRows();
    }
    renderRows() {
        const scroll_y = this.parent.scrollTop;
        const top = Math.max(0, Math.floor(scroll_y / this.row_height));
        const bottom = Math.min(this.values.length - 1, Math.ceil((scroll_y + this.viewport_height) / this.row_height));
        for (const [i, r] of this.rows.entries()) {
            if (i < top || i > bottom) {
                r.parentElement?.removeChild(r);
                this.rows.delete(i);
            }
        }
        // add new rows
        for (let i = top; i <= bottom; i++) {
            if (this.rows.has(i)) {
                continue;
            }
            const row_elem = this.createRow(this.values[i]);
            row_elem.setAttribute('data-row', `${i}`);
            row_elem.style.top = `${i * this.row_height}px`;
            this.rows.set(i, row_elem);
            let placed = false;
            for (const child of this.container.children) {
                const row_id = Number(child.getAttribute('data-row'));
                if (row_id > i) {
                    child.before(row_elem);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                this.container.append(row_elem);
            }
        }
    }
    updateList(new_values) {
        this.values = new_values;
        this.refreshList();
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
class SearchList {
    values = [];
    virtual_list;
    search_input;
    clear_button;
    case_flag;
    whole_flag;
    regex_flag;
    sort_button;
    constructor(parent, createRow) {
        const search_input = parent.querySelector('[data-search]');
        search_input?.addEventListener('input', () => {
            this.showClearButton();
            this.setVirtualList();
        });
        this.search_input = search_input;
        const list_box = parent.querySelector('[data-list]');
        if (!list_box) {
            throw new Error('No element for virtual list');
        }
        this.virtual_list = new VirtualList(list_box, createRow);
        const clear_button = parent.querySelector('[data-clear]');
        clear_button?.addEventListener('click', () => {
            if (this.search_input) {
                this.search_input.value = '';
            }
            this.showClearButton();
            this.setVirtualList();
        });
        this.clear_button = clear_button;
        const case_flag = parent.querySelector('[data-match-case]');
        case_flag?.addEventListener('input', () => {
            this.setVirtualList();
        });
        this.case_flag = case_flag;
        const whole_flag = parent.querySelector('[data-match-whole]');
        whole_flag?.addEventListener('input', () => {
            this.setVirtualList();
        });
        this.whole_flag = whole_flag;
        const regex_flag = parent.querySelector('[data-use-regex]');
        regex_flag?.addEventListener('input', () => {
            this.setVirtualList();
        });
        this.regex_flag = regex_flag;
        const sort_button = parent.querySelector('[data-sort]');
        sort_button?.addEventListener('click', () => {
            toggleListSort(sort_button);
            this.setVirtualList();
        });
        this.sort_button = sort_button;
        this.showClearButton();
    }
    showClearButton() {
        this.clear_button?.classList.toggle('hide', !this.search_input?.value);
    }
    setVirtualList() {
        const sort = this.sort_button?.getAttribute('data-sort') ?? undefined;
        const match_case = this.case_flag?.checked ?? false;
        const match_whole = this.whole_flag?.checked ?? false;
        const use_regex = this.regex_flag?.checked ?? false;
        const result_values = searchValues(this.search_input?.value ?? '', this.values, match_case, match_whole, use_regex, sort);
        this.virtual_list.updateList(result_values);
    }
    updateValues(new_values) {
        this.values = new_values.map((v) => `${v}`);
        this.setVirtualList();
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function toggleListSort(sort_button) {
    if (sort_button.getAttribute('data-sort') === 'descend') {
        sort_button.setAttribute('data-sort', 'ascend');
        sort_button.setAttribute('data-flat-icon', '16-ascend');
        sort_button.title = 'Sorted by ascending';
    }
    else {
        sort_button.setAttribute('data-sort', 'descend');
        sort_button.setAttribute('data-flat-icon', '16-descend');
        sort_button.title = 'Sorted by descending';
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function searchValues(search, values, match_case, match_whole, use_regex, sort) {
    let results = [];
    if (search) {
        if (use_regex) {
            const search_regex = new RegExp(match_whole ? `^${search}$` : search, match_case ? 'd' : 'id');
            for (const value of values) {
                const result = search_regex.exec(value);
                if (result && result.indices) {
                    const index = result.indices[0];
                    results.push({
                        value,
                        start: index[0],
                        end: index[1],
                    });
                }
            }
        }
        else {
            const search_string = match_case ? search : search.toLowerCase();
            for (const value of values) {
                const value_string = match_case ? value : value.toLowerCase();
                if (match_whole) {
                    if (value_string === search_string) {
                        results.push({
                            value,
                            start: 0,
                            end: value.length,
                        });
                    }
                }
                else {
                    const index = value_string.indexOf(search_string);
                    if (index >= 0) {
                        results.push({
                            value,
                            start: index,
                            end: index + search.length,
                        });
                    }
                }
            }
        }
    }
    else {
        results = values.map((value) => ({ value, start: value.length, end: value.length }));
    }
    if (sort === 'ascend') {
        results.reverse();
    }
    return results;
}
