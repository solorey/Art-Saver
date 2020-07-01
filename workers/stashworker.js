onmessage = async function(m){
  try {
    postMessage(await getStash(m.data));
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
  let handleStash = async (sr, url) => {
    if (/sta.sh\/2/.test(url)){
      let thumbreg = /gmi-stashid(?:.|\n)+?<\//g;
      let result;
      let stashthumbs = [];
      while ((result = thumbreg.exec(sr)) !== null) {
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

      return await navigateStashUrls([...new Set(surls)]);
    }
    //download button on a stash page
    else if (/dev-page-download/.test(sr)){
      return await getStashMeta(sr, url);
    }
    return;
  }

  async function navigateStashUrls(urls){
    let responses = await Promise.all(urls.map(u => fetcher(u, "text")));
    let downloads = await Promise.all(responses.map((r, i) => handleStash(r, urls[i])));

    return downloads.flat(Infinity).filter(d => d);
  }

  let stashes = await navigateStashUrls(urls);
  //filter out duplicate stashes
  let stashlist = {};
  for (s of stashes){
    stashlist[s.meta.stashUrlId] = s;
  }

  return Object.values(stashlist);
}

async function getStashMeta(sr, url){
  let info = {}, meta = {};
  meta.stashSubmissionId = /gmi-deviationid="(\d+)"/.exec(sr)[1];
  meta.stashTitle = /<a class="title".+?>([^<]+)/.exec(sr)[1];
  meta.stashUserName = /username".+?>(.+?)</.exec(sr)[1];
  meta.stashUrlId = url.split("/").pop();

  info.downloadurl = /dev-page-download(?:.|\n)+?href="(.+?)"/.exec(sr)[1].replace("amp;","");

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
  info.blob = await fetcher(info.downloadurl, "blob");

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