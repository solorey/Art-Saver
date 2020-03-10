addTable("dev-user-folder", tableMaker(["site", "userName"]));
addTable("dev-file", tableMaker(["site", "userName", "title", "submissionId", "submissionId36", "fileName", "ext"]));
addTable("dev-stash", tableMaker(["site", "userName", "title", "submissionId", "submissionId36", "fileName", "ext", "stashUrlId", "stashUserName", "stashTitle", "stashSubmissionId", "stashFileName", "stashExt"]));

addTable("pix-user-folder", tableMaker(["site", "userName", "userId"]));
addTable("pix-file", tableMaker(["site", "userName", "userId", "title", "submissionId", "fileName", "ext"]));
addTable("pix-multiple", tableMaker(["site", "userName", "userId", "title", "submissionId", "fileName", "page", "ext"]));

addTable("fur-user-folder", tableMaker(["site", "userName", "userLower"]));
addTable("fur-file", tableMaker(["site", "userName", "userLower", "title", "submissionId", "fileName", "fileId", "ext"]));

addTable("ink-user-folder", tableMaker(["site", "userName", "userId"]));
addTable("ink-file", tableMaker(["site", "userName", "userId", "title", "submissionId", "fileName", "fileId", "ext"]));
addTable("ink-multiple", tableMaker(["site", "userName", "userId", "title", "submissionId", "fileName", "fileId", "page", "ext"]));

//restore options on page load
document.addEventListener("DOMContentLoaded", () => {
  browser.storage.local.get("options").then(res => {
    res.options ? setOptions(res.options) : setDefault();

    fixFormat();
  });
});

userlistDetails();

$("#userlist").oninput = function(){
  $("#filename").textContent = this.files[0].name;
};

$("#submit-list").onclick = async () => {
  try {
    let jsonfile = await getJSON($("#userlist").files[0]);
    await browser.storage.local.set({
      userlist: cleanUserList(jsonfile)
    });
    userlistDetails();
  }
  catch (err){}
};

//makes sure that the saved ids are an array of unique desending integers
function cleanUserList(userlist){
  for (let site in userlist){
    for (let user in userlist[site]){
      userlist[site][user] = [...new Set(userlist[site][user].map(n => parseInt(n, 10)))].sort((a, b) => b - a);
      if (userlist[site][user].length === 0){
        delete userlist[site][user];
      }
    }
    if (Object.keys(userlist[site]).length === 0){
      delete userlist[site];
    }
  }
  return userlist;
}

$("#export-list").onclick = async () => {
  let res = await browser.storage.local.get("userlist");
  let blob = new Blob([JSON.stringify(res.userlist)], {type : "application/json"});

  browser.downloads.download({
    url: window.URL.createObjectURL(blob),
    filename: "Userlist.json",
    saveAs: true
  });
};

$("#reset-list").onclick = async () => {
  let undo = $("#userlist-undo");
  if (undo.style.display == "flex"){
    return;
  }

  let old = await browser.storage.local.get("userlist");
  await browser.storage.local.remove("userlist");
  userlistDetails();
  
  undo.style.display = "flex";

  $(undo, ".undo-button").onclick = async () => {
    await browser.storage.local.set({
      userlist: old.userlist
    });
    userlistDetails();
    undo.removeAttribute("style");
  }
};

$("#stash").oninput = () => showStashOptions();
showStashOptions();

$("#reset-options").onclick = () => {
  let undo = $("#options-undo");
  if (undo.style.display == "flex"){
    return;
  }

  let oldoptions = optionsInfo();
  setDefault();
  fixFormat();

  undo.style.display = "flex";

  $(undo, ".undo-button").onclick = () => {
    setOptions(oldoptions);
    fixFormat();
    undo.removeAttribute("style");
  }
};

$("#export-options").onclick = () => {
  let blob = new Blob([JSON.stringify(optionsInfo())], {type : "application/json"});

  browser.downloads.download({
    url: window.URL.createObjectURL(blob),
    filename: "artsaver-settings.json",
    saveAs: true
  });
};

$("#import-options").oninput = function(){
  getJSON(this.files[0]).then(jsonfile => {
    setOptions(jsonfile);
    fixFormat();
  });
};

$("#click-import").onclick = () => {
  $("#import-options").click();
};

$("form").onsubmit = s => s.preventDefault();
$("form").oninput = () => saveOptions();

for (let b of $$("button.help-button")){
  b.onclick = function(){
    toggleHelpButton(this);
  };
}

function toggleHelpButton(button){
  let table = button.nextElementSibling;
  if (button.textContent === "Show Help"){
    table.style.display = "block";
    button.textContent = "Hide Help";
  }
  else if (button.textContent === "Hide Help"){
    table.removeAttribute("style");
    button.textContent = "Show Help";
  }
}

for (let t of $$("textarea")){
  t.style.height = "1.6em";
  textareaResize(t);
  t.oninput = function(){
    this.style.height = "1.6em";
    textareaResize(this);
  };
}

function addTable(selector, table){
  $(`#${selector} ~ button`).insertAdjacentElement("afterend", table);
}

function getJSON(file){
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = loaded => {
      resolve(JSON.parse(loaded.target.result));
    };
    reader.readAsText(file);
  });
}

async function userlistDetails(){
  let res = await browser.storage.local.get("userlist");
  let list = res.userlist;
  let savedtable = $("#saved-table");

  $$(savedtable, "tr:nth-child(n+2)").forEach(row => removeElement(row));

  if (!list || Object.keys(list).length === 0){
    savedtable.style.display = "none";
    return;
  }

  let sites = ["deviantart", "pixiv", "furaffinity", "inkbunny"];

  let tbody = $(savedtable,  "tbody");

  for (let s of sites){
    if (!list[s]){
      continue;
    }

    let row = document.createElement("tr");
    row.innerHTML = '<td></td><td><span class="badge"></span></td><td><span class="badge"></span></td>';
    row.firstElementChild.textContent = s[0].toUpperCase() + s.slice(1);  //site
    let badges = $$(row, "span");
    badges[0].textContent = new Set(Object.keys(list[s])).size;           //total users
    badges[1].textContent = new Set(Object.values(list[s]).flat()).size;  //total saved submissions

    tbody.insertAdjacentElement("beforeend", row)
  }

  savedtable.removeAttribute("style");
}

function showStashOptions(){
  let stashoptions = $("div.stash-options");
  if ($("input#stash").checked){
    stashoptions.removeAttribute("style");
  }
  else {
    stashoptions.style.display = "none";
  }
  textareaResize($("#dev-stash"));
}

function tableMaker(tablemetas){
  metas = {
    site: "The name of the website. 'pixiv', 'deviantart', etc.",
    userName: "The user name of the artist.",
    title: "Title of the submission.",
    submissionId: "Id of the submission. Different according to each site.",
    submissionId36: "submissionId in base 36 format.",
    fileName: "Original site filename of the submission. Does not include extension.",
    ext: "File extension. 'jpg', 'png', 'gif', etc.",
    stashUrlId: "The digits and letters at the end of a the stash url.",
    stashUserName: "The user name of the artist of the stash submission.",
    stashTitle: "Title of the stash submission.",
    stashSubmissionId: "Id of the stash submission.",
    stashFileName: "The original file name of the stash submission. Does not include extension.",
    stashExt: "File extension of the stash submission.",
    userId: "The user Id of the artist.",
    page: "The page number of the file in the submission set. Pages start at 1.",
    fileId: "Id of the submission file.",
    userLower: "The way the user name appears in the url bar."
  };

  let table = document.createElement("table");
  table.innerHTML = tablemetas.reduce((acc, m) => `${acc}<tr><td><li><strong>{${m}}</strong></li></td><td>${metas[m]}</td></tr>`, "");

  return table;
}

function saveOptions(){
  browser.storage.local.set({
    options: optionsInfo()
  });
}

function optionsInfo(){
  return {
    global: {
      conflict: $("#conflict").value,
      replace: $("#replace-spaces").checked
    },
    deviantart: {
      userFolder: $("#dev-user-folder").value,
      file: $("#dev-file").value,
      larger: $("#dev-larger").checked,
      stash: $("#stash").checked,
      stashFile: $("#dev-stash").value,
      moveFile: $("#dev-move").checked
    },
    pixiv: {
      userFolder: $("#pix-user-folder").value,
      file: $("#pix-file").value,
      multiple: $("#pix-multiple").value,
      ugoira: $("#ugoira").value
    },
    furaffinity: {
      userFolder: $("#fur-user-folder").value,
      file: $("#fur-file").value
    },
    inkbunny: {
      userFolder: $("#ink-user-folder").value,
      file: $("#ink-file").value,
      multiple: $("#ink-multiple").value,
    }
  };
}

function setOptions(options){
  $("#conflict").value = options.global.conflict;
  $("#replace-spaces").checked = options.global.replace;

  $("#dev-user-folder").value = options.deviantart.userFolder;
  $("#dev-file").value = options.deviantart.file;
  $("#dev-larger").checked = options.deviantart.larger;
  $("#stash").checked = options.deviantart.stash;
  $("#dev-stash").value = options.deviantart.stashFile;
  $("#dev-move").checked = options.deviantart.moveFile;

  $("#pix-user-folder").value = options.pixiv.userFolder;
  $("#pix-file").value = options.pixiv.file;
  $("#pix-multiple").value = options.pixiv.multiple;
  $("#ugoira").value = options.pixiv.ugoira;

  $("#fur-user-folder").value = options.furaffinity.userFolder;
  $("#fur-file").value = options.furaffinity.file;

  $("#ink-user-folder").value = options.inkbunny.userFolder;
  $("#ink-file").value = options.inkbunny.file;
  $("#ink-multiple").value = options.inkbunny.multiple;

  saveOptions();
}

function setDefault(){
  options = {
    global: {
      conflict: "overwrite",
      replace: true
    },
    deviantart: {
      userFolder: "Saved/{site}/{userName}/",
      file: "Saved/{site}/{userName}/{submissionId}_{title}_by_{userName}.{ext}",
      larger: false,
      stash: false,
      stashFile: "Saved/{site}/{userName}/{submissionId}_{title}/{stashTitle}_by_{stashUserName}_{stashUrlId}.{stashExt}",
      moveFile: false
    },
    pixiv: {
      userFolder: "Saved/{site}/{userName}_{userId}/",
      file: "Saved/{site}/{userName}_{userId}/{submissionId}_{title}_by_{userName}.{ext}",
      multiple: "Saved/{site}/{userName}_{userId}/{submissionId}_{title}/{submissionId}_{title}_{page}_by_{userName}.{ext}",
      ugoira: "multiple"
    },
    furaffinity: {
      userFolder: "Saved/{site}/{userLower}/",
      file: "Saved/{site}/{userLower}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}"
    },
    inkbunny: {
      userFolder: "Saved/{site}/{userName}/",
      file: "Saved/{site}/{userName}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}",
      multiple: "Saved/{site}/{userName}/{submissionId}_{title}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}",
    }
  };

  setOptions(options);
}

function textareaResize(textarea){
  let height = 0;
  while (textarea.clientHeight < textarea.scrollHeight){
    textarea.style.height = `${textarea.scrollHeight + height}px`;
    height += 1;
  }
}

function fixFormat(){
  showStashOptions();
  for (let t of $$("textarea")){
    t.style.height = "1.6em";
    textareaResize(t);
  }
}