//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

var G_site_info: SiteInfo = itaku_info;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var getPageInfo = async () => {
    const url = window.location.href;

    const path_components = pathComponents(url);
    let page = path_components[0] ?? itaku_info.site;

    let has_user = false;
    let user: string | undefined;
    if (['profile'].includes(page)) {
        has_user = true;
        user = path_components[1];
        page = path_components[2] ?? page;
    } else if (['images'].includes(page)) {
        has_user = true;
        const user_url = document.querySelector<HTMLAnchorElement>('[data-cy="app-image-detail-owner"]')?.href;
        if (user_url) {
            user = pathComponents(user_url)[1];
        }
    }
    user = user?.toLowerCase();

    if (has_user && !user) {
        throw new Error(`User not found for page '${page}'`);
    }

    const info: PageInfo = { site: itaku_info.site, url, page, user };
    return info;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var getUserInfo = async (user: User) => {
    const init: RequestInit = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const response = await fetchOk(`https://itaku.ee/api/user_profiles/${user}`, init);
    const obj = await response.json();

    const name = obj.displayname;

    const icon = obj.avatar_sm;

    const stats = new Map<string, string>();
    stats.set('Images', obj.num_gallery_images);
    stats.set('Starred', obj.num_images_starred);
    stats.set('Followers', obj.num_followers);

    const folder_meta: ItakuUserFolder = {
        site: itaku_info.site,
        userId: user,
        userName: name,
    };

    const options = await getOptionsStorage<ItakuOptionsValues>(itaku_info.site);

    const info: UserInfo = {
        site: itaku_info.site,
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
    observeThrottle(checkItaku);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function checkItaku() {
    const page = await getPageInfo();

    checkItakuPage(page);
    if (page.page === 'images' && page.user) {
        checkItakuSubmissionPage(page.url, page.user);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkItakuPage(page: PageInfo) {
    for (const link of document.querySelectorAll<HTMLElement>('a[data-cy="app-gallery-images-img-link"]')) {
        const parent = link.parentElement;
        if (parent) {
            checkItakuThumbnail(parent, page.user);
        }
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkItakuThumbnail(element: HTMLElement, page_user?: User) {
    const image_url = element.querySelector<HTMLAnchorElement>('a[href*="/images/"]')?.href;
    if (!image_url) {
        G_check_log.log(element, 'Submission url not found');
        return;
    }
    const submission = parseInt(pathComponents(image_url)[1], 10);

    let user_link: string | undefined;
    let search_element = element;
    for (let i = 0; i < 10; i++) {
        user_link = search_element.querySelector<HTMLAnchorElement>('a[href*="/profile/"]')?.href;
        const next_element = search_element.parentElement;
        if (user_link || search_element.nodeName === 'SECTION' || !next_element) {
            break;
        } else {
            search_element = next_element;
        }
    }
    const user = user_link ? pathComponents(user_link)[1].toLowerCase() : (page_user ?? '');

    const parent = navigateUpSmaller(element);
    parent.style.setProperty('--as-z-index', '11');
    const info = {
        site: itaku_info.site,
        user,
        submission,
    };
    return createButton(info, parent);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkItakuSubmissionPage(url: string, user: User) {
    const view = document.querySelector<HTMLElement>('app-image-detail .img-wrapper');
    if (!view) {
        G_check_log.log('Submission page:', 'Media element not found');
        return;
    }
    const submission = parseInt(pathComponents(url)[1], 10);
    const info = {
        site: itaku_info.site,
        user,
        submission,
    };
    createButton(info, view, { screen: false });
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------

var startDownloading = async (submission: Submission, progress: ProgressController) => {
    const options = await getOptionsStorage<ItakuOptionsValues>(itaku_info.site);

    const init: RequestInit = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const response = await fetchOk(`https://itaku.ee/api/galleries/images/${submission}`, init);
    const obj = await response.json();

    const { info, meta } = getItakuSubmissionData(submission, obj);
    const file_data = getItakuFileData(obj);

    const downloads = [createItakuDownload(meta, file_data, options)];

    return await downloadSubmission(info, downloads, init, progress, meta.title);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getItakuSubmissionData(submission: Submission, obj: any) {
    const user_id = obj.owner_username;
    const user_name = obj.owner_displayname;
    const title = obj.title;
    const description = obj.description.trim().replace(/\s+/g, ' ') ?? '';

    const date_time = timeParse(obj.date_added);

    const meta: ItakuSubmissionMeta = {
        site: itaku_info.site,
        userId: user_id,
        userName: user_name,
        submissionId: `${submission}`,
        title,
        description,
        ...date_time,
    };

    const info: SubmissionInfo = {
        site: itaku_info.site,
        user: user_id.toLowerCase(),
        submission,
    };

    return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getItakuFileData(obj: any) {
    const file_url: string | undefined = obj.video?.video ?? obj.image;
    if (!file_url) {
        throw new Error('Download link not found');
    }

    const regex_result = /\/([^/]+)\.(\w+)$/.exec(file_url);
    if (!regex_result) {
        throw new Error('Download link does not match RegExp');
    }

    const meta: ItakuFileMeta = {
        fileName: regex_result[1],
        ext: regex_result[2],
    };

    const info: FileInfo = {
        download: file_url,
    };

    return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createItakuDownload(
    submission_meta: ItakuSubmissionMeta,
    file_data: ItakuFileData,
    options: ItakuOptionsValues,
) {
    const meta: ItakuFile = { ...submission_meta, ...file_data.meta };

    const download: DownloadInfo = {
        ...file_data.info,
        path: renderPath(options.file, meta as unknown as MetaRecord),
    };
    return download;
}
