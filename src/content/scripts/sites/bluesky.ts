//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

var G_site_info: SiteInfo = bluesky_info;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var getPageInfo = async () => {
    const url = window.location.href;
    const path_components = pathComponents(url);

    const page = path_components[0] ?? bluesky_info.site;
    let has_user = false;
    let user: string | undefined;

    if (['profile'].includes(page)) {
        has_user = true;
        user = path_components[1];
        if (user.startsWith('did:plc:')) {
            const params = new URLSearchParams({
                actor: user,
            });
            const init: RequestInit = {
                headers: {
                    authorization: `Bearer ${accessJwt()}`,
                },
            };
            const response = await fetchOk(`${pdsUrl()}xrpc/app.bsky.actor.getProfile?${params}`, init);
            const obj = await response.json();
            user = obj.handle;
        }
    }

    if (has_user && !user) {
        throw new Error(`User not found for page '${page}'`);
    }

    const info: PageInfo = { site: bluesky_info.site, url, page, user };
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
    const url: string | undefined = storage?.session?.currentAccount?.pdsUrl;
    if (!url) {
        throw new Error('pdsURL not found in localStorage');
    }
    return url;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function accessJwt() {
    const storage = getLocalStorage();
    const jwt: string | undefined = storage?.session?.currentAccount?.accessJwt;
    if (!jwt) {
        throw new Error('accessJwt not found in localStorage');
    }
    return jwt;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var getUserInfo = async (user: User) => {
    const params = new URLSearchParams({
        actor: user,
    });
    const headers = {
        authorization: `Bearer ${accessJwt()}`,
    };
    const init: RequestInit = {
        headers,
    };
    const response = await fetchOk(`${pdsUrl()}xrpc/app.bsky.actor.getProfile?${params}`, init);

    const obj = await response.json();

    const name = obj.displayName;
    const did = obj.did;

    const icon_url = obj.avatar;

    const work_fetch = new WorkFetch();
    const icon_response = await work_fetch.fetchOk(icon_url, init);
    work_fetch.disconnect();

    const icon: string = await browser.runtime.sendMessage({
        action: 'background_create_object_url',
        blob: icon_response.body,
    } as BackgroundMessage);

    const stats = new Map();
    stats.set('Posts', obj.postsCount);
    stats.set('Followers', obj.followersCount);

    const folder_meta: BlueskyUserFolder = {
        site: bluesky_info.site,
        userId: user,
        userName: name,
        userDid: did,
    };

    const options = await getOptionsStorage<BlueskyOptionsValues>(bluesky_info.site);

    const info: UserInfo = {
        site: bluesky_info.site,
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
    observeThrottle(checkBluesky);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function checkBluesky() {
    checkBlueskyPage();
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkBlueskyPage() {
    const media_selector =
        '[data-expoimage], [aria-label="Embedded video player"], video[src^="https://t.gifs.bsky.app/"]';
    for (const item of document.querySelectorAll<HTMLElement>(
        'div[role="link"][tabindex="0"], [data-testid^="postThreadItem"]',
    )) {
        const media = item.querySelector(media_selector);
        if (media && !media.matches('[aria-label^="Post by"] div')) {
            checkBlueskyThumbnail(item);
        }
    }
    for (const quote of document.querySelectorAll<HTMLElement>('[aria-label^="Post by"][role="link"]')) {
        const media = quote.querySelector(media_selector);
        if (media) {
            checkBlueskyThumbnail(quote);
        }
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkBlueskyThumbnail(element: HTMLElement) {
    const media_box =
        // single image and video
        element.querySelector<HTMLElement>(':scope :is(div, button)[style^="width: 100%;"]') ??
        // media grid
        element.querySelector<HTMLElement>(
            ':scope div[style*="margin-top: 8px;"] > div:not([style]) > div[style*="gap: 4px;"]',
        ) ??
        // gif
        element.querySelector<HTMLElement>(
            ':scope div:not([style]) > div[style*="margin-top: 8px;"] > div[style*="width: 100%;"]',
        );

    if (!media_box) {
        G_check_log.log(element, 'Post media not found');
        return;
    }
    const user =
        element.getAttribute('data-testid')?.split('-by-', 2)[1] ??
        // quote post
        element.getAttribute('aria-label')?.split(' by ', 2)[1] ??
        // saved layout
        element.querySelector<HTMLAnchorElement>('a[href^="/profile/"]')?.href?.split('/').pop();
    if (!user) {
        G_check_log.log(element, 'User not found');
        return;
    }
    let link: string | undefined;
    // Follow button next to main post selector
    if (element.querySelector('button[data-testid="followBtn"]')) {
        link = window.location.href;
    } else {
        link = element.querySelector<HTMLAnchorElement>('a[href*="/post/"][data-tooltip]')?.href;
    }
    if (!link) {
        G_check_log.log(element, 'Link not found');
        return;
    }
    const regex_result = /\/post\/([2-7a-z]+)/.exec(link);
    if (!regex_result) {
        G_check_log.log(element, 'Link does not match RegExp');
        return;
    }

    let did: string | undefined;
    const thumb_url =
        element.querySelector<HTMLImageElement>('[data-expoimage] img[src*="/did:plc:"]')?.src ??
        element.querySelector<HTMLImageElement>('a[href^="/profile/"] img[src*="/avatar_thumbnail/"]')?.src;
    if (thumb_url) {
        did = thumb_url.split('/')[6];
    }
    if (!did) {
        const thumb_url = element.querySelector<HTMLVideoElement>('figure > video[poster]')?.poster;
        if (thumb_url) {
            did = decodeURIComponent(thumb_url).split('/')[4];
        }
    }
    if (!did) {
        G_check_log.log(element, 'User DID not found');
        return;
    }

    const info = {
        site: bluesky_info.site,
        user: user.toLowerCase(),
        submission: `${regex_result[1]};${did}`,
    };
    return createButton(info, media_box);
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------

var startDownloading = async (submission: Submission, progress: ProgressController) => {
    const options = await getOptionsStorage<BlueskyOptionsValues>(bluesky_info.site);
    const split = `${submission}`.split(';');
    const params = new URLSearchParams({
        uri: `at://${split[1]}/app.bsky.feed.post/${split[0]}`,
        depth: '0',
    });
    const headers = {
        authorization: `Bearer ${accessJwt()}`,
    };
    const init: RequestInit = {
        headers,
    };
    const response = await fetchOk(`${pdsUrl()}xrpc/app.bsky.feed.getPostThread?${params}`, init);
    const obj = await response.json();

    const { info, meta } = getBlueskySubmissionData(submission, obj);
    const file_datas = getBlueskyFileDatas(obj);
    const downloads = createBlueskyDownloads(meta, file_datas, options);

    return await downloadSubmission(info, downloads, init, progress);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getBlueskySubmissionData(submission: Submission, obj: any) {
    const split = `${submission}`.split(';', 2);
    const user_name = obj.thread.post.author.displayName;
    const user_id = obj.thread.post.author.handle;

    const date_time = timeParse(obj.thread.post.record.createdAt);

    const meta: BlueskySubmissionMeta = {
        site: bluesky_info.site,
        userId: user_id,
        userName: user_name,
        userDid: split[1],
        submissionId: split[0],
        ...date_time,
    };

    const info: SubmissionInfo = {
        site: bluesky_info.site,
        user: user_id.toLowerCase(),
        submission,
    };

    return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getBlueskyFileDatas(obj: any) {
    const file_datas: BlueskyFileData[] = [];

    let media = obj.thread.post.record.embed;
    if ('media' in media) {
        media = media.media;
    }

    const addMedia = (media_obj: any) => {
        const cid = media_obj.ref?.$link ?? media_obj.cid;
        if (!cid) {
            throw new Error('Could not find media CID');
        }

        let ext = media_obj.mimeType.split('/').pop();
        if (ext === 'jpeg') {
            ext = 'jpg';
        }
        const meta: BlueskyFileMeta = {
            fileName: cid,
            ext,
        };

        const params = new URLSearchParams({
            did: obj.thread.post.author.did,
            cid,
        });
        const url = `https://bsky.social/xrpc/com.atproto.sync.getBlob?${params}`;

        const info: FileInfo = {
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
        const meta: BlueskyFileMeta = {
            fileName: file_regex[1],
            ext: file_regex[2],
        };

        const info: FileInfo = {
            download: uri,
        };

        file_datas.push({ info, meta });
    }

    return file_datas;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createBlueskyDownloads(
    submission_meta: BlueskySubmissionMeta,
    file_datas: BlueskyFileData[],
    options: BlueskyOptionsValues,
) {
    const downloads = [];
    if (file_datas.length > 1) {
        for (const [i, file] of enumerate(file_datas)) {
            const meta: BlueskyMultiple = {
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
        const meta: BlueskyFile = {
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
