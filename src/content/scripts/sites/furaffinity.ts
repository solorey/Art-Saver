//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

var G_site_info: SiteInfo = furaffinity_info;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var getPageInfo = async () => {
    const url = window.location.href;

    const path_components = pathComponents(url);
    const page = path_components[0] ?? furaffinity_info.site;

    let has_user = false;
    let user: string | undefined;
    if (['user', 'journals', 'gallery', 'scraps', 'favorites', 'commissions'].includes(page)) {
        has_user = true;
        user = path_components[1];
    } else if (['view', 'full', 'journal'].includes(page)) {
        has_user = true;
        user = document.querySelector<HTMLAnchorElement>('[href*="/gallery/"], [href*="/scraps/"]')?.href.split('/')[4];
    }
    user = user?.toLowerCase();

    if (has_user && !user) {
        throw new Error(`User not found for page '${page}'`);
    }

    const info: PageInfo = { site: furaffinity_info.site, url, page, user };
    return info;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function isFuraffinityModernLayout(dom?: Document) {
    return Boolean((dom ?? document).querySelector('#ddmenu'));
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var getUserInfo = async (user: User) => {
    const init: RequestInit = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const response = await fetchOk(`https://www.furaffinity.net/user/${user}/`, init);
    const dom = await response.dom();

    const is_modern_layout = isFuraffinityModernLayout(dom);

    let name =
        dom
            .querySelector(is_modern_layout ? '.top-bar .js-displayName' : '.cat .js-displayName')
            ?.textContent?.trim() ?? '';
    if (!name) {
        const redirect = dom.querySelector('.redirect-message')?.textContent?.trim() ?? '';
        const redirect_regex_result = /User\s"(.+?)"\s/.exec(redirect);

        if (!redirect_regex_result) {
            throw new Error(`User page for '${user}' unavailable`);
        }
        name = redirect_regex_result[1];
    }

    const icon_element = dom.querySelector<HTMLImageElement>(`img[alt="${user}"]`);
    const icon = icon_element?.src;

    const stats_element = dom.querySelector(
        is_modern_layout ? 'div[class^="userpage-section-"] .cell' : 'td.ldot td[align="left"]',
    );
    const stats = new Map<string, string>();

    if (stats_element) {
        const stats_text = stats_element.textContent ?? '';
        const values = stats_text.replace(/\D+/g, ' ').trim().split(' ');

        if (is_modern_layout) {
            stats.set('Submissions', values[1]);
            stats.set('Favs', values[2]);
            stats.set('Views', values[0]);
        } else {
            stats.set('Submissions', values[1]);
            stats.set('Favorites', values[5]);
            stats.set('Page Visits', values[0]);
        }
    }

    const folder_meta: FuraffinityUserFolder = {
        site: furaffinity_info.site,
        userId: user,
        userName: name,
    };

    const options = await getOptionsStorage<FuraffinityOptionsValues>(furaffinity_info.site);

    const info: UserInfo = {
        site: furaffinity_info.site,
        user,
        name,
        icon,
        stats,
        folder: renderPath(options.userFolder, folder_meta as unknown as MetaRecord),
    };

    return info;
};

//---------------------------------------------------------------------------------------------------------------------
// main add checks and download buttons to image thumbnails
//---------------------------------------------------------------------------------------------------------------------

var startChecking = () => {
    observeThrottle(checkFuraffinity);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function checkFuraffinity() {
    const page = await getPageInfo();

    if (['view', 'full'].includes(page.page) && page.user) {
        checkFuraffinitySubmissionPage(page.url, page.user);
    } else if (page.page === 'user') {
        checkFuraffinityUserFavorites();
    }
    checkFuraffinityPage(page.user);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkFuraffinityPage(page_user?: User) {
    const is_modern_layout = isFuraffinityModernLayout();

    const gallery_thumbnails = document.querySelectorAll<HTMLElement>(
        ':not(#gallery-latest-favorites, [class*="userpage-first-"]) > [id^="sid"]',
    );
    for (const thumb of gallery_thumbnails) {
        checkFuraffinityThumbnail(thumb, page_user);
    }

    if (is_modern_layout) {
        const view_preview_thumbnails = document.querySelectorAll<HTMLElement>('.preview-gallery-container');
        for (const thumb of view_preview_thumbnails) {
            checkFuraffinityThumbnail(thumb, page_user);
        }

        const profile_submission = document.querySelector<HTMLElement>('.section-submission > a');
        if (profile_submission) {
            profile_submission.style.display = 'inline-block';
            const parent = profile_submission.parentElement;
            if (parent) {
                checkFuraffinityThumbnail(parent, page_user);
            }
        }
    }

    // user page preview sections
    const section_bodies = document.querySelectorAll<HTMLElement>(
        is_modern_layout ? '.section-body' : '[class*="userpage-first-"]',
    );
    for (const section_body of section_bodies) {
        const preview_link = section_body.querySelector<HTMLAnchorElement>(
            is_modern_layout ? '.preview_img > a' : 's > a',
        );
        if (!preview_link) {
            continue;
        }
        checkFuraffinityThumbnail(section_body, page_user);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkFuraffinityThumbnail(element: HTMLElement, page_user?: User) {
    const link = element.querySelector<HTMLAnchorElement>('a[href*="/view/"]');
    if (!link) {
        G_check_log.log(element, 'Link not found');
        return;
    }
    const submission = parseInt(link.href.split('/')[4], 10);

    const user_link = element.querySelector<HTMLAnchorElement>('a[href*="/user/"]');
    const user = user_link?.href.split('/')[4] ?? page_user;
    if (!user) {
        G_check_log.log(element, 'User not found');
        return;
    }
    const parent = navigateUpSmaller(link);
    const info = {
        site: furaffinity_info.site,
        user,
        submission,
    };
    return createButton(info, parent);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkFuraffinityUserFavorites() {
    const script_text = document.querySelector<HTMLScriptElement>('#js-submissionData')?.textContent ?? '';
    if (!script_text) {
        return;
    }
    const favorite_data = JSON.parse(script_text);

    const user_favorite_thumbnails = document.querySelectorAll('#gallery-latest-favorites > [id^="sid"]');
    for (const favorite of user_favorite_thumbnails) {
        const submission_regex_result = /(\d+)/.exec(favorite.id);
        if (!submission_regex_result) {
            continue;
        }
        const submission = parseInt(submission_regex_result[1], 10);
        const user = favorite_data[submission].lower;
        const parent = favorite.querySelector('img')?.parentElement;
        if (!parent) {
            continue;
        }
        const info = {
            site: furaffinity_info.site,
            user,
            submission,
        };
        createButton(info, parent);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkFuraffinitySubmissionPage(url: string, user: User) {
    const is_modern_layout = isFuraffinityModernLayout();

    const submission_area = is_modern_layout
        ? document.querySelector<HTMLElement>('.submission-area')
        : document.querySelector<HTMLElement>('#submissionImg')?.parentElement;
    if (!submission_area) {
        G_check_log.log('Submission page:', 'Media element not found');
        return;
    }

    const info = {
        site: furaffinity_info.site,
        user,
        submission: parseInt(url.split('/')[4], 10),
    };
    createButton(info, submission_area, { screen: false });
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------

var startDownloading = async (submission: Submission, progress: ProgressController) => {
    const options = await getOptionsStorage<FuraffinityOptionsValues>(furaffinity_info.site);

    const init: RequestInit = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const response = await fetchOk(`https://www.furaffinity.net/view/${submission}`, init);
    const dom = await response.dom();

    const { info, meta } = getFuraffinitySubmissionData(submission, dom);
    const file_data = getFuraffinityFileData(dom);

    const downloads = [createFuraffinityDownload(meta, file_data, options)];

    return await downloadSubmission(info, downloads, init, progress, meta.title);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getFuraffinitySubmissionData(submission: Submission, dom: Document) {
    const user_id = dom.querySelector<HTMLAnchorElement>('[href*="/gallery/"], [href*="/scraps/"]')?.href.split('/')[4];
    if (!user_id) {
        throw new Error('User ID not found');
    }
    const is_modern_layout = isFuraffinityModernLayout(dom);

    const user_name = dom
        .querySelector(
            is_modern_layout
                ? '.submission-description-artist .c-usernameBlockSimple__displayName'
                : '.information .c-usernameBlockSimple__displayName',
        )
        ?.textContent?.trim();
    if (!user_name) {
        throw new Error('User name not found');
    }

    const download_link = dom.querySelector<HTMLAnchorElement>('a[href*="/art/"]');
    if (!download_link) {
        throw new Error('Download link not found');
    }
    const url = decodeURI(download_link.href);

    const regex_result = /\/art\/(.+?)\/(?:.+\/)*(\d+)\/((\d+)?(?:.+_(\d{10,}))?.+?)\.(\w+)$/.exec(url);
    if (!regex_result) {
        throw new Error('Download link does not match RegExp');
    }
    const file_id = regex_result[4] || regex_result[5] || regex_result[2];

    const date_time = timeParse(parseInt(`${file_id}000`, 10));

    const title_element = dom.querySelector(
        is_modern_layout ? '.submission-title h2' : 'div.classic-submission-title > h2',
    );
    if (!title_element) {
        throw new Error('Title element not found');
    }
    const title = title_element.textContent?.trim() ?? '';

    const meta: FuraffinitySubmissionMeta = {
        site: furaffinity_info.site,
        userId: user_id,
        userName: user_name,
        submissionId: `${submission}`,
        title,
        ...date_time,
    };

    const info: SubmissionInfo = {
        site: furaffinity_info.site,
        user: user_id,
        submission,
    };

    return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getFuraffinityFileData(dom: Document) {
    const download_link = dom.querySelector<HTMLAnchorElement>('a[href*="/art/"]');
    if (!download_link) {
        throw new Error('Download link not found');
    }
    const url = decodeURI(download_link.href);

    // example download urls
    // https://d.furaffinity.net/art/username/0123456789/0123456789.username_filename.ext
    // https://d.furaffinity.net/art/username/0123456789/0123456789.username.filename.ext
    // https://d.furaffinity.net/download/art/username/<category>/0123456789/0123456789.username_filename.ext
    // https://d.furaffinity.net/art/username/0123456789/username_0123456789_filename.ext
    // https://d.furaffinity.net/art/username/0123456789/usernamefilename.ext

    const regex_result = /\/art\/(.+?)\/(?:.+\/)*(\d+)\/((\d+)?(?:.+_(\d{10,}))?.+?)\.(\w+)$/.exec(url);
    if (!regex_result) {
        throw new Error('Download link does not match RegExp');
    }

    const meta: FuraffinityFileMeta = {
        fileName: regex_result[3],
        fileId: regex_result[4] || regex_result[5] || regex_result[2],
        ext: regex_result[6],
    };

    const info: FileInfo = {
        download: url,
    };

    return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createFuraffinityDownload(
    submission_meta: FuraffinitySubmissionMeta,
    file_data: FuraffinityFileData,
    options: FuraffinityOptionsValues,
) {
    const meta: FuraffinityFile = { ...submission_meta, ...file_data.meta };

    const download: DownloadInfo = {
        ...file_data.info,
        path: renderPath(options.file, meta as unknown as MetaRecord),
    };
    return download;
}
