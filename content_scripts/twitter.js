var as = { twitter: { check: {}, download: {} } };

//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

function pageInfo() {
    let page = {
        url: window.location.href,
        site: 'twitter'
    };

    let user_block = $$('[data-testid="UserName"] > div > div > div > div > span');
    if (user_block.length === 3) {
        page.page = 'user';
        page.user = user_block[2].textContent.slice(1);
    }

    return page;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.twitter.userInfo = async function (user_id) {
    let params = new URLSearchParams({
        variables: JSON.stringify({
            screen_name: user_id,
            withSafetyModeUserFields: false,
            withSuperFollowsUserFields: false
        })
    });
    let headers = {
        authorization: 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        'x-csrf-token': /ct0=([0-9a-f]+);/.exec(document.cookie)[1]
    };
    let url = `https://twitter.com/i/api/graphql/7mjxD3-C6BxitPMVQ6w0-Q/UserByScreenName?${params}`;
    let userresponse = await fetcher(url, 'json', { headers });

    let us = userresponse.data.user.result.legacy;
    let user = {
        site: 'twitter',
        id: us.screen_name,
        name: us.name
    }
    user.stats = new Map([
        ['Media', us.media_count],
        ['Likes', us.favourites_count],
        ['Followers', us.followers_count]
    ]);

    let worker = new Worker(browser.runtime.getURL('/workers/downloadworker.js'));
    let iconblob = await workerMessage(worker, 'downloadblob', us.profile_image_url_https.replace('_normal', '_200x200'));
    worker.terminate();
    user.icon = await browser.runtime.sendMessage({
        function: 'createobjecturl',
        object: iconblob
    });

    user.folderMeta = {
        site: user.site,
        userName: user.name,
        userId: user.id
    };

    return user;
}

//---------------------------------------------------------------------------------------------------------------------
// main add checks and download buttons to image thumbnails
//---------------------------------------------------------------------------------------------------------------------

as.twitter.check.startChecking = function () {
    asLog('Checking Twitter');
    let page = pageInfo();
    this.checkPage(page);

    let pageobserver = new MutationObserver((mutationsList, observer) => {
        let newnodes = mutationsList.flatMap(m => [...m.addedNodes]).filter(n => n.nodeType === 1);
        if (newnodes.some(n => $(n, '[data-testid="tweet"]'))) {
            this.checkPage(page);
        }
    });

    globalrunningobservers.push(pageobserver);
    pageobserver.observe(document, { childList: true, subtree: true });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.twitter.check.checkPage = function (page) {
    this.checkThumbnails(this.getThumbnails());
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.twitter.check.getThumbnails = function () {
    let tweets = [];
    for (let tweet of $$('[data-testid="tweet"]')) {
        let media_box = $(tweet, ':scope [aria-labelledby] > div > div');
        //media is a card to another website
        if (!media_box || media_box.getAttribute('data-testid') === 'card.wrapper') {
            continue;
        }
        //media is a quote tweet
        let quote = $(media_box, ':scope > div > span');
        if (quote) {
            continue;
        }
        tweets.push(tweet);
    }
    return tweets;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.twitter.check.checkThumbnails = function (thumbnails) {
    for (let tweet of thumbnails) {
        try {
            let url = $(tweet, 'a[href*="/status/"]').href;
            let regurl = /(\w+)\/status\/(\d+)/.exec(url);
            let subid = regurl[2];
            let subuser = regurl[1];
            let anchor = $(tweet, ':scope [aria-labelledby] > div > div');

            addButton('twitter', subuser, subid, anchor);
        }
        catch (err) { }
    }
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------

as.twitter.download.startDownloading = async function (subid, progress) { 
    progress.say('Getting submission');
    let options = await getOptions('twitter');
    let pageurl = `https://twitter.com/i/web/status/${subid}`;

    try {
        let params = new URLSearchParams({
            variables: JSON.stringify({
                focalTweetId: subid,
                with_rux_injections: false,
                includePromotedContent: false,
                withCommunity: false,
                withQuickPromoteEligibilityTweetFields: false,
                withTweetQuoteCount: false,
                withBirdwatchNotes: false,
                withSuperFollowsUserFields: false,
                withUserResults: false,
                withBirdwatchPivots: false,
                withReactionsMetadata: false,
                withReactionsPerspective: false,
                withSuperFollowsTweetFields: false,
                withVoice: false
            })
        });
        let headers = {
            authorization: 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
            'x-csrf-token': /ct0=([0-9a-f]+);/.exec(document.cookie)[1]
        };
        let response = await fetcher(`https://twitter.com/i/api/graphql/N_Am58sJXW8WRV7-cJLWvg/TweetDetail?${params}`, 'json', { headers });

        let tweet;
        for (let entrie of response.data.threaded_conversation_with_injections.instructions[0].entries) {
            let tweet_data = entrie.content?.itemContent?.tweet_results?.result;
            if (tweet_data && tweet_data.rest_id === subid) {
                tweet = tweet_data;
                break;
            }
        }

        let { info, meta } = this.getMeta(tweet);
        let downloads = this.createDownloads(info, meta, options);

        let results = await this.handleDownloads(downloads, progress);
        if (results.some(r => r.response === 'Success')) {
            progress.say('Updating');
            await updateSavedInfo(info.savedSite, info.savedUser, info.savedId);
        }
        else {
            throw new Error('Files failed to download.');
        }

        progress.finished();
        return {
            status: 'Success',
            submission: {
                url: pageurl,
                user: info.savedUser,
                id: info.savedId,
                title: ''
            },
            files: results
        };
    }
    catch (err) {
        asLog(err);
        progress.error();

        return {
            status: 'Failure',
            error: err,
            url: pageurl,
            progress
        };
    }
}

//['site', 'userName', 'userId', 'submissionId', 'fileName', 'page', 'ext', 'YYYY', 'MM', 'DD', 'hh', 'mm', 'ss']
as.twitter.download.getMeta = function (r) {
    let info = {}, meta = {};
    
    meta.site = 'twitter';
    meta.userName = r.core.user.legacy.name;
    meta.userId = r.core.user.legacy.screen_name;
    meta.submissionId = r.rest_id;

    meta = { ...meta, ...timeParse(r.legacy.created_at) };

    info.media = r.legacy.extended_entities.media;

    info.savedSite = meta.site;
    info.savedUser = meta.userId;
    info.savedId = meta.submissionId;
    return { info, meta }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.twitter.download.createDownloads = function (info, meta, options) {
    //orig, 4096x4096, large, medium, small
    let downloads = info.media.map((media, i) => {
        let page_meta = { ...meta };

        let url;
        if (media.type === 'photo') {
            url = `${media.media_url_https}?name=orig`;
        }
        else if (media.type === 'animated_gif') {
            url = media.video_info.variants[0].url;
        }
        else if (media.type === 'video') {
            media.video_info.variants.sort((a, b) => (b?.bitrate ?? -1) - (a?.bitrate ?? -1));
            url = media.video_info.variants[0].url;
        }
        else {
            url = media.media_url_https;
        }

        let reg = /\/([^\/]+)\.(\w+)(?:\?|$)/.exec(url);
        page_meta.fileName = reg[1];
        page_meta.ext = reg[2];

        let download = {}
        if (info.media.length <= 1) {
            download.filename = options.file;
        }
        else {
            download.filename = options.multiple;
            page_meta.page = `${i + 1}`;
        }
        download.meta = page_meta;
        download.url = url;

        return download;
    });

    return downloads;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.twitter.download.handleDownloads = async function (downloads, progress) {
    let worker = new Worker(browser.runtime.getURL('/workers/downloadworker.js'));

    let bytes = 0;
    let results = [];
    let total = downloads.length;

    for (let i = 0; i < total; i += 1) {
        let blob = await workerMessage(worker, 'downloadblob', downloads[i].url, (data) => {
            progress.blobProgress(i, total, bytes, data.loaded, data.total);
        });

        bytes += blob.size;

        let result = await downloadBlob(blob, downloads[i].filename, downloads[i].meta);
        results.push(result);
    }
    worker.terminate();

    return results;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function workerMessage(worker, func, data, callback) {
    let result = new Promise((resolve, reject) => {
        worker.onmessage = m => {
            switch (m.data.message) {
                case 'progress':
                    if (callback) {
                        callback(m.data);
                    }
                    break;

                case 'result':
                    resolve(m.data.result);

                case 'error':
                    let error = new Error(m.data.description);
                    error.name = m.data.name;
                    reject(error);
            }
        }
    });

    worker.postMessage({ function: func, data });

    return await result;
}