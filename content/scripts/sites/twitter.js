"use strict";
//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------
var G_site_info = twitter_info;
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var getPageInfo = async function () {
    const url = window.location.href;
    let page = twitter_info.site;
    let has_user = false;
    let user;
    const canonical = document.querySelector('link[rel="canonical"]')?.href.split('/')[3];
    if (document.querySelector('script[data-testid^="UserProfileSchema"]')) {
        page = 'user';
        has_user = true;
        user = canonical;
    }
    else if (/\.com\/(?:\w+|i\/web)\/status\/\d+/.test(url)) {
        page = 'submission';
        has_user = true;
        user = canonical;
    }
    user = user?.toLowerCase();
    if (has_user && typeof user === 'undefined') {
        throw new Error(`User not found for page '${page}'`);
    }
    const info = { site: twitter_info.site, url, page, user };
    return info;
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
var getUserInfo = async function (user) {
    const params = new URLSearchParams({
        variables: JSON.stringify({
            screen_name: user,
            withSafetyModeUserFields: false,
            withSuperFollowsUserFields: false,
        }),
        features: JSON.stringify({
            hidden_profile_subscriptions_enabled: true,
            rweb_tipjar_consumption_enabled: true,
            responsive_web_graphql_exclude_directive_enabled: true,
            verified_phone_label_enabled: false,
            subscriptions_verification_info_is_identity_verified_enabled: true,
            subscriptions_verification_info_verified_since_enabled: true,
            highlights_tweets_tab_ui_enabled: true,
            responsive_web_twitter_article_notes_tab_enabled: true,
            subscriptions_feature_can_gift_premium: false,
            creator_subscriptions_tweet_preview_api_enabled: true,
            responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
            responsive_web_graphql_timeline_navigation_enabled: true,
        }),
    });
    const csrf_token = /ct0=([0-9a-f]+)/.exec(document.cookie)?.[1];
    if (!csrf_token) {
        throw new Error('Unable to find CSRF token');
    }
    const headers = {
        authorization: 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        'x-csrf-token': csrf_token,
    };
    const init = {
        credentials: 'include',
        referrer: window.location.href,
        headers,
    };
    const response = await fetchOk(`https://${window.location.hostname}/i/api/graphql/7mjxD3-C6BxitPMVQ6w0-Q/UserByScreenName?${params}`, init);
    const obj = await parseJSON(response);
    const user_data = obj.data.user.result.legacy;
    const name = user_data.name;
    const user_id = user_data.screen_name;
    const icon_url = user_data.profile_image_url_https.replace('_normal', '_200x200');
    const fetch_worker = new FetchWorker();
    const icon_blob = await fetch_worker.fetchOk(icon_url, init);
    fetch_worker.terminate();
    const icon = await browser.runtime.sendMessage({
        action: 'background_create_object_url',
        object: icon_blob,
    });
    const stats = new Map();
    stats.set('Media', user_data.media_count);
    stats.set('Likes', user_data.favourites_count);
    stats.set('Followers', user_data.followers_count);
    const folder_meta = {
        site: twitter_info.site,
        userId: user_id,
        userName: name,
    };
    const options = await getOptionsStorage(twitter_info.site);
    const info = {
        site: twitter_info.site,
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
    const throttler = new FunctionThrottler(checkTwitter);
    const observer = new MutationObserver(() => {
        throttler.run();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    throttler.run();
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function checkTwitter() {
    const page = await getPageInfo();
    checkTwitterPage(page.user);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkTwitterPage(page_user) {
    for (const tweet of document.querySelectorAll('[data-testid="tweet"]')) {
        const media = tweet.querySelector(':scope [aria-labelledby] > div > div');
        const tweet_photo = media?.querySelector('[data-testid="tweetPhoto"]');
        if (tweet_photo) {
            checkTwitterThumbnail(tweet, page_user);
        }
        const quote = tweet.querySelector(':scope [aria-labelledby] > div > [tabindex="0"][role="link"]');
        const quote_photo = quote?.querySelector('[data-testid="tweetPhoto"]');
        if (quote && quote_photo) {
            checkTwitterThumbnail(quote, page_user);
        }
    }
    checkTwitterMediaGrid();
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkTwitterThumbnail(element, page_user) {
    const is_quote = element.matches('[tabindex="0"][role="link"]');
    const media_box = element.querySelector(is_quote ? ':scope > div > div:nth-of-type(3)' : ':scope [aria-labelledby] > div > div > div');
    if (!media_box) {
        asLog('debug', 'Tweet media not found for', element);
        return;
    }
    // using status url does not guarantee correct user ID
    const user = element.querySelector('[tabindex="-1"] > [dir] > span')?.textContent?.slice(1);
    if (!user) {
        asLog('debug', 'User not found for', element);
        return;
    }
    // include user to avoid 'From' credit status conflict
    const link = element.querySelector(`a[href*="${user}/status/"]`);
    if (!link) {
        asLog('debug', 'Link not found for', element);
        return;
    }
    const regex_result = /\/status\/(\d+)/.exec(link.href);
    if (!regex_result) {
        asLog('debug', 'Link does not match RegExp for', element);
        return;
    }
    const submission = regex_result[1];
    return createButton(twitter_info.site, user.toLowerCase(), submission, media_box, true);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkTwitterMediaGrid() {
    for (const element of document.querySelectorAll('[data-testid="cellInnerDiv"] li')) {
        const link = element.querySelector('a[href*="/status/"]');
        if (!link) {
            asLog('debug', 'Link not found for', element);
            continue;
        }
        const regex_result = /\/([^\/]+)\/status\/(\d+)/.exec(link.href);
        if (!regex_result) {
            asLog('debug', 'Link does not match RegExp for', element);
            continue;
        }
        const user = regex_result[1].toLowerCase();
        const submission = regex_result[2];
        createButton(twitter_info.site, user, submission, element, true);
    }
}
//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------
var startDownloading = async function (submission, progress) {
    progress.say('Getting submission');
    const options = await getOptionsStorage(twitter_info.site);
    const params = new URLSearchParams({
        variables: JSON.stringify({
            focalTweetId: submission,
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
            withVoice: false,
        }),
    });
    const csrf_token = /ct0=([0-9a-f]+)/.exec(document.cookie)?.[1];
    if (!csrf_token) {
        throw new Error('Unable to find CSRF token');
    }
    const headers = {
        authorization: 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        'x-csrf-token': csrf_token,
    };
    const init = {
        credentials: 'include',
        referrer: window.location.href,
        headers,
    };
    const response = await fetchOk(`https://${window.location.hostname}/i/api/graphql/N_Am58sJXW8WRV7-cJLWvg/TweetDetail?${params}`, init);
    const obj = await parseJSON(response);
    const tweet = extractTweet(submission, obj);
    const { info, meta } = getTwitterSubmissionData(submission, tweet);
    const file_datas = await getTwitterFileDatas(tweet, meta, options, progress);
    const downloads = createTwitterDownloads(meta, file_datas, options);
    const download_ids = await handleDownloads(downloads, init, progress);
    progress.say('Updating');
    await sendAddSubmission(info.site, info.user, info.submission);
    const files = downloads.map((download, i) => ({ path: download.path, id: download_ids[i] }));
    const result = {
        user: info.user,
        files,
    };
    return result;
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function extractTweet(submission, obj) {
    let tweet;
    for (const entrie of obj.data.threaded_conversation_with_injections.instructions[0].entries) {
        let tweet_data = entrie.content?.itemContent?.tweet_results?.result;
        if (tweet_data && 'tweet' in tweet_data) {
            tweet_data = tweet_data.tweet;
        }
        if (tweet_data && tweet_data.rest_id === submission) {
            tweet = tweet_data;
            break;
        }
    }
    if (!tweet) {
        throw new Error('Unable to find tweet data');
    }
    return tweet;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getTwitterSubmissionData(submission, obj) {
    const user_name = obj.core.user.legacy.name;
    const user_id = obj.core.user.legacy.screen_name;
    const date_time = timeParse(obj.legacy.created_at);
    const meta = {
        site: twitter_info.site,
        userId: user_id,
        userName: user_name,
        submissionId: `${submission}`,
        ...date_time,
    };
    const info = {
        site: twitter_info.site,
        user: user_id.toLowerCase(),
        submission,
    };
    return { info, meta };
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getTwitterFileDatas(obj, submission_meta, options, progress) {
    const medias = obj.legacy.extended_entities.media;
    const files = medias.map((media) => getTwitterFileData(media));
    return files;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getTwitterFileData(media) {
    let url;
    if (media.type === 'photo') {
        url = `${media.media_url_https}?name=orig`;
    }
    else if (media.type === 'animated_gif') {
        url = media.video_info.variants[0].url;
    }
    else if (media.type === 'video') {
        media.video_info.variants.sort((a, b) => (b.bitrate ?? -1) - (a.bitrate ?? -1));
        url = media.video_info.variants[0].url;
    }
    else {
        url = media.media_url_https;
    }
    if (!url || typeof url !== 'string') {
        throw new Error('Download link not found');
    }
    const regex_result = /\/([^\/]+)\.(\w+)(?:\?|$)/.exec(url);
    if (!regex_result) {
        throw new Error('Download link does not match RegExp');
    }
    const meta = {
        fileName: regex_result[1],
        ext: regex_result[2],
    };
    const info = {
        download: url,
    };
    return { info, meta };
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function createTwitterDownloads(submission_meta, file_datas, options) {
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
