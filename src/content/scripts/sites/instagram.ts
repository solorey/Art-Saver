//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

var G_site_info: SiteInfo = instagram_info;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var getPageInfo = async () => {
    const url = window.location.href;

    const path_components = pathComponents(url);
    let page: string = path_components[0] ?? instagram_info.site;
    let has_user = false;
    let user: string | undefined;

    if (['p', 'reel', 'reels'].includes(path_components[1])) {
        has_user = true;
        user = path_components[0];
    } else {
        const user_element =
            document.querySelector('[role="dialog"] header span a[href^="/"] span') ?? // dialog user
            document.querySelector<HTMLElement>('a[href="#"] > h2 > span'); // user homepage
        if (user_element) {
            has_user = true;
            user = user_element.textContent.trim();
        }
    }
    user = user?.toLowerCase();

    if (has_user && !user) {
        throw new Error(`User not found for page '${page}'`);
    }

    const info: PageInfo = { site: instagram_info.site, url, page, user };
    return info;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getInstagramUserKey(user: User) {
    const init: RequestInit = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const response = await fetchOk(`https://www.instagram.com/${user}/`, init);
    const text = await response.text();

    const key_regex = /"profile_id":"(\d+)"/.exec(text);
    if (!key_regex) {
        throw new Error('User key not found');
    }

    return key_regex[1];
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var getUserInfo = async (user: User) => {
    const user_key = await getInstagramUserKey(user);
    // Firefox only - wrappedJSObject
    const fb_dtsg: string | undefined = (window as any).wrappedJSObject?.fb_dtsg;
    if (!fb_dtsg) {
        throw new Error('Unable to find fb_dtsg value');
    }
    const params = new URLSearchParams({
        fb_dtsg,
        variables: JSON.stringify({ id: user_key }),
        doc_id: '26672929172408668',
    });
    const init: RequestInit = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
        method: 'POST',
    };
    const response = await fetchOk('https://www.instagram.com/api/graphql', init);
    const obj = await response.json();

    const name = obj.data.user.full_name;
    const user_id = obj.data.user.username;

    const icon = obj.data.user.profile_pic_url;

    const stats = new Map();
    stats.set('Posts', obj.data.user.media_count);
    stats.set('Followers', obj.data.user.follower_count);
    stats.set('Following', obj.data.user.following_count);

    const folder_meta: InstagramUserFolder = {
        site: instagram_info.site,
        userId: user_id,
        userName: name,
    };

    const options = await getOptionsStorage<InstagramOptionsValues>(instagram_info.site);

    const info: UserInfo = {
        site: instagram_info.site,
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
    observeThrottle(checkInstagram);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function checkInstagram() {
    // user gallery posts
    for (const a of document.querySelectorAll<HTMLElement>('a[href*="/reel/"], a[href*="/p/"]')) {
        if (a.querySelector('img, [style*="background-image:"], video')) {
            checkInstagramThumbnail(a);
        }
    }
    // main page posts
    for (const a of document.querySelectorAll<HTMLElement>('main article')) {
        checkInstagramArticle(a);
    }
    const full_page_post = 'main > div:first-child:last-child > div:has(+ div > hr)';
    const full_dialog_post = '[role="dialog"] article';
    const main_post = document.querySelector<HTMLElement>(`${full_page_post}, ${full_dialog_post}`);
    if (main_post) {
        checkInstagramPost(main_post);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkInstagramThumbnail(element: HTMLElement) {
    const href = element.getAttribute('href') ?? '';
    const regex_result = /\/(([^/]+)\/)?(?:p|reel)\/([\w-]+)/.exec(href);
    if (!regex_result) {
        G_check_log.log(element, 'Link does not match RegExp');
        return;
    }
    // posts on search page have no user name
    let user: string | undefined = regex_result[2];
    const submission = regex_result[3];

    element.style.position = 'unset';
    if (!user) {
        // hover preview user
        const user_preview_sel = 'div[data-interactable] > div > div[style*="transform: translate("]';
        const preview_element = document.querySelector(user_preview_sel);
        if (element.matches(`${user_preview_sel} a`) && preview_element) {
            user = preview_element.querySelector('div a span')?.textContent.trim();
            element.style.position = 'relative';
        }
    }
    user = (user ?? '').toLowerCase();

    const info = { site: instagram_info.site, user, submission };
    createButton(info, element);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkInstagramArticle(element: HTMLElement) {
    const href = element.querySelector<HTMLAnchorElement>('a[href*="/p/"]')?.getAttribute('href');
    if (!href) {
        G_check_log.log(element, 'Link not found');
        return;
    }
    const submission = href.split('/')[2];
    const user = element.querySelector('span span span a span')?.textContent.trim().toLowerCase();
    if (!user) {
        G_check_log.log(element, 'User not found');
        return;
    }

    const info = { site: instagram_info.site, user, submission };
    createButton(info, element, { screen: false });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

// main page post
function checkInstagramPost(element: HTMLElement) {
    const href_sel = ':is(a[href*="/p/"], a[href*="/reel/"])';
    const a =
        element.querySelector<HTMLAnchorElement>(`section + div:last-child ${href_sel}`) ?? // full page post
        element.querySelector<HTMLAnchorElement>(`section + div + div:last-child ${href_sel}`) ?? // vertical dialog post
        element.querySelector<HTMLAnchorElement>(`div:has( + section) ${href_sel}`); // full dialog post
    const href = a?.getAttribute('href');
    if (!href) {
        G_check_log.log(element, 'Link not found');
        return;
    }
    const regex_result = /\/([^/]+)\/(?:p|reel)\/([\w-]+)/.exec(href);
    if (!regex_result) {
        G_check_log.log(element, 'Link does not match RegExp');
        return;
    }
    const user = regex_result[1].toLowerCase();
    const submission = regex_result[2];

    let parent = element;
    // dialog media
    const media_element = element.querySelector<HTMLElement>(':scope > div > div[style*="max-width:"]');
    if (media_element) {
        parent = media_element;
    }

    const info = { site: instagram_info.site, user, submission };
    createButton(info, parent, { screen: false });
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------

var startDownloading = async (submission: Submission, progress: ProgressController) => {
    const options = await getOptionsStorage<InstagramOptionsValues>(instagram_info.site);

    const init: RequestInit = {
        credentials: 'include',
        referrer: window.location.href,
        headers: {
            'X-IG-App-ID': '936619743392459',
        },
    };
    const pk = baseDecode(`${submission}`, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_');
    const response = await fetchOk(`https://www.instagram.com/api/v1/media/${pk}/info/`, init);
    const obj = (await response.json()).items[0];

    const { info, meta } = getInstagramSubmissionData(submission, obj);
    const file_datas = getInstagramFileDatas(obj);

    const downloads = createInstagramDownloads(meta, file_datas, options);

    return await downloadSubmission(info, downloads, init, progress);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function baseDecode(encoded_number: string, chars: string) {
    let num = BigInt(0);
    const base = BigInt(chars.length);
    for (const c of encoded_number) {
        num = num * base + BigInt(chars.indexOf(c));
    }
    return `${num}`;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getInstagramSubmissionData(submission: Submission, obj: any) {
    const user_name = obj.user.full_name;
    const user_id = obj.user.username;

    const description = obj.caption.text.trim().replace(/\s+/g, ' ') ?? '';

    const date_time = timeParse(obj.taken_at * 1000);

    const meta: InstagramSubmissionMeta = {
        description,
        site: instagram_info.site,
        userId: user_id,
        userName: user_name,
        submissionId: `${submission}`,
        ...date_time,
    };

    const info: SubmissionInfo = {
        site: instagram_info.site,
        user: user_id.toLowerCase(),
        submission,
    };

    return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getInstagramFileDatas(obj: any) {
    if (obj.carousel_media) {
        return obj.carousel_media.map(getInstagramFileData) as ReturnType<typeof getInstagramFileData>[];
    }
    return [getInstagramFileData(obj)];
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getInstagramFileData(obj: any) {
    let res = 0;
    let url: string | undefined;
    for (const image of obj.video_versions ?? obj.image_versions2.candidates) {
        const img_res = image.height * image.width;
        if (img_res > res) {
            res = img_res;
            url = image.url;
        }
    }
    if (!url) {
        throw new Error('File URL not found');
    }

    const regex_result = /\/([^/]+)\.(\w+)(?:\?|$)/.exec(url);
    if (!regex_result) {
        throw new Error('Download link does not match RegExp');
    }

    const meta: InstagramFileMeta = {
        fileName: regex_result[1],
        ext: regex_result[2],
    };

    const info: FileInfo = {
        download: url,
    };

    return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createInstagramDownloads(
    submission_meta: InstagramSubmissionMeta,
    file_datas: InstagramFileData[],
    options: InstagramOptionsValues,
) {
    const downloads = [];
    if (file_datas.length > 1) {
        for (const [i, file] of enumerate(file_datas)) {
            const meta: InstagramMultiple = {
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
        const meta: InstagramFile = {
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
