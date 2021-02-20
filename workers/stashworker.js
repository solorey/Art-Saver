//var stashes;

onmessage = async function(m){
  try {
    switch (m.data.function){
      case "getstash":
        let stash = await getStash(m.data.stashurls);
        postMessage({message: "gotstash", stash});
        break;

      case "downloadstash":
        let blobs = await fetchBlobsProgress(m.data.stashdownloads);
        postMessage({message: "gotblobs", blobs});
    }

  }
  catch (err){
    postMessage(err);
  }
}

async function fetcher(url, type){
  let response = await fetch(url, {credentials: "include"});

  switch (type){
    case "text":
      return response.text();

    case "blob":
      return await response.blob();

    default:
      return response;
  }
}

async function getStash(urls){
  let totalurls = await navigateStacks(urls);
  let stashresponses = await Promise.all(totalurls.map(u => fetcher(u, "text")));
  let allstashes = await Promise.all(totalurls.map((url, i) => getStashMeta(stashresponses[i], url)));
  return allstashes.filter(s => s);
}

async function navigateStacks(urls){
  function stackUrls(sr){
    let thumbreg = /gmi-stashid(?:.|\n)+?<\//g;
    let result;
    let stashthumbs = [];
    while ((result = thumbreg.exec(sr)) !== null){
      stashthumbs.push(result[0]);
    }

    let surls = [];
    for (thumb of stashthumbs){
      let hrefreg = /<a.+?href="(.+?)"/.exec(thumb);
      if (hrefreg){
        surls.push(hrefreg[1]);
      }
      else {
        surls.push(decodeStash(/gmi-stashid="(.+?)"/.exec(thumb)[1]));
      }
    }
    return surls;
  }

  let urlslist = urls;
  let stacks;
  while ((stacks = urlslist.filter(u => /\/2/.test(u))).length > 0){
    let responses = await Promise.all(stacks.map(g => fetcher(g, "text")));
    let stackurls = responses.map(r => stackUrls(r));

    urlslist = [urlslist.filter(u => !/\/2/.test(u)), stackurls].flat(Infinity).filter(s => s);
  }
  return [...new Set(urlslist)];
}

function decodeHtml(str){
  let map = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'"
  };
  return str.replace(/&amp;|&lt;|&gt;|&quot;|&#039;/g, (m) => map[m]);
}

async function getStashMeta(sr, url){
  let info = {}, meta = {};
  let sidreg = /gmi-deviationid="(\d+)"/.exec(sr);
  if (!sidreg) {
    return
  }
  meta.stashSubmissionId = sidreg[1];
  meta.stashTitle = decodeHtml(/<a class="title".+?>([^<]+)/.exec(sr)[1]);
  meta.stashUserName = /username".+?>(.+?)</.exec(sr)[1];
  meta.stashUrlId = url.split("/0").pop();
  meta = {...meta, ...stashTimeParse( / ts="(.+?)"/.exec(sr)[1])};

  info.downloadurl = decodeHtml(/dev-page-download(?:.|\n)+?href="(.+?)"/.exec(sr)[1]);

  let fileres = await fetcher(info.downloadurl);
  let attachment;
  if (fileres.ok){
    attachment = fileres.headers.get("content-disposition");
  }
  else {
    let full = /src="(.+?)"[^<]+?dev-content-full/.exec(sr);
    if (!full){
      return;
    }
    info.downloadurl = full[1];
  }

  let reg = /(?:''|\/)([^\/?]+)\.(\w+)(?:\?token=.+)?$/.exec(attachment || fileres.url);
  if (reg){
    meta.stashFileName = reg[1];
    meta.stashExt = reg[2];

    return {info, meta};
  }

  let preview = /"dev-view-deviation(?:.|\n)+?src="(.+?)"/.exec(sr)[1];
  if (/\/v1\//.test(preview)){
    reg = /\.(\w+)\/v1\/.+?(\w+)-\w+\.\w+\?/.exec(preview);
    meta.stashFileName = reg[2];
    meta.stashExt = reg[1];
  }
  else {
    reg = /\/(d[\w-]+)\.(\w+)\?/.exec(preview);
    meta.stashFileName = reg[1];
    meta.stashExt = reg[2];
  }

  return {info, meta};
}

function decodeStash(num){
  num = parseInt(num, 10);

  let link = "";
  let chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let base = chars.length;
  while (num){
    remainder = num % base;
    quotient = Math.trunc(num / base);

    num = quotient;
    link = `${chars[remainder]}${link}`;
  }

  return `https://sta.sh/2${link}`;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function fetchBlobsProgress(downloads){
  let allprogress = Array(downloads.length);

  return await Promise.all(downloads.map((dl, i) => getBlob(dl, i)));

  async function getBlob(dl, i){
    let response = await fetcher(dl.url);

    if (!response.ok){
      let err = new Error(dl.url);
      err.name = `Error ${response.status}`;
      throw err;
    }

    let loaded = 0;
    let total = parseInt(response.headers.get("Content-Length"), 10);
    let computable = total ? true : false;

    let reader = response.body.getReader();
    let chunks = [];

    while (true){
      let {done, value} = await reader.read();
      if (done){
        break;
      }
      chunks.push(value);
      loaded += value.length;

      allprogress[i] = {computable, total, loaded};

      blobProgress(allprogress);
    }

    dl.blob = new Blob(chunks);
    return dl;
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function blobProgress(allprogress){
  let current = allprogress.flat();

  let [total, loaded] = current.reduce((acc, c) => [c.total + acc[0], c.loaded + acc[1]], [0, 0]);

  if (current.some(d => !d.computable)){
    postMessage({message: "progress", say: `... ${fileSize(loaded)}`, width: 100});
  }
  else {
    let percent = (loaded / total * 100) * (current.length / allprogress.length);
    postMessage({message: "progress", say: `${fileSize(loaded)} ${Math.floor(percent)}%`, width: percent});
  }
}

function fileSize(bytes){
  for (let size of ["bytes", "KB", "MB", "GB", "TB"]){
    if (bytes < 1024 || size === "TB"){
      return `${bytes.toFixed(2)} ${size}`;
    }
    bytes = bytes / 1024;
  }
}

//timestring assumed to be number of seconds since January 1, 1970, 00:00:00 UTC
function stashTimeParse(timestring){
  let time = new Date();
  time.setTime(`${timestring}000`); //set time by milliseconds

  let pad = (n) => `${n}`.padStart(2, "0");

  return {
    stashYYYY: pad(time.getFullYear()),
    stashMM: pad(time.getMonth() + 1),
    stashDD: pad(time.getDate()),
    stashhh: pad(time.getHours()),
    stashmm: pad(time.getMinutes()),
    stashss: pad(time.getSeconds())
  }
}