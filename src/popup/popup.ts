class PopupUserTab {
    content: HTMLElement | null;
    page_loading: HTMLElement | null;
    page_error: HTMLElement | null;
    error_message: HTMLAnchorElement | null;
    page_info: HTMLElement | null;
    profile_image: HTMLImageElement | null;
    user_name: HTMLElement | null;
    home_link: HTMLAnchorElement | null;
    gallery_link: HTMLAnchorElement | null;
    favorites_link: HTMLAnchorElement | null;
    user_folder: HTMLButtonElement | null;
    folder_path?: string;
    stats: HTMLElement | null;
    stats_list: HTMLElement | null;
    saved_details: HTMLDetailsElement | null;
    saved_stat: HTMLElement | null;
    search_list?: SearchList;
    constructor() {
        this.content = document.querySelector('#user-content');
        this.page_loading = document.querySelector('#user-loading');
        this.page_error = document.querySelector('#user-error');
        this.error_message = document.querySelector('#user-error-message');
        this.page_info = document.querySelector('#user-info');
        this.profile_image = document.querySelector('#profile-image');
        this.user_name = document.querySelector('#user-name');
        this.home_link = document.querySelector('#user-home');
        this.gallery_link = document.querySelector('#user-gallery');
        this.favorites_link = document.querySelector('#user-favorites');

        const user_folder = document.querySelector<HTMLButtonElement>('#user-folder');
        user_folder?.addEventListener('click', () => {
            this.openUserFolder();
        });
        this.user_folder = user_folder;

        this.stats = document.querySelector('#user-stats');
        this.stats_list = document.querySelector('#user-stats-list');
        this.saved_stat = document.querySelector('#user-saved-stat');

        const saved_details = document.querySelector<HTMLDetailsElement>('#user-saved');
        if (saved_details) {
            this.search_list = new SearchList(saved_details, createPopupSubmissionRow);
        }
        this.saved_details = saved_details;
    }
    setUserError(message: string) {
        this.error_message?.replaceChildren(message);
    }
    setUserInfo(user: UserInfo) {
        const links = SITES_INFO[user.site].links;

        this.profile_image?.setAttribute('src', user.icon ?? '');
        this.user_name?.replaceChildren(user.name);
        this.home_link?.setAttribute('href', links.user(user.user));
        this.gallery_link?.setAttribute('href', links.gallery(user.user));
        this.favorites_link?.setAttribute('href', links.favorites(user.user));

        const stat_blocks = user.stats
            .entries()
            .map(([name, value]) => {
                const stat_block = document.createElement('div');
                stat_block.classList.add('stat-block');

                const stat_value = document.createElement('span');
                stat_value.classList.add('stat-value');
                stat_value.textContent = value;

                stat_block.append(name, stat_value);

                return stat_block;
            })
            .toArray();

        this.stats?.classList.toggle('hide', stat_blocks.length === 0);
        this.stats_list?.replaceChildren(...stat_blocks);

        this.folder_path = user.folder;
    }
    setUserValues(submissions: Submission[]) {
        this.saved_stat?.replaceChildren(`${submissions.length}`);
        this.search_list?.updateValues(submissions);

        const has_submissions = submissions.length > 0;
        this.saved_details?.classList.toggle('hide', !has_submissions);
        this.user_folder?.classList.toggle('hide', !has_submissions);
    }
    async getUserValues(site: Site, user: User) {
        const values: Awaited<ReturnType<typeof getDBUserValues>> = await browser.runtime.sendMessage({
            action: 'background_get_db_user_values',
            site,
            user,
        } as BackgroundMessage);
        this.setUserValues(values.submissions);
    }
    showPage(page: 'loading' | 'error' | 'info') {
        const pages = {
            loading: this.page_loading,
            error: this.page_error,
            info: this.page_info,
        };
        for (const [p, element] of Object.entries(pages)) {
            element?.classList.toggle('hide', p !== page);
        }
    }
    openUserFolder() {
        if (!this.folder_path) {
            return;
        }
        browser.runtime.sendMessage({
            action: 'background_open_user_folder',
            path: `${this.folder_path}folder_opener.file`,
        } as BackgroundMessage);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class PopupSiteTab {
    tab_id?: number;
    content: HTMLElement | null;
    page_loading: HTMLElement | null;
    page_error: HTMLElement | null;
    error_message: HTMLElement | null;
    page_info: HTMLElement | null;
    refresh_button: HTMLButtonElement | null;
    saved_stat: HTMLElement | null;
    download_all_button: HTMLButtonElement | null;
    downloads_stat: HTMLElement | null;
    site_name: HTMLElement | null;
    users_details: HTMLDetailsElement | null;
    users_stat: HTMLElement | null;
    users_list?: SearchList;
    submissions_details: HTMLDetailsElement | null;
    submissions_stat: HTMLElement | null;
    submissions_list?: SearchList;
    constructor() {
        this.content = document.querySelector('#site-content');
        this.page_loading = document.querySelector('#site-loading');
        this.page_error = document.querySelector('#site-error');
        this.error_message = document.querySelector('#site-error-message');
        this.page_info = document.querySelector('#site-info');

        const refresh_button = document.querySelector<HTMLButtonElement>('#refresh');
        refresh_button?.addEventListener('click', () => this.sendMessage('content_refresh'));
        this.refresh_button = refresh_button;
        this.saved_stat = document.querySelector('#saved-stat');

        const download_all_button = document.querySelector<HTMLButtonElement>('#download-all');
        download_all_button?.addEventListener('click', () => this.sendMessage('content_download_all'));
        this.download_all_button = download_all_button;
        this.downloads_stat = document.querySelector('#downloads-stat');

        this.site_name = document.querySelector('#stats-site');

        this.users_stat = document.querySelector('#users-stat-value');
        const users_details = document.querySelector<HTMLDetailsElement>('#users-details');
        if (users_details) {
            this.users_list = new SearchList(users_details, createPopupUserRow);
        }
        this.users_details = users_details;

        this.submissions_stat = document.querySelector('#submissions-stat-value');
        const submissions_details = document.querySelector<HTMLDetailsElement>('#submissions-details');
        if (submissions_details) {
            this.submissions_list = new SearchList(submissions_details, createPopupSubmissionRow);
        }
        this.submissions_details = submissions_details;
    }
    setSiteError(message: string) {
        this.error_message?.replaceChildren(message);
    }
    setSiteInfo(tab_id: number, info: PageInfo, stats: PageStats) {
        this.tab_id = tab_id;
        this.site_name?.replaceChildren(SITES_INFO[info.site].label);
        this.saved_stat?.replaceChildren(`${stats.checks}`);
        this.downloads_stat?.replaceChildren(`${stats.downloads}`);
    }
    setSiteValues(users: User[], submissions: Submission[]) {
        this.users_list?.updateValues(users);
        this.users_stat?.replaceChildren(`${users.length}`);

        this.submissions_list?.updateValues(submissions);
        this.submissions_stat?.replaceChildren(`${submissions.length}`);
    }
    async getSiteValues(site: Site) {
        const values: Awaited<ReturnType<typeof getDBSiteValues>> = await browser.runtime.sendMessage({
            action: 'background_get_db_site_values',
            site,
        } as BackgroundMessage);
        this.setSiteValues(values.users, values.submissions);
    }
    showPage(page: 'loading' | 'error' | 'info') {
        const pages = {
            loading: this.page_loading,
            error: this.page_error,
            info: this.page_info,
        };
        for (const [p, element] of Object.entries(pages)) {
            element?.classList.toggle('hide', p !== page);
        }
    }
    sendMessage(message: 'content_refresh' | 'content_download_all') {
        if (typeof this.tab_id === 'undefined') {
            return;
        }
        browser.tabs.sendMessage(this.tab_id, {
            action: message,
        } as ContentMessage);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

let G_popup_site: Site | undefined;
let G_popup_user: User | undefined;
const G_popup_user_tab = new PopupUserTab();
const G_popup_site_tab = new PopupSiteTab();

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

(async () => {
    const popup_state = await getUIStorage<PopupStateValues>('popup');
    const tab_rank: Record<string, number> = {
        about: 0,
        site: 1,
        user: 2,
    };
    const state_rank = tab_rank[popup_state.tab] ?? 0;

    openTab('about');
    const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
    });
    const tab_id = tabs[0].id;
    const site = findSupportedSite(tabs[0].url);
    if (typeof tab_id === 'undefined' || !site) {
        return;
    }
    if (!(await getOptionsStorage(site)).enabled) {
        return;
    }

    G_popup_site_tab.showPage('loading');

    showTab('site');
    if (state_rank >= tab_rank.site) {
        openTab('site');
    }

    let tab_data: Awaited<ReturnType<typeof getPageData>>;
    try {
        tab_data = await browser.tabs.sendMessage(tab_id, {
            action: 'content_page_info',
        } as ContentMessage);
    } catch (error) {
        G_popup_site_tab.setSiteError(`${error}`);
        G_popup_site_tab.showPage('error');
        return;
    }
    G_popup_site = tab_data.info.site;

    G_popup_site_tab.setSiteInfo(tab_id, tab_data.info, tab_data.stats);
    await G_popup_site_tab.getSiteValues(G_popup_site);

    G_popup_site_tab.showPage('info');

    if (!tab_data.info.user) {
        return;
    }
    G_popup_user = tab_data.info.user;

    G_popup_user_tab.showPage('loading');

    showTab('user');
    if (state_rank >= tab_rank.user) {
        openTab('user');
    }

    let user: UserInfo;
    try {
        user = await browser.tabs.sendMessage(tab_id, {
            action: 'content_user_info',
            user: tab_data.info.user,
        });
    } catch (error) {
        G_popup_user_tab.setUserError(`${error}`);
        G_popup_user_tab.showPage('error');
        return;
    }
    G_popup_user_tab.setUserInfo(user);
    await G_popup_user_tab.getUserValues(G_popup_site, G_popup_user);
    G_popup_user_tab.showPage('info');
})();

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

getOptionsStorage<GlobalOptionsValues>('global').then((global_options) => {
    document.body.setAttribute('data-theme', global_options.theme);
});

//---------------------------------------------------------------------------------------------------------------------
// message send/listen functions
//---------------------------------------------------------------------------------------------------------------------

browser.storage.local.onChanged.addListener((changes) => {
    const global_options_values = changes[optionsKey('global')]?.newValue as GlobalOptionsValues | undefined;
    if (global_options_values) {
        document.body.setAttribute('data-theme', global_options_values.theme);
    }
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

browser.runtime.onMessage.addListener((message: any) => {
    return popupMessageActions(message);
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function popupMessageActions(message: PopupMessage) {
    switch (message.action) {
        case 'popup_db_update':
            if (G_popup_site && message.site === G_popup_site) {
                G_popup_site_tab.getSiteValues(G_popup_site);
                if (G_popup_user) {
                    G_popup_user_tab.getUserValues(G_popup_site, G_popup_user);
                }
            }
            break;
    }
}

//---------------------------------------------------------------------------------------------------------------------
// tabs
//---------------------------------------------------------------------------------------------------------------------

function showTab(tab: string) {
    document.querySelector(`[data-tab="${tab}"]`)?.classList.remove('hide');
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function openTab(content: string) {
    for (const tab of document.querySelectorAll('[data-tab]')) {
        tab.classList.remove('active');
    }
    for (const content of document.querySelectorAll('[data-tab-content]')) {
        content.classList.add('hide');
    }

    document.querySelector(`[data-tab="${content}"]`)?.classList.add('active');

    document.querySelector(`#${content}-content`)?.classList.remove('hide');
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', function () {
        const content = this.getAttribute('data-tab');
        if (content) {
            openTab(content);
            updateUIStorage('popup', { tab: content });
        }
    });
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector('#settings-tab')?.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createPopupUserRow(search: VirtualSearchResult) {
    const fallback = document.createElement('div');
    if (!G_popup_site) {
        return fallback;
    }
    const links = SITES_INFO[G_popup_site].links;

    const template = cloneTemplate('#user-row-template');

    const match = document.createElement('span');
    match.classList.add('row-match');
    match.append(search.value.substring(search.start, search.end));
    template
        .querySelector('[data-label]')
        ?.append(search.value.substring(0, search.start), match, search.value.substring(search.end));

    template?.querySelector('[data-user-link]')?.setAttribute('href', links.user(search.value));
    template?.querySelector('[data-gallery-link]')?.setAttribute('href', links.gallery(search.value));
    template?.querySelector('[data-favorites-link]')?.setAttribute('href', links.favorites(search.value));

    return template.querySelector<HTMLElement>('[data-row]') ?? fallback;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createPopupSubmissionRow(search: VirtualSearchResult) {
    const fallback = document.createElement('div');
    if (!G_popup_site) {
        return fallback;
    }
    const links = SITES_INFO[G_popup_site].links;

    const template = cloneTemplate('#submission-row-template');

    const match = document.createElement('span');
    match.classList.add('row-match');
    match.append(search.value.substring(search.start, search.end));
    template
        .querySelector('[data-label]')
        ?.append(search.value.substring(0, search.start), match, search.value.substring(search.end));

    template?.querySelector('[data-submission-link]')?.setAttribute('href', links.submission(search.value));

    return template.querySelector<HTMLElement>('[data-row]') ?? fallback;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function findSupportedSite(url: string | undefined) {
    if (!url || !/^https?:\/\//.test(url)) {
        return;
    }
    const url_domain = url.split('/')[2];
    for (const info of Object.values(SITES_INFO)) {
        const site_short_domian = info.links.main.split('/')[2].split('.').slice(-2).join('.');
        if (url_domain.endsWith(site_short_domian)) {
            return info.site;
        }
    }
    return;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector('#version-number')?.append(`v${browser.runtime.getManifest().version}`);
