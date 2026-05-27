//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

var G_site_info: SiteInfo = deviantart_info;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var getPageInfo = async () => {
    const url = window.location.href;

    const path_components = pathComponents(url);

    let page: string = deviantart_info.site;
    let has_user = false;
    let user: string | undefined;
    if (['daily-deviations', 'watch', 'notifications'].includes(path_components[0])) {
        page = path_components[0];
    } else if (!path_components[1] && document.title.endsWith(' on DeviantArt')) {
        page = 'user';
    } else if (path_components[1]) {
        page = path_components[1];
    }

    if (document.querySelector('h1 [title="Group"]')) {
        page = 'group';
    }

    // sample of user associated paths
    // /<user>
    // /<user>/gallery/all
    // /notifications/watch/deviations/<user>
    // /watch/<user>/deviations
    // /<user>/art/title-123456789
    if (
        [
            'about',
            'user',
            'gallery',
            'prints',
            'favourites',
            'posts',
            'shop',
            'subscriptions',
            'art',
            'journal',
        ].includes(page)
    ) {
        has_user = true;
        user = path_components[0];
    } else if (page === 'notifications' && path_components[1] === 'watch' && path_components[3]) {
        has_user = true;
        user = path_components[3];
    } else if (page === 'watch' && path_components[2]) {
        has_user = true;
        user = path_components[1];
    }
    user = user?.toLowerCase();

    if (has_user && !user) {
        throw new Error(`User not found for page '${page}'`);
    }

    const info: PageInfo = { site: deviantart_info.site, url, page, user };
    return info;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var getUserInfo = async (user: User) => {
    // Firefox only - wrappedJSObject
    const csrf_token: string | undefined = (window as any).wrappedJSObject?.__CSRF_TOKEN__;
    if (!csrf_token) {
        throw new Error('Unable to find CSRF token');
    }
    const params = new URLSearchParams({
        username: user,
        csrf_token,
    });
    const response = await fetchOk(`https://www.deviantart.com/_puppy/dauserprofile/init/about?${params}`);
    const data = await response.json();

    const name = data.owner.username;
    const icon = data.owner.usericon;

    const stats = new Map();
    stats.set('Deviations', data.pageExtraData.stats.deviations);
    stats.set('Favourites', data.pageExtraData.stats.favourites);
    stats.set('Views', data.pageExtraData.stats.pageviews);

    const folder_meta: DeviantartUserFolder = {
        site: deviantart_info.site,
        userId: user,
        userName: name,
    };

    const options = await getOptionsStorage<DeviantartOptionsValues>(deviantart_info.site);

    const info: UserInfo = {
        site: deviantart_info.site,
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
    observeThrottle(checkDeviantart);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function checkDeviantart() {
    const page = await getPageInfo();
    if (page.page === 'art' && page.user) {
        checkDeviantartSubmissionPage(page.url, page.user);
    }
    checkDeviantartPage(page.user);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkDeviantartPage(page_user?: User) {
    checkDeviantartOldThumbnails(page_user);
    checkDeviantartThumbnails(page_user);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

// legacy
function checkDeviantartOldThumbnails(page_user?: User) {
    for (const thumb of document.querySelectorAll<HTMLElement>('.thumb, .embedded-image-deviation')) {
        // current unsupported thumbs
        //                 journals,  gallery folder preview images
        if (thumb.matches('.freeform:not(.literature), div.stream.col-thumbs *')) {
            continue;
        }
        // devations in texts
        else if (thumb.matches('.shadow > *:not(.lit)')) {
            thumb.style.display = 'inline-block';
            const img = thumb.querySelector<HTMLImageElement>(':scope > img');
            img?.style.setProperty('display', 'block');
        }
        thumb.style.setProperty('--as-z-index', '10');

        checkDeviantartThumbnail(thumb, page_user);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkDeviantartThumbnail(element: HTMLElement, page_user?: User) {
    const link = element.matches('a') ? (element as HTMLAnchorElement) : element.querySelector('a');
    if (!link) {
        G_check_log.log(element, 'Link not found');
        return;
    }
    const url = link.href;
    if (/https?:\/\/(?:sta\.sh|www\.deviantart\.com\/stash)\//.test(url)) {
        G_check_log.log(element, 'Unable to download sta.sh thumbnails');
        return;
    }
    const submission_id = /(?:\/|-)(\d+)(?:\?|#|$)/.exec(url)?.[1];
    if (!submission_id) {
        G_check_log.log(element, 'Submission not found');
        return;
    }
    const submission = parseInt(submission_id, 10);

    const user = url.split('/')[3] ?? page_user;
    if (!user) {
        G_check_log.log(element, 'User not found');
        return;
    }
    const parent = navigateUpSmaller(link);

    const info = {
        site: deviantart_info.site,
        user,
        submission,
    };
    return createButton(info, parent);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkDeviantartThumbnails(page_user?: User) {
    for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href*="/art/"]')) {
        if (
            link.parentElement?.querySelector('[data-testid="thumb"]') ||
            link.matches('figure[data-deviation] > *') || // thumbnails in description
            link.matches('section + a[aria-label$=", literature"]') || // literature gallery thumbnails
            link.querySelector('section > h2') || // literature side thumbnails
            (link.matches('.draft-thumb') && link.querySelector('img')) // thumbnails in literature
        ) {
            checkDeviantartThumbnail(link, page_user);
        }
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkDeviantartSubmissionPage(url: string, user: User) {
    const stage = document.querySelector('header + div > div > div > div > :nth-child(2)');
    if (!stage) {
        G_check_log.log('Submission page:', 'User not found');
        return;
    }
    const submission_id = /(?:\/|-)(\d+)(?:\?|#|$)/.exec(url)?.[1];
    if (!submission_id) {
        G_check_log.log('Submission page:', 'Submission ID not found in url');
        return;
    }
    const info = {
        site: deviantart_info.site,
        user,
        submission: parseInt(submission_id, 10),
    };
    // img, video, pdf
    const content = stage.querySelector('img, video, object[type="application/pdf"]');
    if (content) {
        let parent = content.parentElement;
        if (parent) {
            parent = navigateUpSmaller(parent);
            createButton(info, parent, { screen: false });
        }
        return;
    }
    // literature
    const title = stage.querySelector('h1');
    if (title) {
        const frame = wrapElement(title);
        frame.style.margin = '0';
        frame.style.textAlign = 'initial';

        createButton(info, frame, { screen: false });
    }
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------
// submission - https://www.deviantart.com/_puppy/dadeviation/init?deviationid=<sumbissionId>&username=<userName>&type=art&include_session=false&csrf_token=
// user       - https://www.deviantart.com/_puppy/dauserprofile/init/about?username=<userName>&csrf_token=
// gallery    - https://www.deviantart.com/_puppy/dashared/gallection/contents?username=<userName>&type=gallery&offset=0&limit=60&all_folder=true&csrf_token= // 60 is max

var startDownloading = async (submission: Submission, progress: ProgressController) => {
    const options = await getOptionsStorage<DeviantartOptionsValues>(deviantart_info.site);

    const init: RequestInit = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const page_response = await fetchOk(submissionLink(submission), init);
    const user_name = page_response.url.split('/')[3];

    // Firefox only - wrappedJSObject
    let csrf_token: string | undefined = (window as any).wrappedJSObject?.__CSRF_TOKEN__;
    if (!csrf_token) {
        const page_text = await page_response.text();
        csrf_token = /__CSRF_TOKEN__\s=\s'(.+?)'/.exec(page_text)?.[1];
    }
    if (!csrf_token) {
        throw new Error('Unable to find CSRF token');
    }

    const params = new URLSearchParams({
        deviationid: `${submission}`,
        username: user_name,
        type: 'art',
        include_session: 'false',
        csrf_token,
    });
    const response = await fetchOk(`https://www.deviantart.com/_puppy/dadeviation/init?${params}`, init);
    let obj = await response.json();

    const { info, meta } = getDeviantartSubmissionData(submission, obj);

    const stash_downloads = [];
    if (options.stash) {
        const start_time = Date.now();
        const stashes = await getStashIds(obj, init, csrf_token, progress);
        const stash_datas = await getStashDatas(stashes.stash_ids, init, csrf_token, options, progress);
        for (const stash of stash_datas) {
            const download = createStashDownload(meta, stash.submission.meta, stash.file, options);
            if (stash.submission.meta.submissionId in stashes.blobs) {
                download.download = stashes.blobs[stash.submission.meta.submissionId];
            }
            stash_downloads.push(download);
        }
        // re-get the submission data after 5 minutes for a new download token
        if (Date.now() - start_time > 300_000) {
            const response = await fetchOk(`https://www.deviantart.com/_puppy/dadeviation/init?${params}`, init);
            obj = await response.json();
        }
    }

    const file_data = await getDeviantartFileData(obj, meta, options, progress);
    const file_datas = [file_data, ...(await getDeviantartAdditionalFileDatas(obj, options.larger))];
    const downloads = createDeviantartDownloads(meta, file_datas, options);

    if (options.moveFile && stash_downloads.length > 0) {
        const stash_folder = /.*\//.exec(stash_downloads[0].path)?.[0] ?? '';
        for (const download of downloads) {
            const deviant_file = download.path.split('/').pop();
            download.path = `${stash_folder}${deviant_file}`;
        }
    }

    downloads.push(...stash_downloads);

    return await downloadSubmission(info, downloads, init, progress, meta.title);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getDeviantartSubmissionData(submission: Submission, obj: any) {
    const user_name = obj.deviation.author.username;
    const user_id = user_name.toLowerCase();
    const title = obj.deviation.title;

    const date_time = timeParse(obj.deviation.publishedTime);

    const meta: DeviantartSubmissionMeta = {
        site: deviantart_info.site,
        userId: user_id,
        userName: user_name,
        submissionId: `${submission}`,
        title,
        ...date_time,
    };

    const info: SubmissionInfo = {
        site: deviantart_info.site,
        user: user_id,
        submission,
    };

    return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getDeviantartFileData(
    obj: any,
    submission_meta: DeviantartSubmissionMeta,
    options: DeviantartOptionsValues,
    progress: ProgressController,
) {
    const file_name: string =
        obj.deviation.media.prettyName ??
        deviantartFileName(submission_meta.title, submission_meta.userId, submission_meta.submissionId);

    const meta: DeviantartFileMeta = {
        fileName: file_name,
        ext: '',
    };

    let url: string;
    let size: number | undefined;

    let info: FileInfo;
    const type = obj.deviation.type;
    if (options.freeDownload && obj.deviation.isDownloadable) {
        url = obj.deviation.extended.download.url;
        size = obj.deviation.extended.download.filesize;
        info = {
            download: url,
            size,
        };
    } else if (type === 'literature') {
        progress.message('Getting literature');
        const download = await getDeviantartLiterature(
            options.literature,
            obj,
            { ...submission_meta, ...meta },
            options,
        );
        info = { download };
        meta.ext = options.literature;
        return { info, meta };
    } else {
        const work_fetch = new WorkFetch();
        const watermarked = obj.deviation.extended?.hasWatermark ?? false;
        const download = await getMediaUrl(
            obj.deviation.media,
            obj.deviation.extended.originalFile.width,
            obj.deviation.extended.originalFile.height,
            options.larger,
            work_fetch,
            watermarked,
        );
        work_fetch.disconnect();
        info = { download };
        if (typeof download === 'string') {
            url = download;
        } else {
            meta.ext = 'png';
            return { info, meta };
        }
    }

    if (type === 'pdf') {
        meta.ext = 'pdf';
        return { info, meta };
    }

    // example download urls
    // https://www.deviantart.com/download/123456789/d21i3v9-3885adbb-f9f1-4fbe-8d2d-98c4578ba244.ext?token=...&ts=1234567890
    // https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/2f9bc7a0-1a23-4a7e-ad00-07e8ffd4105d/d21i3v9-3885adbb-f9f1-4fbe-8d2d-98c4578ba244.ext/v1/fill/w_1280,h_720,q_100,strp/title_by_username_d21i3v9-fullview.ext?token=...

    const ext_regex_result = /\.(\w+)(?:\?|$)/.exec(url);
    if (!ext_regex_result) {
        throw new Error('File extention not found');
    }

    meta.ext = ext_regex_result[1];
    return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getDeviantartAdditionalFileDatas(obj: any, get_larger: boolean) {
    const file_datas = [];

    const additional_media = obj.deviation?.extended?.additionalMedia;
    if (additional_media) {
        const orig_w = obj.deviation.extended.originalFile.width;
        const orig_h = obj.deviation.extended.originalFile.height;
        const watermarked = obj.deviation.extended?.hasWatermark ?? false;
        const work_fetch = new WorkFetch();
        for (const item of additional_media) {
            const file_name_ext: string = item.filename;

            const file_regex_result = /(.+)\.(\w+)$/.exec(file_name_ext);
            if (!file_regex_result) {
                throw new Error('File does not match RegExp');
            }

            const meta: DeviantartFileMeta = {
                fileName: file_regex_result[1],
                ext: file_regex_result[2],
            };

            const s = item.media.types.find((t: any) => t.t === '125S').ss[0];
            const scale = Number(/scl_(\d+(\.\d+)?)/.exec(s.c)?.[1]);
            const ratio: number = item.width / item.height;
            const min_size: number = Math.round(s.w / scale);
            let full_width: number;
            let full_height: number;
            if (ratio < 1) {
                full_width = min_size;
                full_height = Math.round(min_size / ratio);
            } else {
                full_height = min_size;
                full_width = Math.round(min_size * ratio);
            }
            // align assuming same size as main file
            if (Math.abs(orig_w - full_width) < 2 && Math.abs(orig_h - full_height) < 2) {
                full_width = orig_w;
                full_height = orig_h;
            }

            const download = await getMediaUrl(
                item.media,
                full_width,
                full_height,
                get_larger,
                work_fetch,
                watermarked,
            );
            if (!(typeof download === 'string')) {
                meta.ext = 'png';
            }
            const info: FileInfo = {
                download,
            };
            file_datas.push({ info, meta });
        }
        work_fetch.disconnect();
    }
    return file_datas;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function buildLargerImage(url: string, full_width: number, full_height: number, watermarked: boolean) {
    const params = new URL(url).searchParams;
    const tile_width = /w_(\d+)/.exec(url)?.[1];
    const tile_height = /h_(\d+)/.exec(url)?.[1];
    const base_url = /.+?\/v1\//.exec(url)?.[0];
    if (!tile_width || !tile_height || !base_url) {
        throw new Error('URL does not match expected preview URL');
    }
    const work_tile = browser.runtime.connect();

    const result = new Promise<Blob>((resolve, reject) => {
        work_tile.onMessage.addListener((message) => {
            const m = message as WorkTileResponse;
            switch (m.message) {
                case 'result':
                    resolve(m.result);
                    break;

                case 'error':
                    reject(m.error);
                    break;
            }
        });
        work_tile.onDisconnect.addListener((p) => {
            if (p.error) {
                reject(p.error.message);
            }
        });
        work_tile.postMessage({
            action: 'work_tile',
            width: full_width,
            height: full_height,
            tile_width: parseInt(tile_width, 10),
            tile_height: parseInt(tile_height, 10),
            url: base_url,
            token: params.get('token') ?? '',
            watermarked,
        } satisfies WorkMessage);
    });

    const blob = await result;

    work_tile.disconnect();
    return blob;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getMediaUrl(
    media_obj: any,
    width: number,
    height: number,
    get_larger: boolean,
    work_fetch: WorkFetch,
    watermarked: boolean,
) {
    const url = buildMediaUrl(media_obj);
    // is video url
    if (/\/v\//.test(url)) {
        return url;
    }
    const test_urls: string[] = [
        media_obj.baseUri,
        ...(media_obj.token ?? []).map((token: string) => `${media_obj.baseUri}?token=${token}`),
    ];
    for (const url of test_urls) {
        if (await work_fetch.testOk(url)) {
            return url;
        }
    }
    if (get_larger) {
        return await buildLargerImage(url, width, height, watermarked);
    }
    return url;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function buildMediaUrl(media_obj: any) {
    // usually:
    // type.c = image
    // type.s = swf // no longer supported?
    // type.b = mp4, gif
    const types = media_obj.types;
    // sort by resolution
    const compare_value = (t: any) => t.w * t.h + (t.t === 'fullview' ? 1 : 0);
    types.sort((a: any, b: any) => compare_value(b) - compare_value(a));
    // sort by file size
    // it is possible for no types to have a file size
    // this assumes a larger file size is a better quality file
    types.sort((a: any, b: any) => (b.f ?? 0) - (a.f ?? 0));
    const media = types[0];

    const uri = media_obj.baseUri;
    let media_url = media.t === 'fullview' ? (media.c ? `${uri}${media.c}` : uri) : (media.s ?? media.b);
    if (!media_url) {
        throw new Error('Unable to find download URL');
    }

    media_url = media_url.replace(/<prettyName>/g, media_obj.prettyName);

    const tokens = media_obj.token;
    if (tokens) {
        media_url = `${media_url}?token=${tokens[0]}`;
    }
    return media_url as string;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createDeviantartDownloads(
    submission_meta: DeviantartSubmissionMeta,
    file_datas: DeviantartFileData[],
    options: DeviantartOptionsValues,
) {
    const downloads = [];
    if (file_datas.length > 1) {
        for (const [i, file] of enumerate(file_datas)) {
            const meta: DeviantartMultiple = {
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
        const meta: DeviantartFile = {
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

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getStashDatas(
    stash_ids: number[],
    init: RequestInit,
    csrf_token: string,
    options: DeviantartOptionsValues,
    progress: ProgressController,
) {
    const work_fetch = new WorkFetch();
    const datas = [];
    const stash_url = 'https://www.deviantart.com/_puppy/dadeviation/stash/init';
    for (const [i, stash_id] of enumerate(stash_ids)) {
        progress.onOf('Getting stash', i + 1, stash_ids.length);
        await timer(G_options.queueWait);

        const params = new URLSearchParams({
            deviationid: `${stash_id}`,
            include_session: 'false',
            csrf_token,
        });

        let obj: any;
        try {
            const response = await work_fetch.fetchOk(`${stash_url}?${params}`, init);
            obj = await response.json();
        } catch (error) {
            asLog('error', error);
            continue;
        }

        const submission = getStashSubmissionData(obj);
        const file: { info: FileInfo; meta: StashFileMeta } = await getDeviantartFileData(
            obj,
            submission.meta,
            options,
            progress,
        );
        datas.push({ submission, file });
    }

    work_fetch.disconnect();
    return datas;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getStashSubmissionData(obj: any) {
    const url_id = obj.deviation.stashPrivateid.toString(36);
    if (!url_id) {
        throw new Error('URL ID not found');
    }
    if (!obj.deviation.deviationId) {
        throw new Error('Submission ID not found');
    }
    const submission_id = `${obj.deviation.deviationId}`;
    const title = obj.deviation.title ?? '';

    const user_name = obj.deviation.author.username;
    if (!user_name) {
        throw new Error('User name not found');
    }
    const user_id = user_name.toLowerCase();

    const published_time = obj.deviation.publishedTime;
    if (!published_time) {
        throw new Error('Date not found');
    }
    const date_time = timeParse(published_time);

    const meta: StashSubmissionMeta = {
        site: deviantart_info.site,
        userId: user_id,
        userName: user_name,
        submissionId: submission_id,
        title,
        urlId: url_id,
        ...date_time,
    };

    return { meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createStashDownload(
    submission_meta: DeviantartSubmissionMeta,
    stash_meta: StashSubmissionMeta,
    file_data: StashFileData,
    options: DeviantartOptionsValues,
) {
    const meta: StashFile = { ...stash_meta, ...file_data.meta };

    const download: DownloadInfo = {
        ...file_data.info,
        path: renderPath(options.stashFile, meta as unknown as MetaRecord, submission_meta as unknown as MetaRecord),
    };
    return download;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getStashIds(obj: any, init: RequestInit, csrf_token: string, progress: ProgressController) {
    // find stash in description
    let description: string = obj.deviation.extended.descriptionText?.html?.markup ?? '';
    if (description.startsWith('{"') && description.endsWith('}')) {
        description = JSON.stringify(JSON.parse(description));
    }
    // example stash urls
    // https://sta.sh/
    // https://www.deviantart.com/stash/
    const matches = description.matchAll(/(https?:\/\/(?:sta\.sh|www\.deviantart\.com\/stash)\/.+?)[\s'"]/g);
    const urls = [...new Set(matches.map((m) => m[1]))];

    if (urls.length > 0) {
        progress.message('Found stash links');
    }

    const stash_ids = [];
    const folder_urls = [];
    const stash_regex = /\/(0|2)([0-9a-z]+)/;
    for (const url of urls) {
        const regex_result = stash_regex.exec(url);
        if (regex_result) {
            if (regex_result[1] === '0') {
                stash_ids.push(parseInt(regex_result[2], 36));
            } else {
                folder_urls.push(url);
            }
        }
    }

    const work_fetch = new WorkFetch();
    // some stash folder urls are redirects
    let folder_ids = [];
    for (const folder of folder_urls) {
        const response = await work_fetch.fetchOk(folder, { method: 'HEAD', ...init });
        const folder_id = stash_regex.exec(response.url)?.[2];
        if (folder_id) {
            folder_ids.push(parseInt(folder_id, 36));
        }
    }

    const stash_blobs: Record<string, Blob> = {};
    if (folder_ids.length > 0) {
        const work_zip = new WorkZip();
        for (const [i, folder_id] of enumerate(folder_ids)) {
            const zip_url = `https://sta.sh/zip/2${folder_id.toString(36)}`;
            progress.onOf('Getting stash folder', i + 1, folder_ids.length);
            const response = await work_fetch.fetchOk(zip_url, init);
            const zip_object = await work_zip.parseZip(response.body);
            for (const [file, data] of Object.entries(zip_object)) {
                const submission_id_36 = /d(\w+?)-/.exec(file.split('/').pop() ?? '')?.[1];
                if (!submission_id_36) {
                    continue;
                }
                const submission_id = `${parseInt(submission_id_36, 36)}`;
                stash_blobs[submission_id] = new Blob([data]);
            }
        }
        work_zip.disconnect();
    }

    const stash_folder_url = 'https://www.deviantart.com/_puppy/v1/studio/pages/stash';
    while (folder_ids.length > 0) {
        const new_folder_ids: number[] = [];
        for (const folder_id of folder_ids) {
            const params = new URLSearchParams({
                init: 'false',
                folderid: `${folder_id}`,
                csrf_token,
            });
            const response = await work_fetch.fetchOk(`${stash_folder_url}?${params}`, init);
            let obj = await response.json();

            new_folder_ids.push(...obj.subfolders.results.map((f: any) => f.folderId));
            stash_ids.push(...obj.deviations.studioResults.map((s: any) => s.deviation.stashPrivateid));

            const per_page = 50;
            let offset = 0;
            while (obj.deviations.hasMore) {
                offset += per_page;
                const params = new URLSearchParams({
                    init: 'false',
                    folderid: `${folder_id}`,
                    deviations_offset: `${offset}`,
                    csrf_token,
                });
                const response = await work_fetch.fetchOk(`${stash_folder_url}?${params}`, init);
                obj = await response.json();
                stash_ids.push(...obj.deviations.studioResults.deviation.map((f: any) => f.stashPrivateid));
            }
        }
        folder_ids = new_folder_ids;
    }
    work_fetch.disconnect();

    return {
        blobs: stash_blobs,
        stash_ids: [...new Set(stash_ids)].sort(),
    };
}

//---------------------------------------------------------------------------------------------------------------------
// download helper functions
//---------------------------------------------------------------------------------------------------------------------

function deviantartFileName(title: string, user_id: string, submission_id: string) {
    const id36 = parseInt(submission_id, 10).toString(36);
    const title_lower = title.replace(/[\s\W]/g, '_').toLowerCase();
    return `${title_lower}_by_${user_id}_d${id36}`;
}

//---------------------------------------------------------------------------------------------------------------------
// literature conversion
//---------------------------------------------------------------------------------------------------------------------

async function getDeviantartLiterature(
    type: string,
    obj: any,
    meta: DeviantartFile | StashFile,
    options: DeviantartOptionsValues,
) {
    const url = obj.deviation.url;
    const response = await fetchOk(url, { credentials: 'include' });
    const dom = await response.dom();

    const story_element = dom.querySelector<HTMLElement>(
        'section .da-editor-journal > div > div > div, section > div > .legacy-journal, section > span + div > div[data-editor-viewer]',
    );
    if (!story_element) {
        throw new Error('Story element not found');
    }
    const story = cleanDeviantartLiterature(story_element);
    story.id = 'content';

    const decription_element = dom.querySelector<HTMLElement>(
        '#description > div > div, [role=complementary] + div .legacy-journal, main > div > div > div:only-child > div:not([class]) > div',
    );
    const description = decription_element
        ? cleanDeviantartLiterature(decription_element)
        : document.createElement('section');
    description.id = 'description';

    const story_text = getDeviantartLiteratureText(story);
    const word_count = wordCount(story_text);

    let template: string;
    let story_content: string;
    let description_content: string;

    if (type === 'html') {
        if (options.includeImage) {
            const icon_url = await getImageIcon(url);
            if (icon_url && !story.innerHTML.includes(icon_url)) {
                const img = document.createElement('img');
                img.id = 'image';
                img.src = icon_url;
                story.prepend(img);
            }
        }

        if (options.embedImages) {
            await embedImages(story);
            await embedImages(description);
        }

        template = options.literatureHTML;
        story_content = story.outerHTML;
        description_content = description.outerHTML;
    } else {
        template = options.literatureText;
        story_content = story_text;
        description_content = getDeviantartLiteratureText(description);
    }

    const story_meta: DeviantartLiterature | StashLiterature = {
        story: story_content,
        description: description_content,
        wordCount: `${word_count}`,
        url,
        ...meta,
    };

    const file_text = renderTemplate(template, type, story_meta as unknown as MetaRecord);

    return new Blob([file_text], { type: `text/${type}` });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function cleanDeviantartLiterature(element: HTMLElement) {
    // simplify thumbnail journal links
    for (const a of element.querySelectorAll<HTMLAnchorElement>(`figure[data-deviation*='type":"literature'] a`)) {
        a.replaceChildren(a.href);
    }
    // deviantart treats paragraphs like line breaks
    // combine paragraphs
    if (element.matches('.da-editor-journal div') && element.firstElementChild) {
        let child = element.firstElementChild;
        while (child.nextElementSibling) {
            const next = child.nextElementSibling;
            if (child.nodeName === 'P' && next.nodeName === 'P') {
                child.append(document.createElement('br'), ...next.childNodes);
                next.parentElement?.removeChild(next);
            } else {
                child = child.nextElementSibling;
            }
        }
    }
    const section = document.createElement('section');
    section.replaceChildren(...element.childNodes);
    return cleanWriting(section, ['id', 'class', 'style', 'srcset']);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getDeviantartLiteratureText(element: HTMLElement) {
    element = document.importNode(element, true);
    for (const a of element.querySelectorAll('a')) {
        a.href = a.href.replace(/https?:\/\/www\.deviantart\.com\/users\/outgoing\?/g, '');
        a.textContent = a.href;
    }
    return getElementText(element);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getImageIcon(url: string) {
    const params = new URLSearchParams({
        url,
        format: 'json',
    });
    const response = await workFetchOk(`https://backend.deviantart.com/oembed?${params}`);
    const oembed = await response.json();
    return oembed.fullsize_url as string | undefined;
}
