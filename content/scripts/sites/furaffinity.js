"use strict";
//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------
var G_site_info = furaffinity_info;
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var getPageInfo = async function () {
    const url = window.location.href;
    const path_components = pathComponents();
    const page = path_components[0] ?? furaffinity_info.site;
    let has_user = false;
    let user;
    if (['user', 'journals', 'gallery', 'scraps', 'favorites', 'commissions'].includes(page)) {
        has_user = true;
        user = path_components[1];
    }
    else if (['view', 'full', 'journal'].includes(page)) {
        has_user = true;
        user = document.querySelector('[href*="/gallery/"], [href*="/scraps/"]')?.href.split('/')[4];
    }
    user = user?.toLowerCase();
    if (has_user && typeof user === 'undefined') {
        throw new Error(`User not found for page '${page}'`);
    }
    const info = { site: furaffinity_info.site, url, page, user };
    return info;
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function isFuraffinityModernLayout(dom) {
    return Boolean((dom ?? document).querySelector('#ddmenu'));
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var getUserInfo = async function (user) {
    const init = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const response = await fetchOk(`https://www.furaffinity.net/user/${user}/`, init);
    const dom = await parseDOM(response);
    const is_modern_layout = isFuraffinityModernLayout(dom);
    const title = dom.querySelector('title')?.textContent ?? '';
    const title_regex_result = /of\s(.+?)\s--\sFur\s/.exec(title);
    let name;
    if (!title_regex_result) {
        const redirect = dom.querySelector('.redirect-message')?.textContent ?? '';
        const redirect_regex_result = /User\s"(.+?)"\s/.exec(redirect);
        if (!redirect_regex_result) {
            throw new Error(`User page for '${user}' unavailable`);
        }
        name = redirect_regex_result[1];
    }
    else {
        name = title_regex_result[1];
    }
    const icon_element = dom.querySelector(`img[alt="${user}"]`);
    const icon = icon_element?.src;
    const stats_element = dom.querySelector(is_modern_layout ? 'div[class^="userpage-section-"] .cell' : 'td.ldot td[align="left"]');
    const stats = new Map();
    if (stats_element) {
        const stats_text = stats_element.textContent ?? '';
        const values = stats_text.replace(/\D+/g, ' ').trim().split(' ');
        if (is_modern_layout) {
            stats.set('Submissions', values[1]);
            stats.set('Favs', values[2]);
            stats.set('Views', values[0]);
        }
        else {
            stats.set('Submissions', values[1]);
            stats.set('Favorites', values[5]);
            stats.set('Page Visits', values[0]);
        }
    }
    const folder_meta = {
        site: furaffinity_info.site,
        userId: user,
        userName: name,
    };
    const options = await getOptionsStorage(furaffinity_info.site);
    const info = {
        site: furaffinity_info.site,
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
    const throttler = new FunctionThrottler(checkFuraffinity);
    const observer = new MutationObserver(() => {
        throttler.run();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    throttler.run();
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function checkFuraffinity() {
    const page = await getPageInfo();
    if (['view', 'full'].includes(page.page) && page.user) {
        checkFuraffinitySubmissionPage(page.url, page.user);
    }
    else if (page.page === 'user') {
        checkFuraffinityUserFavorites();
    }
    checkFuraffinityPage(page.user);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkFuraffinityPage(page_user) {
    const is_modern_layout = isFuraffinityModernLayout();
    const gallery_thumbnails = document.querySelectorAll(':not(#gallery-latest-favorites, [class*="userpage-first-"]) > [id^="sid"]');
    gallery_thumbnails.forEach((e) => checkFuraffinityThumbnail(e, page_user));
    if (is_modern_layout) {
        const view_preview_thumbnails = document.querySelectorAll('.preview-gallery-container');
        view_preview_thumbnails.forEach((e) => checkFuraffinityThumbnail(e, page_user));
        const profile_submission = document.querySelector('.section-submission > a');
        if (profile_submission) {
            profile_submission.style.display = 'inline-block';
            const parent = profile_submission.parentElement;
            if (parent) {
                checkFuraffinityThumbnail(parent, page_user);
            }
        }
    }
    // user page preview sections
    const section_bodies = document.querySelectorAll(is_modern_layout ? '.section-body' : '[class*="userpage-first-"]');
    for (const section_body of section_bodies) {
        const preview_link = section_body.querySelector(is_modern_layout ? '.preview_img > a' : 's > a');
        if (!preview_link) {
            continue;
        }
        preview_link.style.position = 'relative';
        checkFuraffinityThumbnail(section_body, page_user);
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkFuraffinityThumbnail(element, page_user) {
    const link = element.querySelector('a[href*="/view/"]');
    if (!link) {
        G_check_log.log('Link not found for', element);
        return;
    }
    const submission = parseInt(link.href.split('/')[4], 10);
    const user_link = element.querySelector('a[href*="/user/"]');
    const user = user_link?.href.split('/')[4] ?? page_user;
    if (!user) {
        G_check_log.log('User not found for', element);
        return;
    }
    const parent = navigateUpSmaller(link);
    const info = {
        site: furaffinity_info.site,
        user,
        submission,
    };
    return createButton(info, parent, true);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkFuraffinityUserFavorites() {
    const favorite_data = window.wrappedJSObject.submission_data;
    if (!favorite_data) {
        return;
    }
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
        createButton(info, parent, true);
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkFuraffinitySubmissionPage(url, user) {
    const is_modern_layout = isFuraffinityModernLayout();
    const submission_img = document.querySelector('img#submissionImg');
    if (!submission_img) {
        return;
    }
    const is_story_image = submission_img.classList.contains('imgresizer');
    const wrapper = wrapElement(submission_img);
    if (is_modern_layout && is_story_image) {
        wrapper.style.margin = '10px 0';
        wrapper.style.display = 'inline-block';
        submission_img.style.margin = '0';
    }
    else if (!is_modern_layout) {
        // 99% plus padding and border
        wrapper.style.maxWidth = 'calc(99% + 6px)';
        submission_img.style.maxWidth = '100%';
        submission_img.style.boxSizing = 'border-box';
    }
    const info = {
        site: furaffinity_info.site,
        user,
        submission: parseInt(url.split('/')[4], 10),
    };
    createButton(info, wrapper, false);
}
//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------
var startDownloading = async function (submission, progress) {
    const options = await getOptionsStorage(furaffinity_info.site);
    const init = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const response = await fetchOk(`https://www.furaffinity.net/view/${submission}`, init);
    const dom = await parseDOM(response);
    const { info, meta } = getFuraffinitySubmissionData(submission, dom);
    const file_data = getFuraffinityFileData(dom);
    const downloads = [createFuraffinityDownload(meta, file_data, options)];
    return await downloadSubmission(info, downloads, init, progress, meta.title);
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getFuraffinitySubmissionData(submission, dom) {
    const user_id = dom.querySelector('[href*="/gallery/"], [href*="/scraps/"]')?.href.split('/')[4];
    if (!user_id) {
        throw new Error('User ID not found');
    }
    const user_name = /([^\s]+)(?:\s--\s)/.exec(dom.querySelector('title')?.textContent ?? '')?.[1];
    if (!user_name) {
        throw new Error('User name not found');
    }
    const download_link = dom.querySelector('a[href*="/art/"]');
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
    const is_modern_layout = isFuraffinityModernLayout(dom);
    const title_element = dom.querySelector(is_modern_layout ? '.submission-title p' : 'div.classic-submission-title > h2');
    if (!title_element) {
        throw new Error('Title element not found');
    }
    const title = title_element.textContent ?? '';
    const meta = {
        site: furaffinity_info.site,
        userId: user_id,
        userName: user_name,
        submissionId: `${submission}`,
        title,
        ...date_time,
    };
    const info = {
        site: furaffinity_info.site,
        user: user_id,
        submission,
    };
    return { info, meta };
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getFuraffinityFileData(dom) {
    const download_link = dom.querySelector('a[href*="/art/"]');
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
    const meta = {
        fileName: regex_result[3],
        fileId: regex_result[4] || regex_result[5] || regex_result[2],
        ext: regex_result[6],
    };
    const info = {
        download: url,
    };
    return { info, meta };
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function createFuraffinityDownload(submission_meta, file_data, options) {
    const meta = { ...submission_meta, ...file_data.meta };
    const download = {
        ...file_data.info,
        path: renderPath(options.file, meta),
    };
    return download;
}
