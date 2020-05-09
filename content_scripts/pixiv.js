var as = {pixiv: {check: {}, download: {}}};

//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

function pageInfo(){
  let page = {
    url: window.location.href,
    site: "pixiv",
    links: {
      userUrl: "https://www.pixiv.net/users/{user}",
      submissionUrl: "https://www.pixiv.net/artworks/{submission}"
    }
  };
  if (/\/novel\//.test(page.url)){
    page.page = "novel";
  }
  else if (/\/bookmarks\//.test(page.url)){
    page.page = "bookmarks";
  }
  else if (/\/(following|mypixiv)/.test(page.url)){
    page.page = "following";
  }
  else if (/\/users\/\d+\/(artworks|artworkrations|manga|novels)/.test(page.url)){
    page.page = "gallery";
  }
  else if (/\/artworks\//.test(page.url)){
    page.page = "artwork";
  }
  else if (/\/users\//.test(page.url)){
    page.page = "user";
  }

  if (["gallery", "novels", "user", "bookmarks"].includes(page.page)){
    page.user = $("h1").textContent;
    page.userId = /\/(\d+)/.exec(page.url)[1];
  }
  else if (["artwork", "novel"].includes(page.page)){
    let userelem = $('a[href*="/users/"]:nth-of-type(2)');
    page.user = userelem.textContent;
    page.userId = userelem.href.split("/").pop();
  }
  else if (["following"].includes(page.page)){
    page.userId = /\/(\d+)/.exec(page.url)[1];
    page.user = $$(`a[href$="/users/${page.userId}"]`).pop().textContent;
  }

  return page;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.pixiv.userInfo = async function(user, page, savedlist){
  user.id = page.userId;

  let userpage = await fetcher(`https://www.pixiv.net/ajax/user/${user.id}`, "json");
  let iconblob = await fetcher(userpage.body.imageBig, "blob");
  user.icon = await browser.runtime.sendMessage({
    function: "createobjecturl",
    object: iconblob
  });

  let statspages = await Promise.all([
    fetcher(`https://www.pixiv.net/touch/ajax/user/home?id=${user.id}`, "json"),
    fetcher(`https://www.pixiv.net/ajax/user/${user.id}/illusts/bookmarks?tag=&offset=0&limit=1&rest=show`, "json")
  ]);

  user.stats = new Map([
    ["Submissions", statspages[0].body.work_sets.all.total],
    ["Bookmarks", statspages[1].body.total]
  ]);

  user.folderMeta = {
    site: user.site,
    userName: user.name,
    userId: user.id
  };

  user.saved = savedlist ? savedlist[user.id] || [] : [];

  user.home = `https://www.pixiv.net/users/${user.id}`;
  user.gallery = `https://www.pixiv.net/users/${user.id}/artworks`;

  return user;
}

//---------------------------------------------------------------------------------------------------------------------
// main add checks and download buttons to image thumbnails
//---------------------------------------------------------------------------------------------------------------------

as.pixiv.check.startChecking = function(){
  asLog("Checking Pixiv");
  let page = pageInfo();
  this.checkPage(page);

  let observer = new MutationObserver((mutationsList, observer) => {
    if (page.url !== window.location.href){
      page = pageInfo();
    }
    //console.log(mutationsList);
    // let recheck = false;
    let newnodes = mutationsList.flatMap(m => [...m.addedNodes]).filter(n => n.nodeType === 1);

    if (page.page === "artwork" && newnodes.some(n => n.matches(".artsaver-holder ~ *"))){
      removeElement($('div[role="presentation"] .artsaver-holder'));
      this.checkPage(page);
    }
    else if (newnodes.some(n => $(n, 'a[href*="/artworks/"], canvas') || n.nodeName === "IMG")){
      this.checkPage(page);
    }
    return;
  });

  globalrunningobservers.push(observer);
  observer.observe($("body"), { childList: true, subtree: true });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.pixiv.check.checkPage = function(page){
  if (page.page === "following"){
    this.checkFollowing();
  }

  let popupsm = $("section._profile-popup");
  if (popupsm){
    this.checkPopupSmall(popupsm);
  }

  let popuplg = $('div[role="none"]');
  if (popuplg){
    this.checkPopupLarge(popuplg);
  }

  this.checkThumbnails(this.getThumbnails(), page.userId);

  if (page.page === "artwork"){
    this.checkSubmission(page.userId, page.url);
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.pixiv.check.checkPopupSmall = function(popup){
  let user = /\/(\d+)/.exec($(popup, 'a[href*="/users/"]').href)[1];
  for (let sub of $$(popup, "a.item")){
    let url = sub.href;
    let subid = parseInt(/\/(\d+)$/.exec(url)[1], 10);

    addButton("pixiv", user, subid, sub, sub, url, "beforeend");
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.pixiv.check.checkPopupLarge = function(popup){
  let userId = /\/(\d+)/.exec($(popup, "a").href)[1];
  this.checkThumbnails(this.getThumbnails(popup), userId);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.pixiv.check.checkFollowing = function(){
  let rows = $$('li[type="following"], li[type="mypixiv"]');
  for (let r of rows){
    let userId = $(r, "a").href.split("=")[1];
    this.checkThumbnails($$(r, "li"), userId);
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.pixiv.check.getThumbnails = function(parent = document){
  let thumbnails = [];

  for (let n of $$(parent, 'a[href*="/artworks/"] img:not([data-checkstatus="checked"])').map(a => a.parentElement)){
    let thumb = n;
    while ($$(n, 'a[href*="/artworks/"] img').length === 1 && n.nodeName !== "UL"){
      thumb = n;
      n = n.parentElement;
    }

    thumbnails.push(thumb);
  }

  return thumbnails;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.pixiv.check.checkThumbnails = function(thumbnails, user){
  for (let element of thumbnails){
    try {
      let a = $(element, 'a[href*="/artworks/"]');
      let url = a.href;
      let subid = parseInt(/\/(\d+)$/.exec(url)[1], 10);
      let sub = $(a, "img");

      let userlink = $(element, 'a[href*="/users/"]');
      let subuser = userlink ? /\/(\d+)/.exec(userlink.href)[1] : user;

      addButton("pixiv", subuser, subid, sub, a, url, "beforeend");
    }
    catch (err){}
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.pixiv.check.checkSubmission = function(user, url){
  let presentation = $("figure > [role=presentation]");
  if (!presentation){
    return;
  }

  try {
    let submission = $(presentation, "a > img, canvas");
    if (submission.nodeName === "CANVAS"){
      submission.parentElement.style = "display:flex; justify-content:center;";
    }
    let subid = parseInt(/\/(\d+)$/.exec(url)[1], 10);

    let holder = $(presentation, ".artsaver-holder");
    if (!holder){
      holder = document.createElement("div");
      holder.className = "artsaver-holder";

      submission.insertAdjacentElement("beforebegin", holder);
    }

    holder.style = `position:absolute; width:${submission.width}px; height:${submission.height}px;`;

    let resize = new ResizeObserver(entries => {
      let change = [...entries].pop().contentRect;
      holder.style.height = `${change.height}px`;
      holder.style.width = `${change.width}px`;
    });
    globalrunningobservers.push(resize);
    resize.observe(submission);

    addButton("pixiv", user, subid, submission, holder, url, "beforeend");
  }
  catch (err){}
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------

as.pixiv.download.startDownloading = async function(pageurl, progress){
  let options = await getOptions();

  try {
    let ajaxurl = "https://www.pixiv.net/ajax/illust/" + /\/(\d+)$/.exec(pageurl)[1];

    progress.say("Getting image page");
    let response = await fetcher(ajaxurl, "json");

    let {info, meta} = await this.getMeta(response, ajaxurl, options, progress);
    let downloads = this.createDownloads(info, meta, options);

    let results = await this.handleDownloads(downloads, info, options, progress);

    progress.say("Updating");
    await updateList(info.savedSite, info.savedUser, info.savedId);

    progress.remove();
    reCheck();
  }
  catch (err){
    asLog(err);
    progress.error();
  }
  return;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.pixiv.download.getMeta = async function(r, url, options, progress){
  let info = {}, meta = {};
  meta.site = "pixiv";
  meta.submissionId = parseInt(r.body.id, 10);
  meta.userName = r.body.userName;
  meta.userId = r.body.userId;
  meta.title = r.body.title;
  info.downloadurl = r.body.urls.original;
  let reg = /\/(\d+_.+)\.(.+)$/.exec(info.downloadurl);
  meta.fileName = reg[1];
  meta.ext = reg[2];

  info.savedSite = meta.site;
  info.savedUser = meta.userId;
  info.savedId = meta.submissionId;

  info.pages = r.body.pageCount;

  if (r.body.illustType === 2){
    info.isUgoira = true;
    progress.say("Getting ugoira meta");
    let u = await fetcher(`${url}/ugoira_meta`, "json");
    info.width = r.body.width;
    info.height = r.body.height;
    info.pages = u.body.frames.length;
    info.delays = u.body.frames.map(f => f.delay);
  }
  return {info, meta};
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.pixiv.download.createDownloads = function(info, meta, options){
  if (info.pages === 1){
    return [{url: info.downloadurl, meta, filename: options.pixiv.file}];
  }

  let downloads = [];
  let reg = /(.+\/)([^\/]+)0(\..+)$/.exec(info.downloadurl);

  for (let i = 0, pages = info.pages; i < pages; i++){
    let fileName = `${reg[2]}${i}`;
    downloads.push({
      url: `${reg[1]}${fileName}${reg[3]}`,
      filename: options.pixiv.multiple,
      meta: {...meta, fileName, page: `${i + 1}`}
    });
  }

  return downloads;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.pixiv.download.handleDownloads = async function(downloads, info, options, progress){
  progress.start();
  progress.say("Starting download");

  let blobs = await fetchBlobsProgress(downloads, progress);

  let type = options.pixiv.ugoira;
  if (!info.isUgoira || type === "multiple"){
    progress.saving(blobs.length);
    return await downloadBlobs(blobs);
  }
  //convert ugoira based on option choosen
  progress.start();
  progress.say(`Staring ${type} process`);

  let justblobs = blobs.map(b => b.blob);
  let convertedblob;
  switch(type){
    case "apng":
    case "gif":
      convertedblob = await convertUgoira(type, justblobs, info.width, info.height, info.delays, progress);
      break;

    case "webm":
      convertedblob = await recordUgoira(type, justblobs, info.width, info.height, info.delays, progress);
      break;

    case "zip":
      let exts = downloads.map(d => d.meta.ext);
      convertedblob = await createZip(justblobs, exts, info.delays, progress);
      break;
  }

  let convertedmeta = downloads[0].meta;
  convertedmeta.ext = type.replace("apng", "png");
  delete convertedmeta.page;

  blobs = [{blob: convertedblob, filename: options.pixiv.file, meta: convertedmeta}];
  progress.saving(blobs.length);
  return await downloadBlobs(blobs);
}

//---------------------------------------------------------------------------------------------------------------------
// worker functions
//---------------------------------------------------------------------------------------------------------------------

async function createZip(blobs, exts, delays, progress){
  progress.width(100);
  progress.say("Creating zip");

  return await fileWorker("zip", {blobs, exts, delays});
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function convertUgoira(type, blobs, width, height, delays, progress){
  progress.say("Preparing frames");

  let imgbitmaps = await fileWorker("bitmaps", {blobs, width, height});

  let canvas = document.createElement("canvas");
  canvas.width  = width;
  canvas.height = height;
  let ctx = canvas.getContext("2d");

  let frames = [];
  for (let bm of imgbitmaps){
    ctx.drawImage(bm, 0, 0);
    frames.push(ctx.getImageData(0, 0, width, height));
  }

  progress.width(100);
  progress.say(`Creating ${type}`);

  return await fileWorker(type, {frames, width, height, delays});
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function recordUgoira(type, blobs, width, height, delays, progress){
  progress.say("Preparing frames");

  let imgbitmaps = await fileWorker("bitmaps", {blobs, width, height});
  let frames = imgbitmaps.map((bm, i) => ({img: bm, delay: delays[i]}));

  let canvas = document.createElement("canvas");
  canvas.width  = width;
  canvas.height = height;
  canvas.style.display = "none";
  document.body.appendChild(canvas);
  let ctx = canvas.getContext("2d");

  progress.width(100);
  progress.say(`Recording ${type}`);

  let stream = canvas.captureStream();
  let recorder = new MediaRecorder(stream);

  startCapturing();
  recorder.start();

  function startCapturing(){
    if (frames.length > 0){
      let frame = frames.shift();
      ctx.drawImage(frame.img, 0, 0);

      setTimeout(() => startCapturing(), frame.delay);
    }
    else {
      recorder.stop();
    }
  }

  return await new Promise((resolve, reject) => {
    recorder.ondataavailable = data => {
      removeElement(canvas);
      resolve(new Blob([data.data], {type: `video/${type}`}));
    };
  });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function fileWorker(type, data){
  let fileworker = new Worker(browser.runtime.getURL("/workers/fileworker.js"));
  fileworker.postMessage({type, data});

  return await new Promise((resolve, reject) => {
    fileworker.onmessage = message => {
      fileworker.terminate();
      resolve(message.data);
    }
  });
}