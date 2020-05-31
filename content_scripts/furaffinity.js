var as = {furaffinity: {check: {}, download: {}}};

//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

function pageInfo(){
  let page = {
    url: window.location.href,
    site: "furaffinity",
    links: {
      userUrl: "https://www.furaffinity.net/user/{user}",
      submissionUrl: "https://www.furaffinity.net/view/{submission}"
    }
  };
  let split = page.url.split("/");
  page.page = split[3];
  page.modern = $("#ddmenu") ? true : false;

  if (["user", "journals", "journal", "gallery", "scraps", "favorites", "view", "full"].includes(page.page)){
    page.user = /([^ ]+)(?: -- Fur |'s)/.exec($("title").textContent)[1];
  }

  if (["user", "journals", "gallery", "scraps", "favorites"].includes(page.page)){
    page.userLower = split[4];
  }
  else if (["view", "full"].includes(page.page)){
    page.userLower = $(".classic-submission-title a, .submission-id-avatar a").href.split("/")[4];
  }
  else if (page.page == "journal"){
    page.userLower = $(".maintable .avatar-box a, .user-nav .current").href.split("/")[4];
  }

  return page;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.furaffinity.userInfo = async function(user, page, savedlist){
  user.lower = page.userLower;

  let userpage = await fetcher(`https://www.furaffinity.net/user/${user.lower}/`, "document");
  let iconelement = $(userpage, page.modern ? "img.user-nav-avatar" : "img.avatar");

  if (iconelement){
    user.icon = iconelement.src;

    let stats = page.modern ? $(userpage, "div[class^=userpage-section-] .cell") : $(userpage, '[title^="Once"]').parentElement;
    stats = stats.textContent.replace(/\D+/g, " ").trim().split(" ");

    if (page.modern){
      user.stats = new Map([
        ["Submissions", stats[1]],
        ["Favs", stats[2]],
        ["Views", stats[0]]
      ]);
    }
    else {
      user.stats = new Map([
        ["Submissions", stats[1]],
        ["Favorites", stats[5]],
        ["Page Visits", stats[0]]
      ]);
    }
  }
  else {
    user.stats = new Map([]);
    user.icon = $(".submission-id-avatar img, .avatar img").src;
  }

  user.folderMeta = {
    site: user.site,
    userName: user.name,
    userLower: user.lower
  };

  user.saved = (savedlist) ? savedlist[user.lower] || [] : [];

  user.home = `https://www.furaffinity.net/user/${user.lower}`;
  user.gallery = `https://www.furaffinity.net/gallery/${user.lower}`;
  return user;
}

//---------------------------------------------------------------------------------------------------------------------
// main add checks and download buttons to image thumbnails
//---------------------------------------------------------------------------------------------------------------------

as.furaffinity.check.startChecking = function(){
  asLog("Checking Furaffinity");
  let page = pageInfo();
  this.checkPage(page);

  let observer = new MutationObserver((mutationsList, observer) => {
    let changed = [...mutationsList].filter(m => m.attributeName === "id").map(m => m.target);
    //remove art saver buttons
    changed.flatMap(c => $$(c, ".artsaver-check, .artsaver-download")).forEach(e => removeElement(e));
    //remove attribute indicating the submission has already been checked
    changed.forEach(e => $(e, "img").removeAttribute("data-checkstatus"));

    changed = changed.map(c => (c.matches(".preview_img a") ? c.parentElement.parentElement : c));
    this.checkThumbnails(changed, page.userLower);
  });

  globalrunningobservers.push(observer);

  if (page.page === "user"){
    $$('[class*="userpage-first"] > b, .section-body > .preview_img > a').forEach(e => observer.observe(e, { attributes: true }));
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.furaffinity.check.checkPage = function(page){
  this.checkThumbnails(this.getThumbnails(), page.userLower);

  if (["view", "full"].includes(page.page)){
    this.checkSubmission(page.userLower, page.url, page.modern);
  }

  if (page.page === "user"){
    this.checkUserFavorites();
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.furaffinity.check.getThumbnails = function(){
  $$(".preview-gallery-container").forEach(c => {c.style.position = "relative"});

  let previews = [];

  for (let pimg of $$(".section-body > .preview_img")){
    pimg.firstElementChild.style.position = "relative";
    previews.push(pimg.parentElement);
  }

  let profile = $(".section-submission");
  if (profile){
    previews.push(profile);

    if (!$(profile, ".artsaver-holder")){
      let div = document.createElement("div");
      div.className = "artsaver-holder";
      let img = $(profile, "img");
      img.insertAdjacentElement("beforebegin", div);
      div.insertAdjacentElement("afterbegin", img);
    }
  }

  return [...$$(':not(#gallery-latest-favorites) > [id^="sid"], .preview-gallery-container'), ...previews];
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.furaffinity.check.checkThumbnails = function(thumbnails, user){
  for (let figure of thumbnails){
    try {
      let sub = $(figure, "img");
      let url = $(figure, "a").href;
      let subid = parseInt(url.split("/")[4], 10);

      let otheruser = $(figure, 'a[href^="/user/"]');
      let subuser = otheruser ? otheruser.getAttribute("href").split("/")[2] : user;

      addButton("furaffinity", subuser, subid, sub, sub, url);
    }
    catch (err){}
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.furaffinity.check.checkUserFavorites = function(){
  let favdata = JSON.parse(/submission_data\ =\ (.+);/.exec($("#pageid-userpage > div > script, #site-content > script").textContent)[1]);

  for (let fav of $$('#gallery-latest-favorites > [id^="sid"]')){
    try {
      let sub = $(fav, "img");
      let subid = parseInt(/(\d+)/.exec(fav.id)[1], 10);
      let user = favdata[subid].lower;

      addButton("furaffinity", user, subid, sub, sub, $(fav, "a").href);
    }
    catch (err){}
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.furaffinity.check.checkSubmission = function(user, url, modern){
  let submission = $("img#submissionImg");
  if (!submission){
    return;
  }
    //checkSubmission(submission.parentElement);
  if (!submission.matches(".artsaver-holder *")){
    let holder = document.createElement("div");
    holder.className = "artsaver-holder";

    submission.insertAdjacentElement("beforebegin", holder);

    if (modern){
      holder.style.margin = "10px 0";
      holder.style.display = "inline-table";
      holder.insertAdjacentElement("afterbegin", submission);
      submission.style.margin = "0";
    }
    else {
      holder.style.maxWidth = "99%";
      holder.innerHTML = '<div style="display:flex;"></div>';
      holder.firstElementChild.insertAdjacentElement("afterbegin", submission);
      submission.style.maxWidth = "100%";
    }
  }

  try {
    let subid = parseInt(url.split("/")[4], 10);

    addButton("furaffinity", user, subid, submission, submission, url);
  }
  catch (err){}
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------

as.furaffinity.download.startDownloading = async function(pageurl, progress){
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

    let {info, meta} = this.getMeta(response, pageurl, progress);
    let downloads = [{url: info.downloadurl, meta, filename: options.furaffinity.file}];

    let results = await this.handleDownloads(downloads, progress);
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

as.furaffinity.download.getMeta = function(r, url, progress){
  progress.say("Getting meta");
  let info = {}, meta = {};
  meta.site = "furaffinity";
  meta.userName = /([^ ]+)(?: -- )/.exec($(r, "title").textContent)[1];

  info.downloadurl = decodeURI($(r, 'a[href^="//d.facdn.net/art/"]').href);
  let reg = /\/((\d+)\.([^_]+)[^\/]+)\.(\w+)$/.exec(info.downloadurl);
  meta.fileName = reg[1];
  meta.fileId = reg[2];
  meta.userLower = reg[3];
  meta.ext = reg[4];

  meta.submissionId = parseInt(url.split("/")[4], 10);
  meta.title = $(r, "div.classic-submission-title > h2, .submission-title p").textContent;

  info.savedSite = meta.site;
  info.savedUser = meta.userLower;
  info.savedId = meta.submissionId;
  return {info, meta}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.furaffinity.download.handleDownloads = async function(downloads, progress){
  let blobs = await fetchBlobsProgress(downloads, progress);
  progress.saving(blobs.length);

  return await downloadBlobs(blobs);
}