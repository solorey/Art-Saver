//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

var G_site_info: SiteInfo = inkbunny_info;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var getPageInfo = async () => {
    const url = window.location.href;

    const path_components = pathComponents(url);
    const search = window.location.search;

    let page: string = inkbunny_info.site;
    let has_user = false;
    let user: string | undefined;

    if (!path_components[1] && document.title?.split(' |')[0].endsWith('< Profile')) {
        page = 'user';
        has_user = true;
        user = path_components[0];
    }
    if (path_components[0] === 's') {
        page = 'submission';
        has_user = true;
        user = document.querySelector<HTMLAnchorElement>('[href*="/gallery/"], [href*="/scraps/"]')?.href.split('/')[4];
    } else if (path_components[0] === 'j') {
        page = 'journal';
        has_user = true;
        user = path_components[1].split('-')[1];
    } else if (path_components[0]) {
        page = path_components[0];
    }

    if (['gallery', 'scraps', 'journals'].includes(page)) {
        has_user = true;
        user = path_components[1];
    } else if (['submissionsviewall.php', 'poolslist.php'].includes(page) && /user_id=\d+|artist=\w+/.test(search)) {
        has_user = true;
        user =
            /artist=(\w+?)(?:&|$)/.exec(search)?.[1] ||
            document
                .querySelector<HTMLAnchorElement>('.weasel a[rel=author], .stoat a[rel=author]')
                ?.href.split('/')[3];
    }

    user = user?.toLowerCase();

    if (has_user && !user) {
        throw new Error(`User not found for page '${page}'`);
    }

    const info: PageInfo = { site: inkbunny_info.site, url, page, user };
    return info;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var getUserInfo = async (user: User) => {
    const init: RequestInit = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const response = await fetchOk(`https://inkbunny.net/${user}`, init);
    const dom = await response.dom();

    const name = dom.title.split(' ')[0];

    const user_id = dom.querySelector<HTMLAnchorElement>('a[href*="user_id="]')?.href.split('=').pop();
    if (!user_id) {
        throw new Error('User ID not found');
    }
    const icon = dom.querySelector<HTMLImageElement>(`img[alt="${name}"]`)?.src;

    const stats_values = dom
        .querySelectorAll('.elephant_babdb6 .content > div > span strong')
        .values()
        .map((stat) => stat.textContent?.replaceAll(',', '') ?? '')
        .toArray();

    const favorites_response = await fetchOk(`https://inkbunny.net/userfavorites_process.php?favs_user_id=${user_id}`);
    const favorites_dom = await favorites_response.dom();
    const favorites = favorites_dom
        .querySelector('.elephant_555753 .content > div:first-child')
        ?.textContent?.trim()
        .split(' ')[0]
        .replaceAll(',', '');

    const stats = new Map();
    stats.set('Submissions', stats_values[1]);
    stats.set('Favorites', favorites);
    stats.set('Views', stats_values[4]);

    const folder_meta: InkbunnyUserFolder = {
        site: inkbunny_info.site,
        userId: user_id,
        userName: name,
    };

    const options = await getOptionsStorage<InkbunnyOptionsValues>(inkbunny_info.site);

    const info: UserInfo = {
        site: inkbunny_info.site,
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

var startChecking = async () => {
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

function checkInkbunnyPage(page_user?: User) {
    let widgets = [...document.querySelectorAll<HTMLElement>('.widget_imageFromSubmission')];
    // filter thumbnails that are submission page previews
    for (const parent of document.querySelectorAll<HTMLElement>('#files_area, .content.magicboxParent')) {
        widgets = widgets.filter((w) => !parent.parentElement?.contains(w));
    }
    for (const widget of widgets) {
        checkInkbunnyThumbnail(widget, page_user);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkInkbunnyThumbnail(element: HTMLElement, page_user?: User) {
    const link = element.querySelector<HTMLAnchorElement>('a');
    if (!link) {
        G_check_log.log(element, 'Link not found');
        return;
    }
    const submission_id = /\/(\d+)$/.exec(link.href)?.[1];
    if (!submission_id) {
        G_check_log.log(element, 'Submission ID not found in url');
        return;
    }
    const submission = parseInt(submission_id, 10);

    const img_alt = element.querySelector('img')?.alt ?? '';
    const user = /\sby\s(\w+)(?:$|(?:\s-\s))/.exec(img_alt)?.[1]?.toLowerCase() ?? page_user;
    if (!user) {
        G_check_log.log(element, 'User not found');
        return;
    }

    // links are inline and don't match size of thumbnail
    // start at links parent instead
    let parent = link.parentElement;
    if (!parent) {
        G_check_log.log(link, 'Has no parent');
        return;
    }
    parent = navigateUpSmaller(parent);
    const info = { site: inkbunny_info.site, user, submission };
    return createButton(info, parent);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkInkbunnySubmissionPage(url: string, user: User) {
    const media = document.querySelector<HTMLElement>('.content.magicboxParent');
    if (!media) {
        G_check_log.log('Submission page:', 'Media element not found');
        return;
    }

    const submission_id = /\/s\/(\d+)/.exec(url)?.[1];
    if (!submission_id) {
        G_check_log.log('Submission page:', `Unexpected submission url ${url}`);
        return;
    }
    const submission = parseInt(submission_id, 10);

    const info = { site: inkbunny_info.site, user, submission };
    createButton(info, media, { screen: false });
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------

var startDownloading = async (submission: Submission, progress: ProgressController) => {
    const options = await getOptionsStorage<InkbunnyOptionsValues>(inkbunny_info.site);

    const init: RequestInit = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const response = await fetchOk(`https://inkbunny.net/s/${submission}`, init);
    const dom = await response.dom();

    const { info, meta } = getInkbunnySubmissionData(submission, dom);
    const file_datas = await getInkbunnyFileDatas(dom, meta, options, progress);
    const downloads = createInkbunnyDownloads(meta, file_datas, options);

    return await downloadSubmission(info, downloads, init, progress, meta.title);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getInkbunnySubmissionData(submission: Submission, dom: Document) {
    const title_element = dom.querySelector('#pictop h1');
    if (!title_element) {
        throw new Error('Title element not found');
    }
    const title = title_element.textContent?.trim() ?? '';

    const user_name = dom
        .querySelector<HTMLAnchorElement>('[href*="/gallery/"], [href*="/scraps/"]')
        ?.href.split('/')[4];
    if (!user_name) {
        throw new Error('User name not found');
    }
    const user_id = dom.querySelector<HTMLAnchorElement>('a[href*="user_id"]')?.href.split('=').pop() ?? '';

    const date_text = dom.querySelector<HTMLElement>('#submittime_exact')?.textContent?.trim();
    if (!date_text) {
        throw new Error('Date not found');
    }
    const date_time = timeParse(date_text);

    const meta: InkbunnySubmissionMeta = {
        site: inkbunny_info.site,
        userId: user_id,
        userName: user_name,
        submissionId: `${submission}`,
        title,
        ...date_time,
    };

    const info: SubmissionInfo = {
        site: inkbunny_info.site,
        user: user_name.toLowerCase(),
        submission,
    };

    return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getInkbunnyFileDatas(
    dom: Document,
    submission_meta: InkbunnySubmissionMeta,
    options: InkbunnyOptionsValues,
    progress: ProgressController,
) {
    const files_count = dom.querySelector<HTMLElement>('#files_area span')?.textContent?.trim().split(' ')[2];
    const pages = files_count ? parseInt(files_count, 10) : 1;

    const init: RequestInit = {
        credentials: 'include',
        referrer: window.location.href,
    };
    const files = [];
    for (let i = 1; i <= pages; i++) {
        let page_dom: Document;
        if (i === 1) {
            page_dom = dom;
        } else {
            progress.onOf('Getting page', i, pages);
            let response: OkResponse;
            while (true) {
                try {
                    response = await fetchOk(`https://inkbunny.net/s/${submission_meta.submissionId}-p${i}`, init);
                    break;
                } catch (error) {
                    await timer(4);
                }
            }
            page_dom = await response.dom();
        }

        files.push(getInkbunnyFileData(page_dom));
    }

    const story_element = dom.querySelector<HTMLElement>('#storysectionbar > span');
    const writing_file = files.find((f) => ['txt', 'rtf', 'doc'].includes(f.meta.ext));
    if (story_element && !(writing_file && options.skipWriting)) {
        progress.message('Getting writing');
        const file = writing_file || files[0];
        const download = await getInkbunnyWriting(
            options.writing,
            dom,
            story_element,
            { ...submission_meta, ...file.meta },
            options,
        );
        const info = { download };
        const meta = { ...file.meta, ext: options.writing };
        files.push({ meta, info });
    }

    return files;
}

//---------------------------------------------------------------------------------------------------------------------
// writing conversion
//---------------------------------------------------------------------------------------------------------------------

async function getInkbunnyWriting(
    type: string,
    dom: Document,
    story_element: HTMLElement,
    meta: InkbunnyFile,
    options: InkbunnyOptionsValues,
) {
    const story = cleanInkbunnyWriting(story_element);
    story.id = 'content';

    const decription_element = dom.querySelector<HTMLElement>('.elephant_bottom > .content > div > span');
    const description = decription_element
        ? cleanInkbunnyWriting(decription_element)
        : document.createElement('section');
    description.id = 'description';

    const story_text = getInkbunnyWritingText(story);
    const word_count = wordCount(story_text);

    let template: string;
    let story_content: string;
    let description_content: string;

    if (type === 'html') {
        if (options.includeImage) {
            const icon_url = dom.querySelector<HTMLImageElement>('.content.magicboxParent .shadowedimage')?.src;
            if (icon_url) {
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

        template = options.writingHTML;
        story_content = story.outerHTML;
        description_content = description.outerHTML;
    } else {
        template = options.writingText;
        story_content = story_text;
        description_content = getInkbunnyWritingText(description);
    }

    const url = `https://inkbunny.net/s/${meta.submissionId}`;
    meta.ext = type;

    const story_meta: InkbunnyWriting = {
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

function cleanInkbunnyWriting(element: HTMLElement) {
    const section = document.createElement('section');
    section.replaceChildren(...element.childNodes);
    for (const elem of section.querySelectorAll('.underline')) {
        const u = document.createElement('u');
        elem.after(u);
        u.replaceChildren(elem);
    }
    for (const elem of section.querySelectorAll('.strikethrough')) {
        const s = document.createElement('s');
        elem.after(s);
        s.replaceChildren(elem);
    }
    for (const elem of section.querySelectorAll<HTMLElement>('.align_center')) {
        elem.style.setProperty('text-align', 'center');
    }
    for (const elem of section.querySelectorAll<HTMLElement>('.align_left')) {
        elem.style.setProperty('text-align', 'start');
    }
    for (const elem of section.querySelectorAll<HTMLElement>('.align_right')) {
        elem.style.setProperty('text-align', 'end');
    }

    return cleanWriting(section, ['id', 'class']);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getInkbunnyWritingText(element: HTMLElement) {
    return getElementText(document.importNode(element, true));
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getInkbunnyFileData(dom: Document) {
    const content_box = dom.querySelector('.content.magicboxParent');
    // check if these elements exist in order
    const download_link =
        content_box?.querySelector<HTMLAnchorElement>('a[download=""]')?.href ??
        content_box?.querySelector<HTMLAnchorElement>('a[href^="https://tx.ib.metapix.net/files/full/"]')?.href ??
        content_box?.querySelector<HTMLImageElement>('img[src*=".ib.metapix.net/files/"]')?.src;
    if (!download_link) {
        throw new Error('Download link not found');
    }

    const url = decodeURI(download_link);

    const regex_result = /\/((\d+)_.+)\.(.+)$/.exec(url);
    if (!regex_result) {
        throw new Error('Download link does not match RegExp');
    }

    const meta: InkbunnyFileMeta = {
        fileName: regex_result[1],
        fileId: regex_result[2],
        ext: regex_result[3],
    };

    const info: FileInfo = {
        download: url,
    };

    return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createInkbunnyDownloads(
    submission_meta: InkbunnySubmissionMeta,
    file_datas: InkbunnyFileData[],
    options: InkbunnyOptionsValues,
) {
    const downloads = [];
    if (file_datas.length > 1) {
        for (const [i, file] of enumerate(file_datas)) {
            const meta: InkbunnyMultiple = {
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
        const meta: InkbunnyFile = {
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
