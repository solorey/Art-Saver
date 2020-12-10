var as = {deviantart: {check: {}, download: {}}};

//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

function pageInfo(){
  let page = {
    url: window.location.href,
    site: "deviantart",
    links: {
      userUrl: "https://www.deviantart.com/{1}",
      submissionUrl: "https://www.deviantart.com/deviation/{1}"
    }
  };

  page.eclipse = $("#deviantART-v7") ? false : true;

  let path = new URL(page.url).pathname;

  let reg = /^\/[^\/]+(?:\/([^\/]+))?/.exec(path);
  if (reg){
    page.page = (!reg[1] && $("title").textContent.endsWith(" | DeviantArt"))? "user" : reg[1];
  }

  if (["art", "journal"].includes(page.page)){
    page.user = /by\ ([^\ ]+)\ on\ DeviantArt$/.exec($("title").textContent)[1];
  }
  else if (["about", "user", "gallery", "prints", "favourites", "posts", "shop"].includes(page.page)){
    if (page.eclipse){
      page.user = $("#content-container [data-username]").title;
    }
    else {
      page.user = $$("a.u.username:not(.group)").find(u => u.offsetHeight > 0).textContent;
    }
  }

  return page;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.userInfo = async function(user, page, savedlist){
  let userresponse = await fetcher(`https://www.deviantart.com/_napi/da-user-profile/api/init/gallery?username=${user.name}`);

  let userstats;
  if (userresponse.ok){
    userstats = await userresponse.json();

    user.icon = userstats.pageData.gruser.usericon;

    let us = userstats.pageData.stats;
    user.stats = new Map([
      ["Deviations", us.deviations],
      ["Favourites", us.favourites],
      ["Views", us.pageviews]
    ]);
  }
  else {
    user.stats = new Map([]);
    user.icon = $(`img[title=${user.name}], img[alt="${user.name}'s avatar"]`).src;
  }

  user.folderMeta = {
    site: user.site,
    userName: user.name
  };

  user.saved = savedlist ? savedlist[user.name] || [] : [];

  user.home = `https://www.deviantart.com/${user.name}`;
  user.gallery = `https://www.deviantart.com/${user.name}/gallery/${page.eclipse ? "all" : "?catpath=/"}`;

  return user;
}

//---------------------------------------------------------------------------------------------------------------------
// main add checks and download buttons to image thumbnails
//---------------------------------------------------------------------------------------------------------------------

as.deviantart.check.startChecking = function(){
  asLog("Checking Deviantart");
  let page = pageInfo();
  this.checkPage(page);

  let thumbselect = ".thumb, [data-hook=deviation_link]";

  let pageobserver = new MutationObserver((mutationsList, observer) => {
    let diffpage = false;
    let newnodes = mutationsList.flatMap(m => [...m.addedNodes]);

    if (page.url !== window.location.href || newnodes.some(n => $("title").contains(n))){
      diffpage = true;
      page = pageInfo();
    }

    if (page.page === "art" && page.eclipse && diffpage){
      let submission = $("[data-hook=art_stage]");
      $$(submission, "[data-checkstatus]").forEach(e => e.removeAttribute("data-checkstatus"));
      $$(submission, "[class^=artsaver]").forEach(e => $remove(e));

      this.checkPage(page);
    }
    else if (newnodes.some(n => n.nodeType === 1 && (n.matches(thumbselect) || $(n, thumbselect)))){
      this.checkPage(page);
    }
  });

  globalrunningobservers.push(pageobserver);
  pageobserver.observe(document, { childList: true, subtree: true });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.check.checkPage = function(page){
  this.checkThumbnails(this.getThumbnails());

  if (page.page === "art" && !page.eclipse){
    this.checkSubmission(page.user, page.url);
  }

  if (!page.eclipse){
    return;
  }

  let popup = $("[id^=popper-root]");
  if (popup){
    this.checkPopupEclipse(popup);
  }

  this.checkThumbnailsEclipse(this.getThumbnailsEclipse());

  if (page.page === "art"){
    this.checkSubmissionEclipse(page.user, page.url);
  }

}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.check.getThumbnails = function(){
  let thumbnails = [];

  for (let thumb of $$(".thumb, .embedded-image-deviation")){
    //----------------------------------------------
    //current unsupported thumbs
    //                  literature,       journals,  gallery folder preview images
    if (thumb.matches(".lit, .literature, .freeform, div.stream.col-thumbs *")){
      continue;
    }
    //----------------------------------------------
    //devations in "more from <user>/deviantart" or in "<user> added to this collection"
    if (thumb.matches(".tt-crop, #gmi-ResourceStream > *")){
      thumb.style.position = "relative";
    }
    //devations in texts
    else if (thumb.matches(".shadow > *") && !$(thumb, ".artsaver-holder")){
      let holder = $insert($(thumb, "img"), "div", {position: "parent", class: "artsaver-holder"});
    }

    thumbnails.push(thumb);
  }

  return thumbnails;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.check.checkThumbnails = function(thumbnails){
  for (let thumb of thumbnails){
    try {
      let url = thumb.getAttribute("href") || $(thumb, "a").href;
      let subid = parseInt(url.split("-").pop(), 10);
      let sub = $(thumb, "img");
      let user = thumb.getAttribute("data-super-alt");
      user = user ? user.split(" ").pop() : sub.alt.split(" ").pop();

      addButton("deviantart", user, subid, sub, sub, url);
    }
    catch (err){}
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//Depreciated

as.deviantart.check.checkSubmission = function(user, url){
  let submissions = $$("div.dev-view-deviation");
  if (submissions.length === 0){
    return;
  }

  let view = ($("#output").style.display === "none" && submissions.length > 1) ? submissions[1] : submissions[0];
  try {
    let holder = $(view, ".artsaver-holder");
    if (!holder){
      holder = $create("div");
      holder.className = "artsaver-holder";
      holder.onclick = function(){this.style.display = "table"};

      let subchildren = [...view.children];
      view.insertAdjacentElement("afterbegin", holder);
      subchildren.forEach(c => holder.insertAdjacentElement("beforeend", c));
    }

    let submission = $(view, "img, #gmi-FilmPlayer");
    let subid = parseInt(url.split("-").pop(), 10);

    let button = addButton("deviantart", user, subid, submission, submission, url, "afterend", false);
    if (button){
      button.style.display = "";
    }
  }
  catch (err){}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Eclipse

as.deviantart.check.getThumbnailsEclipse = function(){
  let thumbnails = [];
  for (let thumb of $$("[data-hook=deviation_link]")){
    //filter out journals
    if (/\/journal\//.test(thumb.href)){
      continue;
    }
    if (thumb.parentElement.matches("[data-hook=deviation_std_thumb]")){
      thumb = thumb.parentElement;
      //filter out literature
      if ($(thumb, "section > h3")){
        continue;
      }
    }
    thumbnails.push(thumb);
  }
  return thumbnails;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.check.checkThumbnailsEclipse = function(thumbnails){
  for (let thumb of thumbnails){
    try {
      let url = thumb.getAttribute("href") || $(thumb, "a").href;
      let subid = parseInt(url.split("-").pop(), 10);
      let sub = $(thumb, "img");
      let user = ($(thumb, ".user-link") || thumb).getAttribute("title").split(" ").pop();

      let anchor = (thumb.nodeName === "A") ? thumb : $(thumb, "a");
      addButton("deviantart", user, subid, sub, anchor, url, "beforeend");
    }
    catch (err){}
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.check.checkPopupEclipse = function(popup){
  let user = $(popup, "[data-hook=user_link]").title;
  for (let thumb of $$(popup, "[data-hook=deviation_link]")){
    try {
      thumb.firstElementChild.style.position = "relative";
      let url = thumb.href;
      let subid = parseInt(url.split("-").pop(), 10);
      let sub = $(thumb, "img");

      addButton("deviantart", user, subid, sub, sub, url);
    }
    catch (err){}
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.check.checkSubmissionEclipse = function(user, url){
  try {
    let stage = $("[data-hook=art_stage]");
    let submission = $(stage, "img, [data-hook=react-playable]");
    submission.parentElement.style.position = "relative";
    let subid = parseInt(url.split("-").pop(), 10);

    addButton("deviantart", user, subid, submission, submission, url, "afterend", false);
  }
  catch (err){}
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------
//submission - https://www.deviantart.com/_napi/shared_api/deviation/extended_fetch?deviationid=<sumbissionId>&type=art&include_session=false
//user       - https://www.deviantart.com/_napi/da-user-profile/api/init/gallery?username=<userName>
//gallery    - https://www.deviantart.com/_napi/da-user-profile/api/gallery/contents?username=<userName>&offset=0&limit=24&all_folder=true&mode=newest //24 is max
//rss        - https://backend.deviantart.com/rss.xml?q=+sort:time+by:<userName>+-in:journals&type=deviation

as.deviantart.download.startDownloading = async function(pageurl, progress){
  let options = await getOptions();

  try {
    progress.say("Getting image page");

    let params = new URLSearchParams({
      deviationid: pageurl.split("-").pop(),
      type: "art",
      include_session: false
    });
    let response = await fetcher(`https://www.deviantart.com/_napi/shared_api/deviation/extended_fetch?${params}`, "json");
    let {info, meta} = await this.getMeta(response, options, progress);

    let downloads = [{url: info.downloadurl, meta, filename: options.deviantart.file}];

    let stashworker;
    if (options.deviantart.stash && info.stash.length > 0){
      progress.say("Getting stash meta");
      stashworker = new Worker(browser.runtime.getURL("/workers/stashworker.js"));
      stashworker.postMessage({function: "getstash", stashurls: info.stash});

      let stashes = await new Promise((resolve, reject) => {
        stashworker.onmessage = m => {
          if (m.data.message === "gotstash"){
            resolve(m.data.stash);
          }
        }
      });

      let stashdownloads = stashes.map(s => ({
        url: s.info.downloadurl,
        meta: {...meta, ...s.meta},
        filename: options.deviantart.stashFile
      }));

      downloads = downloads.concat(stashdownloads);
    }

    let results = await this.handleDownloads(downloads, options, progress, stashworker);
    if (results.some(r => r.response === "Success")){
      progress.say("Updating");
      await updateList(info.savedSite, info.savedUser, info.savedId);
    }

    progress.remove();
    reCheck();

    return {
      status: "Success",
      submission: {
        url: pageurl,
        user: info.savedUser,
        id: info.savedId,
        title: downloads[0].meta.title
      },
      files: results
    };
  }
  catch (err){
    asLog(err);
    progress.error();

    return {
      status: "Failure",
      error: err,
      url: pageurl,
      progress
    };
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.download.getMeta = async function(r, options, progress){
  r = r.deviation;
  progress.say("Getting meta");
  let info = {}, meta = {};
  meta.site = "deviantart";
  meta.title = r.title;
  meta.userName = r.author.username;
  meta.submissionId = r.deviationId;
  meta.submissionId36 = r.deviationId.toString(36);

  info.savedSite = meta.site;
  info.savedUser = meta.userName;
  info.savedId = meta.submissionId;

  //find stash in description
  let stashreg = /"(https:\/\/sta\.sh\/.+?)"/g;
  let stashresult;
  let stashurls = [];
  while ((stashresult = stashreg.exec(r.extended.description)) !== null) {
    stashurls.push(stashresult[1]);
  }
  info.stash = [...new Set(stashurls)];

  if (r.isDownloadable){ //the user is cool; downloading full resolution is easy
    info.downloadurl = r.extended.download.url;
  }
  else { //the user is uncool; downloading is hard and often full resolution is not available
    //Usually
    //type.c = image
    //type.s = swf
    //type.b = mp4, gif
    let type = r.media.types.filter(m => m.f && (m.t === "fullview" || m.s || m.b)).pop();

    let url = (type.t === "fullview") ? (type.c ? `${r.media.baseUri}/${type.c}` : r.media.baseUri) : type.s || type.b;

    if (r.media.prettyName){
      url = url.replace(/<prettyName>/g, r.media.prettyName);
    }
    if (r.media.token){
      url = `${url}?token=${r.media.token[0]}`;
    }
    //Make sure quailty is 100
    //Replacing .jpg with .png can lead to better quailty
    if (/\/v1\/fill\//.test(url)){
      url = url.replace(/q_\d+/, "q_100").replace(".jpg?", ".png?");
    }
    //flash with no download button
    if (/\/\/sandbox/.test(url)){
      let embedded = await fetcher(url, "document");
      url = $(embedded, "#sandboxembed").src;
    }

    info.downloadurl = url;
  }

  let reg = /\/([^\/?]+)\.(\w+)(?:\?token=.+)?$/;
  let fileinfo = reg.exec(info.downloadurl);
  meta.fileName = r.media.prettyName || fileinfo[1];
  meta.ext = fileinfo[2];

  if (info.downloadurl.search("/v1/fill/") === -1 || !options.deviantart.larger){
    return {info, meta};
  }
  progress.say("Comparing images");
  info.downloadurl = await compareUrls(info.downloadurl, options);
  //update extension in case it is different
  meta.ext = reg.exec(info.downloadurl)[2];
  return {info, meta};
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.download.handleDownloads = async function(downloads, options, progress, stashworker){
  if (options.deviantart.moveFile && downloads.length > 1){
    let stashfolder = /.*\//.exec(options.deviantart.stashFile);
    let newf = options.deviantart.file.split("/").pop();
    if (stashfolder){
      newf = stashfolder[0] + newf;
    }
    downloads[0].filename = newf;
    downloads[0].meta = downloads[1].meta;
  }

  let blobs = await fetchBlobsProgress([downloads[0]], progress);

  if (stashworker){
    progress.start();
    progress.say("Starting stash download");

    stashworker.postMessage({function: "downloadstash", stashdownloads: downloads.slice(1)});

    let stashblobs = await new Promise((resolve, reject) => {
      stashworker.onmessage = m => {
        switch (m.data.message){
          case "progress":
            if (m.data.say){
              progress.say(m.data.say);
            }
            if (m.data.width){
              progress.width(m.data.width);
            }
            break;

          case "gotblobs":
            stashworker.terminate();
            resolve(m.data.blobs);
        }
      }
    });

    blobs = blobs.concat(stashblobs);
  }

  progress.saving(blobs.length);

  return await downloadBlobs(blobs);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function compareUrls(url, options){
  //old larger url link
  //downloadurl = `https://${u[2]}/intermediary/f/${u[4]}/${u[5]}/v1/fill/w_5100,h_5100,q_100,bl/${u[9].split("?token=")[0]}`;
  //possible new larger link
  let u = url.split("/");
  let newurl = `https://${u[2]}/intermediary/f/${u[4]}/${u[5]}`;

  let compare = await Promise.all([getImage(url), getImage(newurl)]);
  if (compare[0].resolution < compare[1].resolution){
    url = newurl;
  }

  return url;
}

async function getImage(imgsrc){
  let result = await Promise.all([imgSize(imgsrc), imgDim(imgsrc)]);
  return {
    url: imgsrc,
    filesize: result[0],
    resolution: result[1]
  };

  async function imgSize(src){
    let imgres = await fetcher(src);
    return (imgres.ok) ? parseInt(imgres.headers.get("content-length"), 10) : 0;
  }

  function imgDim(src){
    return new Promise((resolve, reject) => {
      let img = new Image;
      img.onload = function(){ resolve(this.width * this.height); };
      img.onerror = () => resolve(0);
      img.src = src;
    });
  }
}