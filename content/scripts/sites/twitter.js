"use strict";
//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------
var G_site_info = twitter_info;
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// https://antibot.blog/posts/1741552092462
// https://github.com/iSarabjitDhiman/XClientTransaction
class XClient {
    client_values;
    async getClientValues() {
        if (this.client_values) {
            return this.client_values;
        }
        const response = await fetchOk('https://x.com');
        const dom = await response.dom();
        const key = dom.querySelector('[name="twitter-site-verification"]')?.getAttribute('content');
        if (!key) {
            throw new Error('Verification key not found');
        }
        const key_bytes = new Uint8Array(atob(key)
            .split('')
            .map((n) => n.charCodeAt(0)));
        const on_demand_file_result = /(['"])ondemand\.s\1:\s*(['"])([\w]*)\2/.exec(dom.documentElement.outerHTML);
        if (!on_demand_file_result) {
            throw new Error('On demand file not found');
        }
        const on_demand_file_url = `https://abs.twimg.com/responsive-web/client-web/ondemand.s.${on_demand_file_result[3]}a.js`;
        const on_demand_file_response = await fetchOk(on_demand_file_url);
        const response_text = await on_demand_file_response.text();
        const indices_matches = [...response_text.matchAll(/\(\w\[(\d{1,2})\],\s*16\)/g)];
        const indices = indices_matches.map((match) => parseInt(match[1], 10));
        const path_index = key_bytes[indices[0]] % 16;
        const frame_time = indices.slice(1).reduce((n, i) => {
            return n * (key_bytes[i] % 16);
        }, 1);
        const path_node = dom.querySelectorAll('[id^="loading-x"]')[key_bytes[5] % 4].childNodes[0]
            .childNodes[1];
        const path_string = path_node.getAttribute('d');
        if (!path_string) {
            throw new Error('Path not found');
        }
        const path_numbers = path_string
            .substring(9)
            .split('C')[path_index].replace(/[^\d]+/g, ' ')
            .trim()
            .split(/\s+/)
            .map((s) => parseInt(s, 10));
        const div = document.createElement('div');
        document.body.append(div);
        function interpolateU8ToRange(n, min_value, max_value) {
            return (n * (max_value - min_value)) / 255 + min_value;
        }
        const start_color = `rgb(${path_numbers.slice(0, 3).join()})`;
        const end_color = `rgb(${path_numbers.slice(3, 6).join()})`;
        const degrees = Math.floor(interpolateU8ToRange(path_numbers[6], 60, 360));
        const coords = path_numbers.slice(7).map((n, i) => interpolateU8ToRange(n, i % 2 ? -1 : 0, 1).toFixed(2));
        const animation = div.animate({
            color: [start_color, end_color],
            transform: ['rotate(0deg)', `rotate(${degrees}deg)`],
            easing: `cubic-bezier(${coords.join()})`,
        }, 4096);
        animation.pause();
        animation.currentTime = Math.round(frame_time / 10) * 10;
        const style = getComputedStyle(div);
        const animation_string = [...`${style.color}${style.transform}`.matchAll(/([\d.-]+)/g)]
            .map((n) => Number(Number(n[0]).toFixed(2)).toString(16))
            .join('')
            .replace(/[.-]/g, '');
        div.parentNode?.removeChild(div);
        this.client_values = {
            key_bytes,
            animation_string,
        };
        return this.client_values;
    }
    async getTransactionId(method, path) {
        const time = Math.floor((Date.now() - 1682924400 * 1e3) / 1e3);
        const time_buffer = new Uint8Array(new Uint32Array([time]).buffer);
        const { key_bytes, animation_string } = await this.getClientValues();
        const data = `${method}!${path}!${time}obfiowerehiring${animation_string}`;
        const encoder = new TextEncoder();
        const hash_buffer = await crypto.subtle.digest('sha-256', encoder.encode(data));
        const hash_bytes = [...new Uint8Array(hash_buffer)];
        const byte_array = [...key_bytes, ...time_buffer, ...hash_bytes.slice(0, 16), 3];
        const random_num = Math.floor(Math.random() * 256);
        const final_bytes = new Uint8Array([random_num, ...byte_array.map((n) => n ^ random_num)]);
        const id = btoa([...final_bytes].map((n) => String.fromCharCode(n)).join('')).replace(/=/g, '');
        return id;
    }
}
const x_client = new XClient();
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
        variables: JSON.stringify({ screen_name: user }),
        features: JSON.stringify({
            hidden_profile_subscriptions_enabled: false,
            profile_label_improvements_pcf_label_in_post_enabled: false,
            rweb_tipjar_consumption_enabled: false,
            verified_phone_label_enabled: false,
            subscriptions_verification_info_is_identity_verified_enabled: false,
            subscriptions_verification_info_verified_since_enabled: false,
            highlights_tweets_tab_ui_enabled: false,
            responsive_web_twitter_article_notes_tab_enabled: false,
            subscriptions_feature_can_gift_premium: false,
            creator_subscriptions_tweet_preview_api_enabled: false,
            responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
            responsive_web_graphql_timeline_navigation_enabled: false,
        }),
        fieldToggles: JSON.stringify({ withAuxiliaryUserLabels: false }),
    });
    const csrf_token = /ct0=([0-9a-f]+)/.exec(document.cookie)?.[1];
    if (!csrf_token) {
        throw new Error('Unable to find CSRF token');
    }
    const path = '/i/api/graphql/1VOOyvKkiI3FMmkeDNxM9A/UserByScreenName';
    const headers = {
        authorization: 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        'x-csrf-token': csrf_token,
        'x-twitter-active-user': 'yes',
        'x-client-transaction-id': await x_client.getTransactionId('GET', path),
    };
    const init = {
        credentials: 'include',
        referrer: window.location.href,
        headers,
    };
    const response = await fetchOk(`https://x.com${path}?${params}`, init);
    const obj = await response.json();
    const user_data = obj.data.user.result.legacy;
    const name = user_data.name;
    const user_id = user_data.screen_name;
    const icon_url = user_data.profile_image_url_https.replace('_normal', '_200x200');
    const icon_response = await fetchWorkerOk(icon_url);
    const icon = await browser.runtime.sendMessage({
        action: 'background_create_object_url',
        blob: icon_response.body,
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
    checkTwitterPage();
    checkTwitterMediaGrid();
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkTwitterPage() {
    for (const tweet of document.querySelectorAll('[data-testid="tweet"]')) {
        const media = tweet.querySelector(':scope [aria-labelledby] > div > div');
        const tweet_photo = media?.querySelector('[data-testid="tweetPhoto"]');
        if (tweet_photo) {
            checkTwitterThumbnail(tweet);
        }
        const quote = tweet.querySelector(':scope [aria-labelledby] > div > [tabindex="0"][role="link"]');
        const quote_photo = quote?.querySelector('[data-testid="tweetPhoto"]');
        if (quote && quote_photo) {
            checkTwitterThumbnail(quote);
        }
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkTwitterThumbnail(element) {
    const is_quote = element.matches('[tabindex="0"][role="link"]');
    const media_box = element.querySelector(is_quote ? ':scope > div > div:nth-of-type(3)' : ':scope [aria-labelledby] > div > div > div');
    if (!media_box) {
        G_check_log.log('Tweet media not found for', element);
        return;
    }
    // using status url does not guarantee correct user ID
    const user = element.querySelector('[tabindex="-1"] > [dir] > span')?.textContent?.slice(1);
    if (!user) {
        G_check_log.log('User not found for', element);
        return;
    }
    // include user to avoid 'From' credit status conflict
    const link = element.querySelector(`a[href*="${user}/status/"]`);
    if (!link) {
        G_check_log.log('Link not found for', element);
        return;
    }
    const regex_result = /\/status\/(\d+)/.exec(link.href);
    if (!regex_result) {
        G_check_log.log('Link does not match RegExp for', element);
        return;
    }
    const submission = regex_result[1];
    const info = { site: twitter_info.site, user: user.toLowerCase(), submission };
    return createButton(info, media_box);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkTwitterMediaGrid() {
    for (const element of document.querySelectorAll('[data-testid="cellInnerDiv"] li')) {
        const link = element.querySelector('a[href*="/status/"]');
        if (!link) {
            G_check_log.log('Link not found for', element);
            continue;
        }
        const regex_result = /\/([^\/]+)\/status\/(\d+)/.exec(link.href);
        if (!regex_result) {
            G_check_log.log('Link does not match RegExp for', element);
            continue;
        }
        const info = {
            site: twitter_info.site,
            user: regex_result[1].toLowerCase(),
            submission: regex_result[2],
        };
        createButton(info, element);
    }
}
//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------
var startDownloading = async function (submission, progress) {
    const options = await getOptionsStorage(twitter_info.site);
    const params = new URLSearchParams({
        variables: JSON.stringify({
            focalTweetId: submission,
            rankingMode: 'Relevance',
            includePromotedContent: false,
            withCommunity: false,
            withQuickPromoteEligibilityTweetFields: false,
            withBirdwatchNotes: false,
            withVoice: false,
        }),
        features: JSON.stringify({
            rweb_video_screen_enabled: false,
            profile_label_improvements_pcf_label_in_post_enabled: false,
            rweb_tipjar_consumption_enabled: false,
            verified_phone_label_enabled: false,
            creator_subscriptions_tweet_preview_api_enabled: false,
            responsive_web_graphql_timeline_navigation_enabled: false,
            responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
            premium_content_api_read_enabled: false,
            communities_web_enable_tweet_community_results_fetch: false,
            c9s_tweet_anatomy_moderator_badge_enabled: false,
            responsive_web_grok_analyze_button_fetch_trends_enabled: false,
            responsive_web_grok_analyze_post_followups_enabled: false,
            responsive_web_jetfuel_frame: false,
            responsive_web_grok_share_attachment_enabled: false,
            articles_preview_enabled: false,
            responsive_web_edit_tweet_api_enabled: false,
            graphql_is_translatable_rweb_tweet_is_translatable_enabled: false,
            view_counts_everywhere_api_enabled: false,
            longform_notetweets_consumption_enabled: false,
            responsive_web_twitter_article_tweet_consumption_enabled: false,
            tweet_awards_web_tipping_enabled: false,
            responsive_web_grok_show_grok_translated_post: false,
            responsive_web_grok_analysis_button_from_backend: false,
            creator_subscriptions_quote_tweet_preview_enabled: false,
            freedom_of_speech_not_reach_fetch_enabled: false,
            standardized_nudges_misinfo: false,
            tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: false,
            longform_notetweets_rich_text_read_enabled: false,
            longform_notetweets_inline_media_enabled: false,
            responsive_web_grok_image_annotation_enabled: false,
            responsive_web_enhance_cards_enabled: false,
        }),
        fieldToggles: JSON.stringify({
            withArticleRichContentState: false,
            withArticlePlainText: false,
            withGrokAnalyze: false,
            withDisallowedReplyControls: false,
        }),
    });
    const csrf_token = /ct0=([0-9a-f]+)/.exec(document.cookie)?.[1];
    if (!csrf_token) {
        throw new Error('Unable to find CSRF token');
    }
    const path = '/i/api/graphql/_8aYOgEDz35BrBcBal1-_w/TweetDetail';
    const headers = {
        authorization: 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        'x-csrf-token': csrf_token,
        'x-twitter-active-user': 'yes',
        'x-client-transaction-id': await x_client.getTransactionId('GET', path),
    };
    const init = {
        credentials: 'include',
        referrer: window.location.href,
        headers,
    };
    const response = await fetchOk(`https://x.com${path}?${params}`, init);
    const obj = await response.json();
    const tweet = extractTweet(submission, obj);
    const { info, meta } = getTwitterSubmissionData(submission, tweet);
    const file_datas = await getTwitterFileDatas(tweet);
    const downloads = createTwitterDownloads(meta, file_datas, options);
    return await downloadSubmission(info, downloads, undefined, progress);
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function extractTweet(submission, obj) {
    let tweet;
    for (const entrie of obj.data.threaded_conversation_with_injections_v2.instructions[0].entries) {
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
    const user_name = obj.core.user_results.result.legacy.name;
    const user_id = obj.core.user_results.result.legacy.screen_name;
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
async function getTwitterFileDatas(obj) {
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
