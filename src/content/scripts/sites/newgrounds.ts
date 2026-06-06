//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

var G_site_info: SiteInfo = newgrounds_info;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var getPageInfo = async () => {
    const url = window.location.href;

    const path_components = pathComponents(url);
    let page = path_components[0] ?? newgrounds_info.site;

    let has_user = false;
    let user: string | undefined;
    if (['view', 'listen'].includes(path_components[1])) {
        page = 'submission';
        has_user = true;
        user = document.querySelector<HTMLAnchorElement>('.authorlinks h4 a')?.href.split('//')[1].split('.')[0];
    } else if (document.querySelector<HTMLElement>('#user-header')) {
        has_user = true;
        user = document.querySelector<HTMLAnchorElement>('#user-header .user-link')?.href.split('//')[1].split('.')[0];
    }

    if (has_user && !user) {
        throw new Error(`User not found for page '${page}'`);
    }

    const info: PageInfo = { site: newgrounds_info.site, url, page, user };
    return info;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var getUserInfo = async (user: User) => {
    const init: RequestInit = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const response = await fetchOk(`https://${user}.newgrounds.com/`, init);
    const dom = await response.dom();

    const name = dom.querySelector<HTMLElement>('.user-header-name a')?.textContent.trim() ?? user;

    const icon = dom.querySelector<HTMLMetaElement>(`meta[name="image"]`)?.content;

    const stats = new Map<string, string>();
    const tabs = ['art', 'audio', 'games', 'movies', 'fans', 'favorites'];
    for (const tab of tabs) {
        const element = dom.querySelector<HTMLElement>(`.user-header-button[href="/${tab}"]`);
        if (element) {
            const label = element.querySelector<HTMLElement>('span')?.textContent.trim();
            const value = element.querySelector<HTMLElement>('strong')?.textContent.trim();
            if (label && value) {
                stats.set(label[0].toUpperCase() + label.slice(1).toLowerCase(), value);
            }
        }
    }

    const folder_meta: NewgroundsUserFolder = {
        site: newgrounds_info.site,
        userId: user,
        userName: name,
    };

    const options = await getOptionsStorage<NewgroundsOptionsValues>(newgrounds_info.site);

    const info: UserInfo = {
        site: newgrounds_info.site,
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
    observeThrottle(checkNewgrounds);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function checkNewgrounds() {
    const page = await getPageInfo();

    if (page.page === 'submission' && page.user) {
        checkNewgroundsSubmissionPage(page.url, page.user);
    }
    if (page.page === 'favorites') {
        page.user = undefined;
    }
    checkNewgroundsPage(page.user);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkNewgroundsPage(page_user?: User) {
    for (const art_thumb of document.querySelectorAll<HTMLElement>(
        '[class*="item-portalitem-art"], .portalitem-footer-feature.art',
    )) {
        checkNewgroundsArtThumbnail(art_thumb);
    }
    const userless_section_selector =
        ':is(#pod_type_8, #pod_type_9, #pod_type_12, #pod_type_13, #favorites_list, #footer-featured-items) *';
    for (const portal_thumb of document.querySelectorAll<HTMLElement>(
        '[class*="item-portalsubmission"], .portalsubmission-cell, .portalsubmission-footer-feature.game',
    )) {
        checkNewgroundsPortalThumbnail(
            portal_thumb,
            portal_thumb.matches(userless_section_selector) ? undefined : page_user,
        );
    }
    for (const audio_thumb of document.querySelectorAll<HTMLElement>('.audio-wrapper')) {
        checkNewgroundsAudioThumbnail(
            audio_thumb,
            audio_thumb.matches(userless_section_selector) ? undefined : page_user,
        );
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkNewgroundsArtThumbnail(element: HTMLElement) {
    const href = (element as HTMLAnchorElement).href;
    if (!href) {
        G_check_log.log(element, 'Link not found');
        return;
    }
    const submission = newgroundsUrlToSubmission(href);
    if (!submission) {
        G_check_log.log(element, 'Submission not found');
        return;
    }
    const user = pathComponents(href)[2];
    const info = {
        site: newgrounds_info.site,
        user,
        submission,
    };
    return createButton(info, element);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkNewgroundsPortalThumbnail(element: HTMLElement, page_user?: User) {
    const href =
        (element as HTMLAnchorElement).href ??
        element.querySelector<HTMLAnchorElement>('a[href*="/portal/view/"]')?.href;
    if (!href) {
        G_check_log.log(element, 'Link not found');
        return;
    }
    const submission = newgroundsUrlToSubmission(href);
    if (!submission) {
        G_check_log.log(element, 'Submission not found');
        return;
    }
    const user =
        element.querySelector<HTMLElement>('.item-details > span:nth-of-type(2)')?.textContent ??
        element.querySelector<HTMLElement>('.detail-title > span > strong')?.textContent ??
        element.querySelector<HTMLElement>('.card-title > span')?.textContent.split(' ')[1] ??
        page_user ??
        '';
    const info = {
        site: newgrounds_info.site,
        user: user.trim().toLowerCase(),
        submission,
    };
    return createButton(info, element);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkNewgroundsAudioThumbnail(element: HTMLElement, page_user?: User) {
    const href = element.querySelector<HTMLAnchorElement>('a[href*="/audio/listen/"]')?.href;
    if (!href) {
        G_check_log.log(element, 'Link not found');
        return;
    }
    const submission = newgroundsUrlToSubmission(href);
    if (!submission) {
        G_check_log.log(element, 'Submission not found');
        return;
    }
    const user =
        element.querySelector<HTMLAnchorElement>('.item-author')?.href.split('//')[1].split('.')[0] ??
        element.querySelector<HTMLElement>('.detail-title > span > strong')?.textContent ??
        page_user ??
        '';
    const info = {
        site: newgrounds_info.site,
        user: user.trim().toLowerCase(),
        submission,
    };
    return createButton(info, element);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function newgroundsUrlToSubmission(url: string) {
    const comps = pathComponents(url);
    switch (comps[0]) {
        case 'portal':
        case 'audio':
            return `${comps[0]};${comps[2]}` as Submission;
        case 'art':
            return `${comps[0]};${comps[2]};${comps[3]}` as Submission;
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkNewgroundsSubmissionPage(url: string, user: User) {
    const content =
        document.querySelector<HTMLElement>('[itemscope] > .pod-body > .image') ??
        document.querySelector<HTMLElement>('#embed_podcontent') ??
        document.querySelector<HTMLElement>('#ng-global-video-player[style]');
    if (!content) {
        G_check_log.log('Submission page:', 'Media element not found');
        return;
    }
    content.style.setProperty('--as-z-index', '101');
    const submission = newgroundsUrlToSubmission(url);
    if (!submission) {
        G_check_log.log('Submission page:', `Unexpected submission url ${url}`);
        return;
    }
    const info = {
        site: newgrounds_info.site,
        user,
        submission,
    };
    return createButton(info, content, { screen: false });
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------

var startDownloading = async (submission: Submission, progress: ProgressController) => {
    const options = await getOptionsStorage<NewgroundsOptionsValues>(newgrounds_info.site);
    const init: RequestInit = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const url = newgrounds_info.links.submission(submission);
    const response = await workFetchOk(url, init);
    const dom = await response.dom();
    const { info, meta } = getNewgroundsSubmissionData(submission, dom);
    let downloads: DownloadInfo[];
    switch (getNewgroundsProjectType(dom)) {
        case 'art': {
            const art_meta = {
                slug: url.split('/')[6],
                ...meta,
            };
            const file_datas = await getNewgroundsArtFileDatas(dom);
            downloads = createNewgroundsArtDownloads(art_meta, file_datas, options);
            break;
        }
        case 'audio': {
            const file_data = getNewgroundsAudioFileData(dom);
            downloads = [createNewgroundsAudioDownload(meta, file_data, options)];
            break;
        }
        case 'movie': {
            const file_data = await getNewgroundsMovieFileData(dom, meta);
            downloads = [createNewgroundsMovieDownload(meta, file_data, options)];
            break;
        }
        case 'game': {
            const game_data = getNewgroundsGameData(dom, url);
            downloads = createNewgroundsGameDownloads(meta, game_data, options);
            break;
        }
    }

    return await downloadSubmission(info, downloads, init, progress, meta.title);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getNewgroundsProjectType(dom: Document): NewgroundsProjectType {
    const type_id = dom.querySelector<HTMLElement>('[data-statistics]')?.getAttribute('data-statistics')?.split('_')[1];
    switch (type_id) {
        case '1':
            return 'movie';
        case '2':
            return 'game';
        case '3':
            return 'audio';
        case '4':
            return 'art';
        default:
            throw new Error('Project type not found');
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getNewgroundsSubmissionData(submission: Submission, dom: Document) {
    const user_link = dom.querySelector<HTMLAnchorElement>('.authorlinks h4 a');
    const user_id = user_link?.href.split('//')[1].split('.')[0];
    if (!user_id) {
        throw new Error('User ID not found');
    }
    const user_name = user_link?.textContent.trim();
    if (!user_name) {
        throw new Error('User name not found');
    }

    const title = dom.querySelector<HTMLElement>('[itemprop="name"]')?.textContent.trim();
    if (!title) {
        throw new Error('Title not found');
    }

    const description = dom.querySelector('#author_comments')?.textContent.trim().replace(/\s+/g, ' ') ?? '';

    const date_string = dom.querySelector<HTMLMetaElement>('[itemprop="datePublished"]')?.content;
    if (!date_string) {
        throw new Error('Date not found');
    }

    const submission_id = dom
        .querySelector<HTMLElement>('[data-statistics]')
        ?.getAttribute('data-statistics')
        ?.split('_')[0];
    if (!submission_id) {
        throw new Error('Submission ID not found');
    }

    const meta: NewgroundsSubmissionMeta = {
        site: newgrounds_info.site,
        userId: user_id,
        userName: user_name,
        submissionId: submission_id,
        title,
        description,
        ...timeParse(date_string),
    };

    const info: SubmissionInfo = {
        site: newgrounds_info.site,
        user: user_id,
        submission,
    };

    return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getNewgroundsArtFileDatas(dom: Document) {
    const file_datas = [];
    const script_text = dom.querySelector<HTMLScriptElement>('[id^="art-gallery-"] + script')?.textContent;
    const image_data = /\s+imageData\s*=\s*(\[(?:.|\n)+?\]);/.exec(script_text ?? '')?.[1];
    if (image_data) {
        const images = JSON.parse(image_data);
        for (const image of images) {
            file_datas.push(urlFileData(image.image));
        }
    } else {
        for (const image_link of dom.querySelectorAll<HTMLAnchorElement>(
            '.image a[href^="https://art.ngfiles.com/images/"]',
        )) {
            file_datas.push(urlFileData(image_link.href));
        }
    }
    // images in author comments
    for (const img of dom.querySelectorAll<HTMLImageElement>('#author_comments img')) {
        file_datas.push(urlFileData(img.src));
    }
    const formats = ['png', 'jpg', 'gif'];
    const work_fetch = new WorkFetch();
    for (const data of file_datas) {
        if (data.meta.ext === 'webp') {
            for (const format of formats) {
                const url = data.info.download.replace('.webp', `.${format}`);
                if (await work_fetch.testOk(url)) {
                    data.meta.ext = format;
                    data.info.download = url;
                    break;
                }
            }
        }
    }
    work_fetch.disconnect();
    return file_datas;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getNewgroundsAudioFileData(dom: Document) {
    const script_text = dom.querySelector<HTMLScriptElement>(
        '#audio_player_embed ~ script:nth-of-type(3)',
    )?.textContent;
    const audio_data = /\snew\sembedController\(\[{"url":(".+?")/.exec(script_text ?? '')?.[1];
    if (!audio_data) {
        throw new Error('Audio data not found');
    }
    const url = JSON.parse(audio_data);
    return urlFileData(url);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getNewgroundsMovieFileData(dom: Document, submission_meta: NewgroundsSubmissionMeta) {
    if (!dom.querySelector<HTMLElement>('#viewing_option_video')) {
        const script_text = dom.querySelector<HTMLScriptElement>(
            '#submission_url + script + script:not([src])',
        )?.textContent;
        const swf_data = /\snew\sembedController\(\[{"url":(".+?")/.exec(script_text ?? '')?.[1];
        if (swf_data) {
            const url = JSON.parse(swf_data);
            return urlFileData(url);
        }
    }

    const init: RequestInit = {
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
        },
    };
    const response = await fetchOk(`https://www.newgrounds.com/portal/video/${submission_meta.submissionId}`, init);
    const obj = await response.json();

    const src = obj.sources['360p'][0].src as string;
    const base_src = src.split('.360p.mp4')[0];
    const formats = ['mp4', 'webm', 'm4v', 'mov', 'mkv', 'wmv', '1080p.mp4', '720p.mp4', '360p.mp4'];
    const work_fetch = new WorkFetch();
    for (const format of formats) {
        const url = `${base_src}.${format}`;
        if (await work_fetch.testOk(url)) {
            work_fetch.disconnect();
            return urlFileData(url);
        }
    }
    work_fetch.disconnect();
    throw new Error('Movie file not found');
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getNewgroundsGameData(dom: Document, url: string) {
    const game_datas = [];
    const banner_url = dom.querySelector<HTMLMetaElement>('[itemprop="thumbnailUrl"]')?.content;
    if (banner_url) {
        const regex_result = /\/[^/]+\.([^/]+?)(?:\?|#|$)/.exec(banner_url);
        if (!regex_result) {
            throw new Error('Game banner does not match RegExp');
        }
        game_datas.push({
            file: `banner.${regex_result[1]}`,
            info: {
                download: banner_url,
            },
        });
    }
    const game_page = new Blob([
        `<!DOCTYPE html><html><head><script>window.location.replace('${url}');</script></head><body></body></html>`,
    ]);
    game_datas.push({
        file: 'webpage.html',
        info: {
            download: game_page,
        },
    });
    return game_datas;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function urlFileData(url: string) {
    const regex_result = /\/([^/]+)\.([^/]+?)(?:\?|#|$)/.exec(url);
    if (!regex_result) {
        throw new Error('Download link does not match RegExp');
    }
    return {
        meta: {
            fileName: regex_result[1],
            ext: regex_result[2],
        },
        info: {
            download: url,
        },
    };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createNewgroundsArtDownloads(
    submission_meta: NewgroundsArtSubmissionMeta,
    file_datas: NewgroundsFileData[],
    options: NewgroundsOptionsValues,
) {
    const downloads = [];
    if (file_datas.length > 1) {
        for (const [i, file] of enumerate(file_datas)) {
            const meta: NewgroundsMultiple = {
                ...submission_meta,
                ...file.meta,
                page: `${i + 1}`,
            };
            downloads.push({
                ...file.info,
                path: renderPath(options.fileArtMultiple, meta as unknown as MetaRecord),
            });
        }
    } else {
        const meta: NewgroundsArtFile = {
            ...submission_meta,
            ...file_datas[0].meta,
        };
        downloads.push({
            ...file_datas[0].info,
            path: renderPath(options.fileArt, meta as unknown as MetaRecord),
        });
    }
    return downloads;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createNewgroundsAudioDownload(
    submission_meta: NewgroundsSubmissionMeta,
    file_data: NewgroundsFileData,
    options: NewgroundsOptionsValues,
) {
    const meta: NewgroundsFile = {
        ...submission_meta,
        ...file_data.meta,
    };
    return {
        ...file_data.info,
        path: renderPath(options.fileAudio, meta as unknown as MetaRecord),
    };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createNewgroundsMovieDownload(
    submission_meta: NewgroundsSubmissionMeta,
    file_data: NewgroundsFileData,
    options: NewgroundsOptionsValues,
) {
    const meta: NewgroundsFile = {
        ...submission_meta,
        ...file_data.meta,
    };
    return {
        ...file_data.info,
        path: renderPath(options.fileMovie, meta as unknown as MetaRecord),
    };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createNewgroundsGameDownloads(
    submission_meta: NewgroundsGameFolder,
    game_datas: NewgroundsGameData[],
    options: NewgroundsOptionsValues,
) {
    const downloads = [];
    let path = renderPath(options.gameFolder, submission_meta as unknown as MetaRecord);
    if (!path.endsWith('/')) {
        path += '/';
    }
    for (const game_data of game_datas) {
        downloads.push({
            ...game_data.info,
            path: path + game_data.file,
        });
    }
    return downloads;
}
