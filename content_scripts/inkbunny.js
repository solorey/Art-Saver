var as = {inkbunny: {check: {}, download: {}}};

//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

function pageInfo(){
  let page = {
    url: window.location.href,
    site: "inkbunny",
    links: {
      userUrl: "https://inkbunny.net/{user}",
      submissionUrl: "https://inkbunny.net/s/{submission}"
    }
  };

  let path = new URL(page.url).pathname;

  let reg = /^\/([^\/\.]+)(?:\/([^\/]+))?/.exec(path);
  if (reg){
    page.page = (!reg[2] && $("title").textContent.split(" |")[0].endsWith("< Profile"))? "user" : reg[1];
  }
  if (page.page === "s"){
    page.page = "submission";
  }
  else if (page.page === "j"){
    page.page = "journal";
  }

  if (["user", "gallery", "scraps", "journals", "journal", "submission", "poolslist"].includes(page.page)){
    page.user = $('.elephant_555753 a[href^="https://inkbunny.net/"] > img').alt;
  }
  else if (["submissionsviewall"].includes(page.page)){
    let imgicon = 'a[href^="https://inkbunny.net/"] > img';
    let userimage = $(`.elephant_555753 ${imgicon}, .elephant_888a85 ${imgicon}`);
    if (userimage){
      page.user = userimage.alt;
    }
  }
  return page;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.inkbunny.userInfo = async function(user, page, savedlist){
  let userpage = await fetcher(`https://inkbunny.net/${user.name}`, "document");

  if (userpage instanceof Error){
    user.icon = $(`img[alt=${user.name}]`).src;
    user.id = "{userId}";
    user.stats = new Map([]);
  }
  else {
    user.icon = $(userpage, '.elephant_555753 a[href^="https://inkbunny.net/"] > img').src;
    user.id = $(userpage, 'a[href*="user_id="]').href.split("=").pop();

    let favpage = await fetcher(`https://inkbunny.net/userfavorites_process.php?favs_user_id=${user.id}`, "document");

    let stats = $$(userpage, ".elephant_babdb6 .content > div > span strong").map(s => s.textContent.replace(/,/g, ""));
    user.stats = new Map([
      ["Submissions", stats[1]],
      ["Favorites", $(favpage,  ".elephant_555753 .content > div:first-child").textContent.split(" ")[0].replace(/,/g, "")],
      ["Views", stats[4]]
    ]);
  }

  user.folderMeta = {
    site: user.site,
    userName: user.name,
    userId: user.id
  };

  user.saved = savedlist ? savedlist[user.name] || [] : [];

  user.home = `https://inkbunny.net/${user.name}`;
  user.gallery = `https://inkbunny.net/gallery/${user.name}`;
  return user;
}

//---------------------------------------------------------------------------------------------------------------------
// main add checks and download buttons to image thumbnails
//---------------------------------------------------------------------------------------------------------------------

as.inkbunny.check.startChecking = function(){
  asLog("Checking Inkbunny");
  let page = pageInfo();
  this.checkPage(page);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.inkbunny.check.checkPage = function(page){
  this.checkThumbnails(this.getThumbnails(), page.user);

  if (page.page === "submission"){
    this.checkSubmission(page.user, page.url);
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.inkbunny.check.getThumbnails = function(){
  let widgets = $$(".widget_imageFromSubmission");
  for (let parent of $$("#files_area, .content.magicboxParent")){
    widgets = widgets.filter(w => !parent.parentElement.contains(w));
  }
  return widgets;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.inkbunny.check.checkThumbnails = function(thumbnails, user){
  for (let widget of thumbnails){
    try {
      let sub = $(widget, "img");
      let url = $(widget, "a").href;
      let subid = parseInt(/\/(\d+)/.exec(url)[1], 10);

      let otheruser = /\sby\ (\w+)(?:$|(?:\ -\ ))/.exec(sub.alt);
      let subuser = otheruser ? otheruser[1] : user;

      addButton("inkbunny", subuser, subid, sub, sub, url);
    }
    catch (err){}
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.inkbunny.check.checkSubmission = function(user, url){
  let contentbox = $(".content.magicboxParent");
  if (!contentbox){
    return;
  }

  try {
    let subid = parseInt(/\/(\d+)/.exec(url)[1], 10);
    let submission = $(contentbox, "#magicbox, .widget_imageFromSubmission img, #mediaspace");

    let holder = $(contentbox, ".artsaver-holder");
    if (!holder){
      holder = $insert(submission, "div", "parent");
      holder.className = "artsaver-holder";
    }

    addButton("inkbunny", user, subid, submission, holder, url, "beforeend", false);
  }
  catch (err){}
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------

as.inkbunny.download.startDownloading = async function(pageurl, progress){
  let options = await getOptions();

  try {
    let response;
    if (pageurl !== window.location.href){
      progress.say("Getting image page");
      response = await fetcher(pageurl, "document");
    }
    else {
      response = document;
    }

    let {info, meta} = this.getMeta(response, progress);
    let downloads = await this.createDownloads(info, meta, options, progress);

    let results = await this.handleDownloads(downloads, progress);
    if (results.some(r => r === "Success")){
      progress.say("Updating");
      await updateList(info.savedSite, info.savedUser, info.savedId);
    }

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

as.inkbunny.download.getMeta = function(r, progress){
  progress.say("Getting meta");
  let info = {}, meta = {};
  meta.site = "inkbunny";
  meta.title = $(r, "#pictop h1").textContent;
  meta.userName = $(r, '#pictop a[href^="https://inkbunny.net/"] > img').alt;
  try {
    meta.userId = $(r, 'a[href*="user_id"]').href.split("=").pop(); //unavailable when logged out
  }
  catch (err){}

  meta.submissionId = parseInt(/\/(\d+)/.exec($(r, '[rel="canonical"]').href)[1], 10);

  info.savedSite = meta.site;
  info.savedUser = meta.userName;
  info.savedId = meta.submissionId;

  info.pages = 1;

  let pages = $(r, "#files_area span");
  if (pages){
    let p = pages.textContent.split(" ");
    info.thisPage = parseInt(p[0], 10);
    info.pages = parseInt(p[2], 10);
  }

  let pm = this.getPageMeta(r);
  return {info: {...info, ...pm.info}, meta: {...meta, ...pm.meta}};
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.inkbunny.download.getPageMeta = function(r){
  let info = {}, meta = {};

  let pages = $(r, "#files_area span");
  if (pages){
    meta.page = pages.textContent.split(" ")[0];
  }

  let sub = $(r, ".content.magicboxParent");
  //Check if these elements exist in order
  let downloadlink = $(sub, 'a[download=""]') || $(sub, 'a[href^="https://tx.ib.metapix.net/files/full/"]') || $(sub, 'img[src*=".ib.metapix.net/files/"]');

  info.downloadurl = decodeURI(downloadlink.href || downloadlink.src);

  let reg = /\/((\d+)_.+)\.(.+)$/.exec(info.downloadurl);
  meta.fileName = reg[1];
  meta.fileId = reg[2];
  meta.ext = reg[3];

  return {info, meta};
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.inkbunny.download.createDownloads = async function(info, meta, options, progress){
  let downloads = [{url: info.downloadurl, meta: meta, filename: options.inkbunny.file}];
  if (info.pages === 1){
    return downloads;
  }
  else {
    downloads[0].filename = options.inkbunny.multiple;
  }

  let results = [];
  for (let i = 1, pages = info.pages; i <= pages; i++){
    if (i === info.thisPage){
      continue;
    }

    progress.say(`Getting pages ${i}`);

    while (true){
      let page = await fetcher(`https://inkbunny.net/s/${meta.submissionId}-p${i}`, "document");
      if (page instanceof Error){
        await timer(4000);
      }
      else {
        results.push(page);
        break;
      }
    }
  }

  for (let r of results){
    let pm = this.getPageMeta(r);
    downloads.push({
      url: pm.info.downloadurl,
      filename: options.inkbunny.multiple,
      meta: {...meta, ...pm.meta}
    });
  }

  return downloads;
}

async function timer(ms){
  return await new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.inkbunny.download.handleDownloads = async function(downloads, progress){
  let blobs = await fetchBlobsProgress(downloads, progress);
  progress.saving(blobs.length);

  return await downloadBlobs(blobs);
}