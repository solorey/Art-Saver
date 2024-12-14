"use strict";
//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------
var G_site_info = inkbunny_info;
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var getPageInfo = async function () {
    const url = window.location.href;
    const path_components = pathComponents();
    const search = window.location.search;
    let page = inkbunny_info.site;
    let has_user = false;
    let user;
    if (!path_components[1] && document.title?.split(' |')[0].endsWith('< Profile')) {
        page = 'user';
        has_user = true;
        user = path_components[0];
    }
    if (path_components[0] === 's') {
        page = 'submission';
        has_user = true;
        user = document.querySelector('[href*="/gallery/"], [href*="/scraps/"]')?.href.split('/')[4];
    }
    else if (path_components[0] === 'j') {
        page = 'journal';
        has_user = true;
        user = path_components[1].split('-')[1];
    }
    else if (path_components[0]) {
        page = path_components[0];
    }
    if (['gallery', 'scraps', 'journals'].includes(page)) {
        has_user = true;
        user = path_components[1];
    }
    else if (['submissionsviewall.php', 'poolslist.php'].includes(page) && /user_id=\d+|artist=\w+/.test(search)) {
        has_user = true;
        user =
            /artist=(\w+?)(?:&|$)/.exec(search)?.[1] ||
                document
                    .querySelector('.weasel a[rel=author], .stoat a[rel=author]')
                    ?.href.split('/')[3];
    }
    user = user?.toLowerCase();
    if (has_user && typeof user === 'undefined') {
        throw new Error(`User not found for page '${page}'`);
    }
    const info = { site: inkbunny_info.site, url, page, user };
    return info;
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var getUserInfo = async function (user) {
    const init = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const response = await fetchOk(`https://inkbunny.net/${user}`, init);
    const dom = await parseDOM(response);
    const name = dom.title.split(' ')[0];
    const user_id = dom.querySelector('a[href*="user_id="]')?.href.split('=').pop();
    if (!user_id) {
        throw new Error('User ID not found');
    }
    const icon = dom.querySelector(`img[alt="${name}"]`)?.src;
    const stats_values = [...dom.querySelectorAll('.elephant_babdb6 .content > div > span strong')].map((stat) => stat.textContent?.replaceAll(',', '') ?? '');
    const favorites_response = await fetchOk(`https://inkbunny.net/userfavorites_process.php?favs_user_id=${user_id}`);
    const favorites_dom = await parseDOM(favorites_response);
    const favorites = favorites_dom
        .querySelector('.elephant_555753 .content > div:first-child')
        ?.textContent?.split(' ')[0]
        .replaceAll(',', '');
    const stats = new Map();
    stats.set('Submissions', stats_values[1]);
    stats.set('Favorites', favorites);
    stats.set('Views', stats_values[4]);
    const folder_meta = {
        site: inkbunny_info.site,
        userId: user_id,
        userName: name,
    };
    const options = await getOptionsStorage(inkbunny_info.site);
    const info = {
        site: inkbunny_info.site,
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
    await checkInkbunny();
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function checkInkbunny() {
    const page = await getPageInfo();
    if (page.page === 'submission' && page.user) {
        checkInkbunnySubmissionPage(page.url, page.user);
    }
    checkInkbunnyPage(page.user);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkInkbunnyPage(page_user) {
    let widgets = [...document.querySelectorAll('.widget_imageFromSubmission')];
    // filter thumbnails that are submission page previews
    for (const parent of document.querySelectorAll('#files_area, .content.magicboxParent')) {
        widgets = widgets.filter((w) => !parent.parentElement?.contains(w));
    }
    for (const widget of widgets) {
        checkInkbunnyThumbnail(widget, page_user);
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkInkbunnyThumbnail(element, page_user) {
    const link = element.querySelector('a');
    if (!link) {
        G_check_log.log('Link not found for', element);
        return;
    }
    const submission_id = /\/(\d+)$/.exec(link.href)?.[1];
    if (!submission_id) {
        G_check_log.log('Submission not found for', element);
        return;
    }
    const submission = parseInt(submission_id, 10);
    const img_alt = element.querySelector('img')?.alt ?? '';
    const user = /\sby\s(\w+)(?:$|(?:\s-\s))/.exec(img_alt)?.[1]?.toLowerCase() ?? page_user;
    if (!user) {
        G_check_log.log('User not found for', element);
        return;
    }
    // links are inline and don't match size of thumbnail
    // start at links parent instead
    let parent = link.parentElement;
    if (!parent) {
        return;
    }
    parent = navigateUpSmaller(parent);
    return createButton(inkbunny_info.site, user, submission, parent, true);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkInkbunnySubmissionPage(url, user) {
    const content_box = document.querySelector('.content.magicboxParent');
    if (!content_box) {
        return;
    }
    const media = content_box.querySelector('#magicbox, .widget_imageFromSubmission img, #mediaspace');
    if (!media) {
        return;
    }
    const submission_id = /\/s\/(\d+)/.exec(url)?.[1];
    if (!submission_id) {
        return;
    }
    const submission = parseInt(submission_id, 10);
    if (media.matches('img')) {
        media.style.display = 'block';
    }
    const parent = media.parentElement;
    if (!parent) {
        return;
    }
    if (parent.matches('a')) {
        parent.style.display = 'inline-block';
    }
    createButton(inkbunny_info.site, user, submission, parent, false);
}
//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------
var startDownloading = async function (submission, progress) {
    progress.say('Getting submission');
    const options = await getOptionsStorage(inkbunny_info.site);
    const init = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const response = await fetchOk(`https://inkbunny.net/s/${submission}`, init);
    const dom = await parseDOM(response);
    const { info, meta } = getInkbunnySubmissionData(submission, dom);
    const file_datas = await getInkbunnyFileDatas(dom, meta, progress);
    const downloads = createInkbunnyDownloads(meta, file_datas, options);
    const download_ids = await handleDownloads(downloads, init, progress);
    progress.say('Updating');
    await sendAddSubmission(info.site, info.user, info.submission);
    const files = downloads.map((download, i) => ({ path: download.path, id: download_ids[i] }));
    const result = {
        user: info.user,
        title: meta.title,
        files,
    };
    return result;
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getInkbunnySubmissionData(submission, dom) {
    const title_element = dom.querySelector('#pictop h1');
    if (!title_element) {
        throw new Error('Title element not found');
    }
    const title = title_element.textContent ?? '';
    const user_name = dom
        .querySelector('[href*="/gallery/"], [href*="/scraps/"]')
        ?.href.split('/')[4];
    if (!user_name) {
        throw new Error('User name not found');
    }
    const user_id = dom.querySelector('a[href*="user_id"]')?.href.split('=').pop() ?? '';
    const date_text = dom.querySelector('#submittime_exact')?.textContent;
    if (!date_text) {
        throw new Error('Date not found');
    }
    const date_time = timeParse(date_text);
    const meta = {
        site: inkbunny_info.site,
        userId: user_id,
        userName: user_name,
        submissionId: `${submission}`,
        title,
        ...date_time,
    };
    const info = {
        site: inkbunny_info.site,
        user: user_name.toLowerCase(),
        submission,
    };
    return { info, meta };
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getInkbunnyFileDatas(dom, submission_meta, progress) {
    const files_count = dom.querySelector('#files_area span')?.textContent?.split(' ')[2];
    const pages = files_count ? parseInt(files_count, 10) : 1;
    const init = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const files = [];
    for (let i = 1; i <= pages; i++) {
        let page_dom;
        if (i === 1) {
            page_dom = dom;
        }
        else {
            progress.onOf('Getting page', i, pages);
            let response;
            while (true) {
                try {
                    response = await fetchOk(`https://inkbunny.net/s/${submission_meta.submissionId}-p${i}`, init);
                    break;
                }
                catch (error) {
                    await timer(4);
                }
            }
            page_dom = await parseDOM(response);
        }
        files.push(getInkbunnyFileData(page_dom));
    }
    return files;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getInkbunnyFileData(dom) {
    const content_box = dom.querySelector('.content.magicboxParent');
    // check if these elements exist in order
    const download_link = content_box?.querySelector('a[download=""]')?.href ??
        content_box?.querySelector('a[href^="https://tx.ib.metapix.net/files/full/"]')?.href ??
        content_box?.querySelector('img[src*=".ib.metapix.net/files/"]')?.src;
    if (!download_link) {
        throw new Error('Download link not found');
    }
    const url = decodeURI(download_link);
    const regex_result = /\/((\d+)_.+)\.(.+)$/.exec(url);
    if (!regex_result) {
        throw new Error('Download link does not match RegExp');
    }
    const meta = {
        fileName: regex_result[1],
        fileId: regex_result[2],
        ext: regex_result[3],
    };
    const info = {
        download: url,
    };
    return { info, meta };
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function createInkbunnyDownloads(submission_meta, file_datas, options) {
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
