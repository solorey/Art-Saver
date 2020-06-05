var globaldefault;

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
document.addEventListener("DOMContentLoaded", async () => {
  let options = await browser.runtime.sendMessage({
    function: "getoptions"
  });
  setOptions(options);

  fixFormat();
});

window.addEventListener("resize", () => {
  fixFormat();
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
    url: URL.createObjectURL(blob),
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
  await userlistDetails();
  
  undo.style.display = "flex";

  $(undo, ".undo-button").onclick = async () => {
    await browser.storage.local.set({
      userlist: old.userlist
    });
    await userlistDetails();
    undo.removeAttribute("style");
  }
};

for (n of $$(".custom-number")){
  let num = $(n, "input");
  $(n, ".increase").onmousedown = function(){ numberIncrement(num, this, 1) };
  $(n, ".decrease").onmousedown = function(){ numberIncrement(num, this, -1) };
}

function numberIncrement(num, elem, n){
  let step = () => num.stepUp(n);
  step();

  let intid;
  let timeid = setTimeout(() => {
    intid = setInterval(step, 80);
  }, 400);

  elem.onmouseup = elem.onmouseout = () => {
    clearTimeout(timeid);
    clearInterval(intid);
    saveOptions();
  };
}

$("#stash").oninput = () => showStashOptions();
showStashOptions();

$("#reset-options").onclick = async () => {
  let undo = $("#options-undo");
  if (undo.style.display == "flex"){
    return;
  }

  let oldoptions = optionsInfo();
  let options = await browser.runtime.sendMessage({
    function: "getdefaultoptions"
  });
  setOptions(options);
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
    url: URL.createObjectURL(blob),
    filename: "artsaver-settings.json",
    saveAs: true
  });
};

$("#import-options").oninput = async function(){
  let jsonfile = await getJSON(this.files[0]);
  let newoptions = await browser.runtime.sendMessage({
    function: "updateoptions",
    newoptions: jsonfile
  });
  setOptions(newoptions);
  fixFormat();
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
    site:              "The name of the website. 'pixiv', 'deviantart', etc.",
    userName:          "The user name of the artist.",
    title:             "Title of the submission.",
    submissionId:      "Id of the submission. Different according to each site.",
    submissionId36:    "submissionId in base 36 format.",
    fileName:          "Original site filename of the submission. Does not include extension.",
    ext:               "File extension. 'jpg', 'png', 'gif', etc.",
    stashUrlId:        "The digits and letters at the end of a the stash url.",
    stashUserName:     "The user name of the artist of the stash submission.",
    stashTitle:        "Title of the stash submission.",
    stashSubmissionId: "Id of the stash submission.",
    stashFileName:     "The original file name of the stash submission. Does not include extension.",
    stashExt:          "File extension of the stash submission.",
    userId:            "The user Id of the artist.",
    page:              "The page number of the file in the submission set. Pages start at 1.",
    fileId:            "Id of the submission file.",
    userLower:          "The way the user name appears in the url bar."
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
      replace:  $("#replace-spaces").checked,
      saveAs:   $("#use-saveas").checked,
      iconSize: $("#icon-size").value
    },
    deviantart: {
      userFolder: $("#dev-user-folder").value,
      file:       $("#dev-file").value,
      larger:     $("#dev-larger").checked,
      stash:      $("#stash").checked,
      stashFile:  $("#dev-stash").value,
      moveFile:   $("#dev-move").checked
    },
    pixiv: {
      userFolder: $("#pix-user-folder").value,
      file:       $("#pix-file").value,
      multiple:   $("#pix-multiple").value,
      ugoira:     $("#ugoira").value
    },
    furaffinity: {
      userFolder: $("#fur-user-folder").value,
      file:       $("#fur-file").value
    },
    inkbunny: {
      userFolder: $("#ink-user-folder").value,
      file:       $("#ink-file").value,
      multiple:   $("#ink-multiple").value
    }
  };
}

function setOptions(options){
  let glob = options.global;
  $("#conflict").value         = glob.conflict;
  $("#replace-spaces").checked = glob.replace;
  $("#use-saveas").checked     = glob.saveAs;
  $("#icon-size").value        = glob.iconSize;

  let dev = options.deviantart;
  $("#dev-user-folder").value = dev.userFolder;
  $("#dev-file").value        = dev.file;
  $("#dev-larger").checked    = dev.larger;
  $("#stash").checked         = dev.stash;
  $("#dev-stash").value       = dev.stashFile;
  $("#dev-move").checked      = dev.moveFile;

  let pix = options.pixiv;
  $("#pix-user-folder").value = pix.userFolder;
  $("#pix-file").value        = pix.file;
  $("#pix-multiple").value    = pix.multiple;
  $("#ugoira").value          = pix.ugoira;

  let fur = options.furaffinity;
  $("#fur-user-folder").value = fur.userFolder;
  $("#fur-file").value        = fur.file;

  let ink = options.inkbunny;
  $("#ink-user-folder").value = ink.userFolder;
  $("#ink-file").value        = ink.file;
  $("#ink-multiple").value    = ink.multiple;

  saveOptions();
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