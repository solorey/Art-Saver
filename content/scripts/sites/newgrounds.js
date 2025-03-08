"use strict";
//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------
var G_site_info = newgrounds_info;
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var getPageInfo = async function () {
    const url = window.location.href;
    const path_components = pathComponents();
    let page = path_components[0] ?? newgrounds_info.site;
    let has_user = false;
    let user;
    if (['view', 'listen'].includes(path_components[1])) {
        page = 'submission';
        has_user = true;
        user = document.querySelector('.authorlinks h4 a')?.href.split('//')[1].split('.')[0];
    }
    else if (document.querySelector('#user-header')) {
        has_user = true;
        user = document.querySelector('#user-header .user-link')?.href.split('//')[1].split('.')[0];
    }
    if (has_user && typeof user === 'undefined') {
        throw new Error(`User not found for page '${page}'`);
    }
    const info = { site: newgrounds_info.site, url, page, user };
    return info;
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var getUserInfo = async function (user) {
    const init = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const response = await fetchOk(`https://${user}.newgrounds.com/`, init);
    const dom = await response.dom();
    const name = dom.querySelector('.user-header-name a')?.textContent ?? user;
    const icon = dom.querySelector(`meta[name="image"]`)?.content;
    const stats = new Map();
    const tabs = ['art', 'audio', 'games', 'movies', 'fans', 'favorites'];
    for (const tab of tabs) {
        const element = dom.querySelector(`.user-header-button[href="/${tab}"]`);
        if (element) {
            const label = element.querySelector('span')?.textContent;
            const value = element.querySelector('strong')?.textContent;
            if (label && value) {
                stats.set(label[0].toUpperCase() + label.slice(1).toLowerCase(), value);
            }
        }
    }
    const folder_meta = {
        site: newgrounds_info.site,
        userId: user,
        userName: name,
    };
    const options = await getOptionsStorage(newgrounds_info.site);
    const info = {
        site: newgrounds_info.site,
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
    const throttler = new FunctionThrottler(checkNewgrounds);
    const observer = new MutationObserver(() => {
        throttler.run();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    throttler.run();
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
function checkNewgroundsPage(page_user) {
    for (const art_thumb of document.querySelectorAll('[class*="item-portalitem-art"], .portalitem-footer-feature.art')) {
        checkNewgroundsArtThumbnail(art_thumb);
    }
    const userless_section_selector = ':is(#pod_type_8, #pod_type_9, #pod_type_12, #pod_type_13, #favorites_list, #footer-featured-items) *';
    for (const portal_thumb of document.querySelectorAll('[class*="item-portalsubmission"], .portalsubmission-cell, .portalsubmission-footer-feature.game')) {
        checkNewgroundsPortalThumbnail(portal_thumb, portal_thumb.matches(userless_section_selector) ? undefined : page_user);
    }
    for (const audio_thumb of document.querySelectorAll('.audio-wrapper')) {
        checkNewgroundsAudioThumbnail(audio_thumb, audio_thumb.matches(userless_section_selector) ? undefined : page_user);
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkNewgroundsArtThumbnail(element) {
    const href = element.href;
    if (!href) {
        G_check_log.log('Link not found for', element);
        return;
    }
    const submission = newgroundsUrlToSubmission(href);
    if (!submission) {
        G_check_log.log('Submission not found for', element);
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
function checkNewgroundsPortalThumbnail(element, page_user) {
    const href = element.href ??
        element.querySelector('a[href*="/portal/view/"]')?.href;
    if (!href) {
        G_check_log.log('Link not found for', element);
        return;
    }
    const submission = newgroundsUrlToSubmission(href);
    if (!submission) {
        G_check_log.log('Submission not found for', element);
        return;
    }
    const user = element.querySelector('.item-details > span:nth-of-type(2)')?.textContent ??
        element.querySelector('.detail-title > span > strong')?.textContent ??
        element.querySelector('.card-title > span')?.textContent?.split(' ')[1] ??
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
function checkNewgroundsAudioThumbnail(element, page_user) {
    const href = element.querySelector('a[href*="/audio/listen/"]')?.href;
    if (!href) {
        G_check_log.log('Link not found for', element);
        return;
    }
    const submission = newgroundsUrlToSubmission(href);
    if (!submission) {
        G_check_log.log('Submission not found for', element);
        return;
    }
    const user = element.querySelector('.item-author')?.href.split('//')[1].split('.')[0] ??
        element.querySelector('.detail-title > span > strong')?.textContent ??
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
function newgroundsUrlToSubmission(url) {
    const comps = pathComponents(url);
    switch (comps[0]) {
        case 'portal':
        case 'audio':
            return `${comps[0]};${comps[2]}`;
        case 'art':
            return `${comps[0]};${comps[2]};${comps[3]}`;
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkNewgroundsSubmissionPage(url, user) {
    const content = document.querySelector('[itemscope] > .pod-body > .image') ??
        document.querySelector('#embed_podcontent') ??
        document.querySelector('#ng-global-video-player[style]');
    if (!content) {
        return;
    }
    content.style.setProperty('--as-z-index', '101');
    const submission = newgroundsUrlToSubmission(url);
    if (!submission) {
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
var startDownloading = async function (submission, progress) {
    const options = await getOptionsStorage(newgrounds_info.site);
    const init = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const url = newgrounds_info.links.submission(submission);
    const response = await fetchOk(url, init);
    const dom = await response.dom();
    const { info, meta } = getNewgroundsSubmissionData(submission, dom);
    let downloads;
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
function getNewgroundsProjectType(dom) {
    const type_id = dom.querySelector('[data-statistics]')?.getAttribute('data-statistics')?.split('_')[1];
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
function getNewgroundsSubmissionData(submission, dom) {
    const user_link = dom.querySelector('.authorlinks h4 a');
    const user_id = user_link?.href.split('//')[1].split('.')[0];
    if (!user_id) {
        throw new Error('User ID not found');
    }
    const user_name = user_link?.textContent;
    if (!user_name) {
        throw new Error('User name not found');
    }
    const title = dom.querySelector('[itemprop="name"]')?.textContent;
    if (!title) {
        throw new Error('Title not found');
    }
    const date_string = dom.querySelector('[itemprop="datePublished"]')?.content;
    if (!date_string) {
        throw new Error('Date not found');
    }
    const submission_id = dom
        .querySelector('[data-statistics]')
        ?.getAttribute('data-statistics')
        ?.split('_')[0];
    if (!submission_id) {
        throw new Error('Submission ID not found');
    }
    const meta = {
        site: newgrounds_info.site,
        userId: user_id,
        userName: user_name,
        submissionId: submission_id,
        title,
        ...timeParse(date_string),
    };
    const info = {
        site: newgrounds_info.site,
        user: user_id,
        submission,
    };
    return { info, meta };
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getNewgroundsArtFileDatas(dom) {
    const file_datas = [];
    const script_text = dom.querySelector('[id^="art-gallery-"] + script')?.textContent;
    const image_data = /\s+imageData\s*=\s*(\[(?:.|\n)+?\]);/.exec(script_text ?? '')?.[1];
    if (image_data) {
        const images = JSON.parse(image_data);
        for (const image of images) {
            file_datas.push(urlFileData(image.image));
        }
    }
    else {
        for (const image_link of dom.querySelectorAll('.image a[href^="https://art.ngfiles.com/images/"]')) {
            file_datas.push(urlFileData(image_link.href));
        }
    }
    // images in author comments
    for (const img of dom.querySelectorAll('#author_comments img')) {
        file_datas.push(urlFileData(img.src));
    }
    const formats = ['png', 'jpg', 'gif'];
    const fetch_worker = new FetchWorker();
    for (const data of file_datas) {
        if (data.meta.ext === 'webp') {
            for (const format of formats) {
                const url = data.info.download.replace('.webp', `.${format}`);
                if (await testOk(fetch_worker, url)) {
                    data.meta.ext = format;
                    data.info.download = url;
                    break;
                }
            }
        }
    }
    fetch_worker.terminate();
    return file_datas;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getNewgroundsAudioFileData(dom) {
    const script_text = dom.querySelector('#audio_player_embed ~ script:nth-of-type(3)')
        ?.textContent;
    const audio_data = /\snew\sembedController\(\[{"url":(".+?")/.exec(script_text ?? '')?.[1];
    if (!audio_data) {
        throw new Error('Audio data not found');
    }
    const url = JSON.parse(audio_data);
    return urlFileData(url);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getNewgroundsMovieFileData(dom, submission_meta) {
    if (!dom.querySelector('#viewing_option_video')) {
        const script_text = dom.querySelector('#submission_url + script + script:not([src])')
            ?.textContent;
        const swf_data = /\snew\sembedController\(\[{"url":(".+?")/.exec(script_text ?? '')?.[1];
        if (swf_data) {
            const url = JSON.parse(swf_data);
            return urlFileData(url);
        }
    }
    const init = {
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
        },
    };
    const response = await fetchOk(`https://www.newgrounds.com/portal/video/${submission_meta.submissionId}`, init);
    const obj = await response.json();
    const src = obj.sources['360p'][0].src;
    const base_src = src.split('.360p.mp4')[0];
    const formats = ['mp4', 'webm', 'm4v', 'mov', 'mkv', 'wmv', '1080p.mp4', '720p.mp4', '360p.mp4'];
    const fetch_worker = new FetchWorker();
    for (const format of formats) {
        const url = `${base_src}.${format}`;
        if (await testOk(fetch_worker, url)) {
            fetch_worker.terminate();
            return urlFileData(url);
        }
    }
    fetch_worker.terminate();
    throw new Error('Movie file not found');
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getNewgroundsGameData(dom, url) {
    const game_datas = [];
    const banner_url = dom.querySelector('[itemprop="thumbnailUrl"]')?.content;
    if (banner_url) {
        const regex_result = /\/[^\/]+\.([^\/]+?)(?:\?|#|$)/.exec(banner_url);
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
async function testOk(worker, url) {
    try {
        await worker.fetchOk(url, { method: 'HEAD' });
        return true;
    }
    catch (error) {
        return false;
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function urlFileData(url) {
    const regex_result = /\/([^\/]+)\.([^\/]+?)(?:\?|#|$)/.exec(url);
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
function createNewgroundsArtDownloads(submission_meta, file_datas, options) {
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
                path: renderPath(options.fileArtMultiple, meta),
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
            path: renderPath(options.fileArt, meta),
        });
    }
    return downloads;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function createNewgroundsAudioDownload(submission_meta, file_data, options) {
    const meta = {
        ...submission_meta,
        ...file_data.meta,
    };
    return {
        ...file_data.info,
        path: renderPath(options.fileAudio, meta),
    };
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function createNewgroundsMovieDownload(submission_meta, file_data, options) {
    const meta = {
        ...submission_meta,
        ...file_data.meta,
    };
    return {
        ...file_data.info,
        path: renderPath(options.fileMovie, meta),
    };
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function createNewgroundsGameDownloads(submission_meta, game_datas, options) {
    const downloads = [];
    let path = renderPath(options.gameFolder, submission_meta);
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
