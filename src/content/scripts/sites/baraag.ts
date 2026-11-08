//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

var G_site_info: SiteInfo = baraag_info;

var getPageInfo = async () => {
    const url = window.location.href;

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
    const regex_match = /\/@([^/]+)(\/\d+)?/.exec(canonical ?? '');

    let page: string = baraag_info.site;
    let user: string | undefined;

    if (regex_match) {
        user = regex_match[1];
        if (regex_match[2]) {
            page = 'submission';
        }
    }

    const info: PageInfo = { site: baraag_info.site, url, page, user };
    return info;
};

var getUserInfo = async (user: User): Promise<UserInfo> => {
    const init: RequestInit = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const response = await fetchOk(`https://baraag.net/api/v1/accounts/lookup?acct=${user}`, init);
    const data = await response.json();

    const name = cleanBaraagDisplayName(data.display_name) || user;

    const icon = data.avatar;

    const stats = new Map();
    stats.set('Posts', data.statuses_count);
    stats.set('Followers', data.followers_count);

    const folder_meta: BaraagUserFolder = {
        site: baraag_info.site,
        userId: user,
        userName: name,
    };

    const options = await getOptionsStorage<BaraagOptionsValues>(baraag_info.site);

    const info: UserInfo = {
        site: baraag_info.site,
        user,
        name,
        icon,
        stats,
        folder: renderPath(options.userFolder, folder_meta as unknown as MetaRecord),
    };

    return info;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function cleanBaraagDisplayName(name: string) {
    const suffix = ' :verified:';
    if (name.endsWith(suffix)) {
        name = name.slice(0, -suffix.length);
    }
    return name;
}

//---------------------------------------------------------------------------------------------------------------------
// main add checks and download buttons to image thumbnails
//---------------------------------------------------------------------------------------------------------------------

var startChecking = () => {
    observeThrottle(checkBaraag);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function checkBaraag() {
    checkBaraagPage();
    checkBaraagMediaGrid();
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkBaraagPage() {
    for (const status of document.querySelectorAll<HTMLElement>('.status, .detailed-status')) {
        if (status.querySelector('.media-gallery, .video-player')) {
            checkBaraagThumbnail(status);
        }
    }
    const modal = document.querySelector<HTMLElement>('.modal-root__modal');
    if (modal) {
        checkBaraagMediaModal(modal);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function baraagLinkInfo(element: HTMLElement, selector: string) {
    const link = element.querySelector<HTMLAnchorElement>(selector);
    if (!link) {
        G_check_log.log(element, 'Link not found');
        return;
    }
    const regex_result = /\/@([^/]+)\/(\d+)/.exec(link.href);
    if (!regex_result) {
        G_check_log.log(element, 'Link does not match RegExp');
        return;
    }
    const info = {
        site: baraag_info.site,
        user: regex_result[1].toLowerCase(),
        submission: regex_result[2],
    };
    return info;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkBaraagThumbnail(element: HTMLElement) {
    const media_box = element.querySelector<HTMLElement>('.media-gallery, .video-player');
    if (!media_box) {
        G_check_log.log(element, 'Status media not found');
        return;
    }
    const info = baraagLinkInfo(element, '.status__relative-time, .detailed-status__datetime');
    if (!info) {
        return;
    }
    createButton(info, media_box);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkBaraagMediaGrid() {
    for (const element of document.querySelectorAll<HTMLElement>('article > .media-gallery__item')) {
        const info = baraagLinkInfo(element, 'a.media-gallery__item-thumbnail');
        if (!info) {
            continue;
        }
        createButton(info, element);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkBaraagMediaModal(modal: HTMLElement) {
    const info = baraagLinkInfo(modal, '.picture-in-picture__footer a[href^="/@"]');
    if (!info) {
        return;
    }
    if (modal.querySelector('.video-modal__container')) {
        modal.style.position = 'unset';
    }
    createButton(info, modal, { screen: false });
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------

var startDownloading = async (submission: Submission, progress: ProgressController) => {
    const options = await getOptionsStorage<BaraagOptionsValues>(baraag_info.site);

    const init: RequestInit = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const response = await fetchOk(`https://baraag.net/api/v1/statuses/${submission}`, init);
    const obj = await response.json();

    const { info, meta } = getBaraagSubmissionData(submission, obj);
    const file_datas = getBaraagFileDatas(obj);

    const downloads = createBaraagDownloads(meta, file_datas, options);

    return await downloadSubmission(info, downloads, init, progress);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getBaraagSubmissionData(submission: Submission, obj: any) {
    const user_id = obj.account.username;
    // it is possible for display_name to be empty
    const user_name: string = cleanBaraagDisplayName(obj.account.display_name) || user_id;

    const div = document.createElement('div');
    div.innerHTML = DOMPurify.sanitize(obj.content);
    const description = div.textContent.trim().replace(/\s+/g, ' ');

    const date_time = timeParse(obj.created_at);

    const meta: BaraagSubmissionMeta = {
        description,
        site: baraag_info.site,
        userId: user_id,
        userName: user_name,
        submissionId: `${submission}`,
        ...date_time,
    };

    const info: SubmissionInfo = {
        site: baraag_info.site,
        user: user_id.toLowerCase(),
        submission,
    };

    return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getBaraagFileDatas(obj: any) {
    const attachments: any[] = obj.media_attachments;

    const files = attachments.map((attachment) => getBaraagFileData(attachment));
    return files;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getBaraagFileData(attachment: any) {
    const url: string = attachment.url;
    const file_id: string = attachment.id;

    const regex_result = /\/([^/]+)\.(\w+)(?:\?|$)/.exec(url);
    if (!regex_result) {
        throw new Error('Download link does not match RegExp');
    }

    const meta: BaraagFileMeta = {
        fileName: regex_result[1],
        fileId: file_id,
        ext: regex_result[2],
    };

    const info: FileInfo = {
        download: url,
    };

    return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createBaraagDownloads(
    submission_meta: BaraagSubmissionMeta,
    file_datas: BaraagFileData[],
    options: BaraagOptionsValues,
) {
    const downloads = [];
    if (file_datas.length > 1) {
        for (const [i, file] of enumerate(file_datas)) {
            const meta: BaraagMultiple = {
                ...submission_meta,
                ...file.meta,
                page: `${i + 1}`,
            };
            downloads.push({
                ...file.info,
                path: renderPath(options.multiple, meta as unknown as MetaRecord),
            });
        }
    } else {
        const meta: BaraagFile = {
            ...submission_meta,
            ...file_datas[0].meta,
        };
        downloads.push({
            ...file_datas[0].info,
            path: renderPath(options.file, meta as unknown as MetaRecord),
        });
    }
    return downloads;
}
