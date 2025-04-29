"use strict";
//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------
var G_site_info = deviantart_info;
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var getPageInfo = async function () {
    const url = window.location.href;
    const path_components = pathComponents();
    let page = deviantart_info.site;
    let has_user = false;
    let user;
    if (['daily-deviations', 'watch', 'notifications'].includes(path_components[0])) {
        page = path_components[0];
    }
    else if (!path_components[1] && document.title.endsWith(' | DeviantArt')) {
        page = 'user';
    }
    else if (path_components[1]) {
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
    if ([
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
    ].includes(page)) {
        has_user = true;
        user = path_components[0];
    }
    else if (page === 'notifications' && path_components[1] === 'watch' && path_components[3]) {
        has_user = true;
        user = path_components[3];
    }
    else if (page === 'watch' && path_components[2]) {
        has_user = true;
        user = path_components[1];
    }
    user = user?.toLowerCase();
    if (has_user && typeof user === 'undefined') {
        throw new Error(`User not found for page '${page}'`);
    }
    const info = { site: deviantart_info.site, url, page, user };
    return info;
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var getUserInfo = async function (user) {
    const params = new URLSearchParams({
        username: user,
        csrf_token: window.wrappedJSObject?.__CSRF_TOKEN__,
    });
    const response = await fetchOk(`https://www.deviantart.com/_puppy/dauserprofile/init/about?${params}`);
    const data = await response.json();
    const name = data.owner.username;
    const icon = data.owner.usericon;
    const stats = new Map();
    stats.set('Deviations', data.pageExtraData.stats.deviations);
    stats.set('Favourites', data.pageExtraData.stats.favourites);
    stats.set('Views', data.pageExtraData.stats.pageviews);
    const folder_meta = {
        site: deviantart_info.site,
        userId: user,
        userName: name,
    };
    const options = await getOptionsStorage(deviantart_info.site);
    const info = {
        site: deviantart_info.site,
        user,
        name,
        icon,
        stats,
        folder: renderPath(options.userFolder, folder_meta),
    };
    return info;
};
//---------------------------------------------------------------------------------------------------------------------
// main add checks and download buttons to image thumbnails
//---------------------------------------------------------------------------------------------------------------------
var startChecking = async function () {
    const throttler = new FunctionThrottler(checkDeviantart);
    const observer = new MutationObserver(() => {
        throttler.run();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    throttler.run();
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
function checkDeviantartPage(page_user) {
    checkDeviantartOldThumbnails(page_user);
    checkDeviantartThumbnails(page_user);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// legacy
function checkDeviantartOldThumbnails(page_user) {
    for (const thumb of document.querySelectorAll('.thumb, .embedded-image-deviation')) {
        // current unsupported thumbs
        //                 journals,  gallery folder preview images
        if (thumb.matches('.freeform:not(.literature), div.stream.col-thumbs *')) {
            continue;
        }
        // devations in texts
        else if (thumb.matches('.shadow > *:not(.lit)')) {
            thumb.style.display = 'inline-block';
            const img = thumb.querySelector(':scope > img');
            img?.style.setProperty('display', 'block');
        }
        thumb.style.setProperty('--as-z-index', '10');
        checkDeviantartThumbnail(thumb, page_user);
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkDeviantartThumbnail(element, page_user) {
    const link = element.matches('a') ? element : element.querySelector('a');
    if (!link) {
        G_check_log.log('Link not found for', element);
        return;
    }
    const url = link.href;
    if (/https?:\/\/(?:sta\.sh|www\.deviantart\.com\/stash)\//.test(url)) {
        G_check_log.log('Unable to download sta.sh thumbnails', element);
        return;
    }
    const submission_id = /(?:\/|-)(\d+)(?:\?|#|$)/.exec(url)?.[1];
    if (!submission_id) {
        G_check_log.log('Submission not found for', element);
        return;
    }
    const submission = parseInt(submission_id, 10);
    const user = url.split('/')[3] ?? page_user;
    if (!user) {
        G_check_log.log('User not found for', element);
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
function checkDeviantartThumbnails(page_user) {
    for (const link of document.querySelectorAll('a[href*="/art/"]')) {
        if (link.parentElement?.querySelector('[data-testid="thumb"]') ||
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
function checkDeviantartSubmissionPage(url, user) {
    const stage = document.querySelector('header + div > div > div > div > :nth-child(2)');
    if (!stage) {
        return;
    }
    const submission_id = /(?:\/|-)(\d+)(?:\?|#|$)/.exec(url)?.[1];
    if (!submission_id) {
        return;
    }
    const info = {
        site: deviantart_info.site,
        user,
        submission: parseInt(submission_id, 10),
    };
    // img, video, pdf
    const content = stage.querySelector('img, [data-hook=react-playable], object[type="application/pdf"]');
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
var startDownloading = async function (submission, progress) {
    const options = await getOptionsStorage(deviantart_info.site);
    const init = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const page_response = await fetchOk(submissionLink(submission), init);
    const user_name = page_response.url.split('/')[3];
    let csrf_token = window.wrappedJSObject?.__CSRF_TOKEN__;
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
    const file_datas = [file_data, ...(await getDeviantartAdditionalFileDatas(obj))];
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
function getDeviantartSubmissionData(submission, obj) {
    const user_name = obj.deviation.author.username;
    const user_id = user_name.toLowerCase();
    const title = obj.deviation.title;
    const date_time = timeParse(obj.deviation.publishedTime);
    const meta = {
        site: deviantart_info.site,
        userId: user_id,
        userName: user_name,
        submissionId: `${submission}`,
        title,
        ...date_time,
    };
    const info = {
        site: deviantart_info.site,
        user: user_id,
        submission,
    };
    return { info, meta };
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getDeviantartFileData(obj, submission_meta, options, progress) {
    const file_name = obj.deviation.media.prettyName ??
        deviantartFileName(submission_meta.title, submission_meta.userId, submission_meta.submissionId);
    const meta = {
        fileName: file_name,
        ext: '',
    };
    let url;
    let size;
    const type = obj.deviation.type;
    if (obj.deviation.isDownloadable) {
        // the user is cool; downloading full resolution is easy
        url = obj.deviation.extended.download.url;
        size = obj.deviation.extended.download.filesize;
    }
    else if (type === 'literature') {
        meta.ext = options.literature;
        const blob = await getLiterature(options.literature, obj, { ...submission_meta, ...meta }, options, progress);
        const info = {
            download: blob,
        };
        return { info, meta };
    }
    else {
        // the user is uncool; downloading is hard and often full resolution is not available
        url = buildMediaUrl(obj.deviation.media);
    }
    const info = {
        download: url,
        size,
    };
    if (type === 'pdf') {
        meta.ext = 'pdf';
        return { info, meta };
    }
    if (options.larger && /\/v1\/fill\//.test(url)) {
        progress.message('Comparing images');
        info.download = await compareUrls(url); //await compareUrls(url)
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
async function getDeviantartAdditionalFileDatas(obj) {
    const file_datas = [];
    const additional_media = obj.deviation?.extended?.additionalMedia;
    if (additional_media) {
        const fetch_worker = new FetchWorker();
        for (const item of additional_media) {
            const file_name_ext = item.filename;
            const file_regex_result = /(.+)\.(\w+)$/.exec(file_name_ext);
            if (!file_regex_result) {
                throw new Error('File does not match RegExp');
            }
            const meta = {
                fileName: file_regex_result[1],
                ext: file_regex_result[2],
            };
            const test_urls = [
                item.media.baseUri,
                ...item.media.token.map((token) => `${item.media.baseUri}?token=${token}`),
                buildMediaUrl(item.media),
            ];
            for (const url of test_urls) {
                if (await fetch_worker.testOk(url)) {
                    const info = {
                        download: url,
                        size: item.fileSize,
                    };
                    file_datas.push({ info, meta });
                    break;
                }
            }
        }
        fetch_worker.terminate();
    }
    return file_datas;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function buildMediaUrl(media_obj) {
    // usually:
    // type.c = image
    // type.s = swf // no longer supported?
    // type.b = mp4, gif
    const types = media_obj.types;
    // sort by resolution
    const compare_value = (t) => t.w * t.h + (t.t === 'fullview' ? 1 : 0);
    types.sort((a, b) => compare_value(b) - compare_value(a));
    // sort by file size
    // it is possible for no types to have a file size
    // this assumes a larger file size is a better quality file
    types.sort((a, b) => (b.f ?? 0) - (a.f ?? 0));
    const media = types[0];
    const uri = media_obj.baseUri;
    let media_url = media.t === 'fullview' ? (media.c ? `${uri}${media.c}` : uri) : media.s ?? media.b;
    if (!media_url) {
        throw new Error('Unable to find download URL');
    }
    media_url = media_url.replace(/<prettyName>/g, media_obj.prettyName);
    const tokens = media_obj.token;
    if (tokens) {
        media_url = `${media_url}?token=${tokens[0]}`;
    }
    // make sure quailty is 100
    // replacing .jpg with .png can lead to better quailty
    if (/\/v1\/fill\//.test(media_url)) {
        media_url = media_url.replace(/q_\d+/, 'q_100').replace('.jpg?', '.png?');
    }
    return media_url;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function createDeviantartDownloads(submission_meta, file_datas, options) {
    const downloads = [];
    if (file_datas.length > 1) {
        for (const [i, file] of enumerate(file_datas)) {
            const meta = {
                ...submission_meta,
                ...file.meta,
                page: `${i + 1}`,
            };
            downloads.push({
                ...file.info,
                path: renderPath(options.multiple, meta),
            });
        }
    }
    else {
        const meta = {
            ...submission_meta,
            ...file_datas[0].meta,
        };
        downloads.push({
            ...file_datas[0].info,
            path: renderPath(options.file, meta),
        });
    }
    return downloads;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getStashDatas(stash_ids, init, csrf_token, options, progress) {
    const fetch_worker = new FetchWorker();
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
        let obj;
        try {
            const response = await fetch_worker.fetchOk(`${stash_url}?${params}`, init);
            obj = await response.json();
        }
        catch (error) {
            asLog('error', error);
            continue;
        }
        const submission = getStashSubmissionData(obj);
        const file = await getDeviantartFileData(obj, submission.meta, options, progress);
        datas.push({ submission, file });
    }
    fetch_worker.terminate();
    return datas;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getStashSubmissionData(obj) {
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
    const meta = {
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
function createStashDownload(submission_meta, stash_meta, file_data, options) {
    const meta = { ...stash_meta, ...file_data.meta };
    const download = {
        ...file_data.info,
        path: renderPath(options.stashFile, meta, submission_meta),
    };
    return download;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getStashIds(obj, init, csrf_token, progress) {
    // find stash in description
    let description = obj.deviation.extended.descriptionText?.html?.markup ?? '';
    if (description.startsWith('{"') && description.endsWith('}')) {
        description = JSON.stringify(JSON.parse(description));
    }
    // example stash urls
    // https://sta.sh/
    // https://www.deviantart.com/stash/
    const matches = description.matchAll(/(https?:\/\/(?:sta\.sh|www\.deviantart\.com\/stash)\/.+?)[\s'"]/g);
    const urls = [...new Set([...matches].map((m) => m[1]))];
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
            }
            else {
                folder_urls.push(url);
            }
        }
    }
    const fetch_worker = new FetchWorker();
    // some stash folder urls are redirects
    let folder_ids = [];
    for (const folder of folder_urls) {
        const response = await fetch_worker.fetchOk(folder, { method: 'HEAD', ...init });
        const folder_id = stash_regex.exec(response.url)?.[2];
        if (folder_id) {
            folder_ids.push(parseInt(folder_id, 36));
        }
    }
    const stash_blobs = {};
    if (folder_ids.length > 0) {
        const zip_worker = new ZipWorker();
        for (const [i, folder_id] of enumerate(folder_ids)) {
            const zip_url = `https://sta.sh/zip/2${folder_id.toString(36)}`;
            progress.onOf('Getting stash folder', i + 1, folder_ids.length);
            const response = await fetch_worker.fetchOk(zip_url, init);
            const zip_object = await zip_worker.parseZip(response.body);
            for (const [file, data] of Object.entries(zip_object)) {
                const submission_id_36 = /d(\w+?)-/.exec(file.split('/').pop() ?? '')?.[1];
                if (!submission_id_36) {
                    continue;
                }
                const submission_id = `${parseInt(submission_id_36, 36)}`;
                stash_blobs[submission_id] = new Blob([data]);
            }
        }
        zip_worker.terminate();
    }
    const stash_folder_url = 'https://www.deviantart.com/_puppy/v1/studio/pages/stash';
    while (folder_ids.length > 0) {
        const new_folder_ids = [];
        for (const folder_id of folder_ids) {
            const params = new URLSearchParams({
                init: 'false',
                folderid: `${folder_id}`,
                csrf_token,
            });
            const response = await fetch_worker.fetchOk(`${stash_folder_url}?${params}`, init);
            let obj = await response.json();
            new_folder_ids.push(...obj.subfolders.results.map((f) => f.folderId));
            stash_ids.push(...obj.deviations.studioResults.map((s) => s.deviation.stashPrivateid));
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
                const response = await fetch_worker.fetchOk(`${stash_folder_url}?${params}`, init);
                obj = await response.json();
                stash_ids.push(...obj.deviations.studioResults.deviation.map((f) => f.stashPrivateid));
            }
        }
        folder_ids = new_folder_ids;
    }
    fetch_worker.terminate();
    return {
        blobs: stash_blobs,
        stash_ids: [...new Set(stash_ids)].sort(),
    };
}
//---------------------------------------------------------------------------------------------------------------------
// download helper functions
//---------------------------------------------------------------------------------------------------------------------
async function compareUrls(url) {
    // old larger url link; no longer works
    // `https://${u[2]}/intermediary/f/${u[4]}/${u[5]}/v1/fill/w_5100,h_5100,q_100,bl/${u[9].split('?token=')[0]}`
    // possible new larger link
    const u = url.split('/');
    const new_url = `https://${u[2]}/intermediary/f/${u[4]}/${u[5]}`;
    const new_image = await getImageInfo(new_url);
    if (new_image.resolution === 0) {
        return url;
    }
    const original_image = await getImageInfo(url);
    if (original_image.resolution < new_image.resolution) {
        return new_url;
    }
    return url;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getImageInfo(src) {
    const result = await Promise.all([imgSize(src), imgDim(src)]);
    return {
        url: src,
        file_size: result[0],
        resolution: result[1],
    };
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function imgSize(src) {
    const response = await fetch(src);
    return response.ok ? parseInt(response.headers.get('content-length') ?? '0', 10) : 0;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function imgDim(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.addEventListener('load', function () {
            resolve(this.width * this.height);
        });
        img.addEventListener('error', () => resolve(0));
        img.src = src;
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function deviantartFileName(title, user_id, submission_id) {
    const id36 = parseInt(submission_id, 10).toString(36);
    const title_lower = title.replace(/[\s\W]/g, '_').toLowerCase();
    return `${title_lower}_by_${user_id}_d${id36}`;
}
//---------------------------------------------------------------------------------------------------------------------
// literature conversion
//---------------------------------------------------------------------------------------------------------------------
async function getLiterature(type, obj, meta, options, progress) {
    progress.message('Getting literature');
    const url = obj.deviation.url;
    const response = await fetchOk(url, { credentials: 'include' });
    const dom = await response.dom();
    const story_element = dom.querySelector('section .da-editor-journal > div > div > div, section > div > .legacy-journal, section > span + div > div[data-editor-viewer]');
    if (!story_element) {
        throw new Error('Story element not found');
    }
    let story = cleanContent(story_element);
    story.id = 'content';
    const decription_element = dom.querySelector('#description > div > div, [role=complementary] + div .legacy-journal, main > div > div > div:only-child > div:not([class]) > div');
    let description = decription_element ? cleanContent(decription_element) : document.createElement('section');
    description.id = 'description';
    const story_text = getElementText(story);
    const word_count = wordCount(story_text);
    let template;
    let story_content;
    let description_content;
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
        // make sure images in the story are all full quality
        story = await upgradeContentImages(story, options.embedImages);
        description = await upgradeContentImages(description, options.embedImages);
        template = options.literatureHTML;
        story_content = story.outerHTML;
        description_content = description.outerHTML;
    }
    else {
        template = options.literatureText;
        story_content = story_text;
        description_content = getElementText(description);
    }
    const story_meta = {
        story: story_content,
        description: description_content,
        wordCount: `${word_count}`,
        url,
        ...meta,
    };
    const file_text = renderTemplate(template, type, story_meta);
    return new Blob([file_text], { type: `text/${type}` });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getImageIcon(url) {
    const params = new URLSearchParams({
        url,
        format: 'json',
    });
    const response = await fetchWorkerOk(`https://backend.deviantart.com/oembed?${params}`);
    const oembed = await response.json();
    return oembed.fullsize_url;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function cleanContent(element) {
    // simplify thumbnail journal links
    element.querySelectorAll('a.lit').forEach((a) => a.replaceChildren(a.href));
    element = DOMPurify.sanitize(element, {
        IN_PLACE: true,
        FORBID_TAGS: ['style'],
        FORBID_ATTR: ['id', 'class', 'style', 'srcset'],
        ALLOW_DATA_ATTR: false,
    });
    // remove unnecessary div and span elements
    for (const elem of element.querySelectorAll('div, span')) {
        if (elem.attributes.length <= 0) {
            elem.before(...elem.childNodes);
            elem.parentElement?.removeChild(elem);
        }
    }
    // deviantart treats paragraphs like line breaks
    // combine paragraphs
    if (element.matches('.da-editor-journal div') && element.firstElementChild) {
        let child = element.firstElementChild;
        while (child.nextElementSibling) {
            let next = child.nextElementSibling;
            if (child.nodeName === 'P' && next.nodeName === 'P') {
                child.append(document.createElement('br'), ...next.childNodes);
                next.parentElement?.removeChild(next);
            }
            else {
                child = child.nextElementSibling;
            }
        }
    }
    element.normalize();
    elementClean(element);
    // remove double spacing
    for (const elem of element.querySelectorAll('p + br + p, p + br + br')) {
        const spacer = elem.previousElementSibling;
        spacer?.parentElement?.removeChild(spacer);
    }
    // remove empty paragraphs
    for (const elem of element.querySelectorAll('p')) {
        if (!elem.firstChild) {
            elem.parentElement?.removeChild(elem);
        }
    }
    return element;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function elementClean(element) {
    // split text nodes into paragraphs
    const block_node_names = [
        'ADDRESS',
        'ARTICLE',
        'ASIDE',
        'BLOCKQUOTE',
        'DETAILS',
        'DIV',
        'DL',
        'FIELDSET',
        'FIGCAPTION',
        'FIGURE',
        'FOOTER',
        'FORM',
        'H1',
        'H2',
        'H3',
        'H4',
        'H5',
        'H6',
        'HEADER',
        'HGROUP',
        'HR',
        'MAIN',
        'MENU',
        'NAV',
        'OL',
        'P',
        'PRE',
        'SEARCH',
        'SECTION',
        'TABLE',
        'UL',
    ];
    let child = element.firstChild;
    const div = document.createElement('div');
    let p = document.createElement('p');
    let addP = () => {
        while (p.lastChild?.nodeName === 'BR') {
            p.removeChild(p.lastChild);
        }
        if (p.hasChildNodes()) {
            div.append(p);
            p = document.createElement('p');
        }
    };
    while (child) {
        const type = child.nodeName;
        const next = child.nextSibling;
        if (!p.hasChildNodes() && type === 'BR') {
            child = next;
            continue;
        }
        let has_breaks = child.querySelector?.('br');
        if (block_node_names.includes(type) || has_breaks) {
            addP();
            if (child.nodeName === 'P') {
                div.append(...elementClean(child).childNodes);
            }
            else if (has_breaks) {
                div.append(elementClean(child));
            }
            else {
                div.append(child);
            }
            child = next;
            continue;
        }
        p.append(child);
        if (p.lastChild?.nodeName === 'BR' && p.lastChild?.previousSibling?.nodeName === 'BR') {
            addP();
        }
        child = next;
    }
    addP();
    element.replaceChildren(...div.childNodes);
    return element;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function upgradeContentImages(content, embed) {
    for (const img of content.querySelectorAll('img')) {
        let url = img.src;
        const reg = /.+\w{12}\.\w+/.exec(url);
        if (/token=/.test(url)) {
            url = url.replace(/q_\d+/, 'q_100').replace('.jpg?', '.png?');
        }
        else if (reg) {
            url = reg[0];
        }
        // convert images to data urls
        img.src = embed ? await urlToDataUrl(url) : url;
    }
    return content;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function urlToDataUrl(url) {
    const response = await fetchWorkerOk(url);
    return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.addEventListener('load', function (data) {
            resolve(data.target?.result);
        });
        reader.readAsDataURL(response.body);
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getElementText(element) {
    element = element.cloneNode(true);
    element.querySelectorAll('li').forEach((li) => li.prepend('  ●  '));
    for (const a of element.querySelectorAll('a')) {
        a.href = a.href.replace(/https?:\/\/www\.deviantart\.com\/users\/outgoing\?/g, '');
        a.textContent = a.href;
    }
    const renderer = document.createElement('div');
    renderer?.classList.add('artsaver-text-render');
    renderer.append(...element.childNodes);
    document.body.append(renderer);
    let text = renderer.innerText;
    // fix for lists
    text = text.replaceAll('  ●  \n\n', '  ●  ');
    renderer.parentElement?.removeChild(renderer);
    return text;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function wordCount(text) {
    // https://www.regular-expressions.info/unicode.html#category
    return text.replace(/[^\p{L}\s]+/gu, '').match(/\p{L}+/gu)?.length ?? 0;
}
