"use strict";
//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------
var G_site_info = bluesky_info;
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var getPageInfo = async function () {
    const url = window.location.href;
    const path_components = pathComponents();
    const page = path_components[0] ?? bluesky_info.site;
    let has_user = false;
    let user;
    if (['profile'].includes(page)) {
        has_user = true;
        user = path_components[1];
    }
    if (has_user && typeof user === 'undefined') {
        throw new Error(`User not found for page '${page}'`);
    }
    const info = { site: bluesky_info.site, url, page, user };
    return info;
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getLocalStorage() {
    const storage = localStorage.getItem('BSKY_STORAGE');
    if (!storage) {
        throw new Error('Bluesky localStorage not found');
    }
    return JSON.parse(storage);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function pdsUrl() {
    const storage = getLocalStorage();
    const url = storage?.session?.currentAccount?.pdsUrl;
    if (!url) {
        throw new Error('pdsURL not found in localStorage');
    }
    return url;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function accessJwt() {
    const storage = getLocalStorage();
    const jwt = storage?.session?.currentAccount?.accessJwt;
    if (!jwt) {
        throw new Error('accessJwt not found in localStorage');
    }
    return jwt;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getHandleDid(user) {
    const params = new URLSearchParams({
        handle: user,
    });
    const headers = {
        authorization: `Bearer ${accessJwt()}`,
    };
    const init = {
        headers,
    };
    const response = await fetchOk(`${pdsUrl()}xrpc/com.atproto.identity.resolveHandle?${params}`, init);
    const obj = await parseJSON(response);
    return obj.did;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var getUserInfo = async function (user) {
    const did = await getHandleDid(user);
    const params = new URLSearchParams({
        actor: did,
    });
    const headers = {
        authorization: `Bearer ${accessJwt()}`,
    };
    const init = {
        headers,
    };
    const response = await fetchOk(`${pdsUrl()}xrpc/app.bsky.actor.getProfile?${params}`, init);
    const obj = await parseJSON(response);
    const name = obj.displayName;
    const user_id = obj.handle;
    const icon_url = obj.avatar;
    const fetch_worker = new FetchWorker();
    const icon_blob = await fetch_worker.fetchOk(icon_url, init);
    fetch_worker.terminate();
    const icon = await browser.runtime.sendMessage({
        action: 'background_create_object_url',
        blob: icon_blob,
    });
    const stats = new Map();
    stats.set('Posts', obj.postsCount);
    stats.set('Followers', obj.followersCount);
    const folder_meta = {
        site: bluesky_info.site,
        userId: user_id,
        userName: name,
        userDid: did,
    };
    const options = await getOptionsStorage(bluesky_info.site);
    const info = {
        site: bluesky_info.site,
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
    const throttler = new FunctionThrottler(checkBluesky);
    const observer = new MutationObserver(() => {
        throttler.run();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    throttler.run();
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function checkBluesky() {
    checkBlueskyPage();
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkBlueskyPage() {
    const media_selector = '[data-expoimage], [aria-label="Embedded video player"], video[src^="https://t.gifs.bsky.app/"]';
    for (const item of document.querySelectorAll('[data-testid^="feedItem"], [data-testid^="postThreadItem"]')) {
        const media = item.querySelector(media_selector);
        if (media && !media.matches('[aria-label^="Post by"] div')) {
            checkBlueskyThumbnail(item);
        }
    }
    for (const quote of document.querySelectorAll('[aria-label^="Post by"][role="link"]')) {
        const media = quote.querySelector(media_selector);
        if (media) {
            checkBlueskyThumbnail(quote);
        }
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkBlueskyThumbnail(element) {
    const media_box = 
    // image
    element.querySelector(':scope div[style*="padding-bottom: 4px;"] > div:not([style]) > div[style]') ??
        element.querySelector(':scope > div > div > div[style] > div:not([style]) > div[style]') ??
        // gif
        element.querySelector(':scope > div:not([style]) > div[style*="margin-top: 8px;"]') ??
        // quote video
        element.querySelector(':scope > div:not([style]) > div[style*="width: 100%;"][style*="margin-top: 4px;"]') ??
        // media with quote
        element.querySelector(':scope div:not([style]) > div:not([style]) > div[style*="margin-top: 8px;"]');
    if (!media_box) {
        G_check_log.log('Post media not found for', element);
        return;
    }
    const user = element.getAttribute('data-testid')?.split('-by-', 2)[1] ??
        // quote post
        element.getAttribute('aria-label')?.split(' by ', 2)[1];
    if (!user) {
        G_check_log.log('User not found for', element);
        return;
    }
    let link;
    // Follow button next to main post selector
    if (element.querySelector('button[data-testid="followBtn"]')) {
        link = window.location.href;
    }
    else {
        link = element.querySelector('a[href*="/post/"][data-tooltip]')?.href;
    }
    if (!link) {
        G_check_log.log('Link not found for', element);
        return;
    }
    const regex_result = /\/post\/([2-7a-z]+)/.exec(link);
    if (!regex_result) {
        G_check_log.log('Link does not match RegExp for', element);
        return;
    }
    let did;
    const thumb_url = element.querySelector('[data-expoimage] img[src*="/did:plc:"]')?.src ??
        element.querySelector('a[href^="/profile/"] img[src*="/avatar_thumbnail/"]')?.src;
    if (thumb_url) {
        did = thumb_url.split('/')[6];
    }
    if (!did) {
        const thumb_url = element.querySelector('figure > video[poster]')?.poster;
        if (thumb_url) {
            did = decodeURIComponent(thumb_url).split('/')[4];
        }
    }
    if (!did) {
        G_check_log.log('User DID not found for', element);
        return;
    }
    const info = {
        site: bluesky_info.site,
        user: user.toLowerCase(),
        submission: `${regex_result[1]}+${did}`,
    };
    return createButton(info, media_box, true);
}
//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------
var startDownloading = async function (submission, progress) {
    const options = await getOptionsStorage(bluesky_info.site);
    const split = `${submission}`.split('+');
    const params = new URLSearchParams({
        uri: `at://${split[1]}/app.bsky.feed.post/${split[0]}`,
        depth: '0',
    });
    const headers = {
        authorization: `Bearer ${accessJwt()}`,
    };
    const init = {
        headers,
    };
    const response = await fetchOk(`${pdsUrl()}xrpc/app.bsky.feed.getPostThread?${params}`, init);
    const obj = await parseJSON(response);
    const { info, meta } = getBlueskySubmissionData(submission, obj);
    const file_datas = getBlueskyFileDatas(obj);
    const downloads = createBlueskyDownloads(meta, file_datas, options);
    return await downloadSubmission(info, downloads, init, progress);
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getBlueskySubmissionData(submission, obj) {
    const split = `${submission}`.split('+', 2);
    const user_name = obj.thread.post.author.displayName;
    const user_id = obj.thread.post.author.handle;
    const date_time = timeParse(obj.thread.post.record.createdAt);
    const meta = {
        site: bluesky_info.site,
        userId: user_id,
        userName: user_name,
        userDid: split[1],
        submissionId: split[0],
        ...date_time,
    };
    const info = {
        site: bluesky_info.site,
        user: user_id.toLowerCase(),
        submission,
    };
    return { info, meta };
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getBlueskyFileDatas(obj) {
    const file_datas = [];
    let media = obj.thread.post.record.embed;
    if ('media' in media) {
        media = media.media;
    }
    const addMedia = function (media_obj) {
        const cid = media_obj.ref?.$link ?? media_obj.cid;
        if (!cid) {
            throw new Error('Could not find media CID');
        }
        let ext = media_obj.mimeType.split('/').pop();
        if (ext == 'jpeg') {
            ext = 'jpg';
        }
        const meta = {
            fileName: cid,
            ext,
        };
        const params = new URLSearchParams({
            did: obj.thread.post.author.did,
            cid,
        });
        const url = `https://bsky.social/xrpc/com.atproto.sync.getBlob?${params}`;
        const info = {
            download: url,
        };
        file_datas.push({ info, meta });
    };
    if ('images' in media) {
        for (const image of media.images) {
            addMedia(image.image);
        }
    }
    if ('video' in media) {
        addMedia(media.video);
    }
    if ('external' in media) {
        const uri = media.external.uri;
        const file_regex = /(.+)\.(\w+)$/.exec(pathComponents(uri).pop() ?? '');
        if (!file_regex) {
            throw new Error('File name not found in external link');
        }
        const meta = {
            fileName: file_regex[1],
            ext: file_regex[2],
        };
        const info = {
            download: uri,
        };
        file_datas.push({ info, meta });
    }
    return file_datas;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function createBlueskyDownloads(submission_meta, file_datas, options) {
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
