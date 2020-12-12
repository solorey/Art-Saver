//Make sure to reload extension
const globalsettings = {
  global: {
    conflict: {
      location: "#conflict",
      default: "overwrite"
    },
    replace: {
      location: "#replace-spaces",
      default: true
    },
    saveAs: {
      location: "#use-saveas",
      default: false
    },
    iconSize: {
      location: "#icon-size",
      default: 16
    },
    addScreen: {
      location: "#add-screen",
      default: false
    },
    screenOpacity: {
      location: "#screen-opacity",
      default: 50
    },
    useQueue: {
      location: "#use-queue",
      default: false
    },
    queueConcurrent: {
      location: "#queue-concurrent",
      default: 1
    },
    queueWait: {
      location: "#queue-wait",
      default: 0
    },
    infoBar: {
      location: "#infobar",
      default: false
    }
  },
  deviantart: {
    userFolder: {
      location: "#dev-user-folder",
      default: "Saved/{site}/{userName}/",
      metas: ["site", "userName"]
    },
    file: {
      location: "#dev-file",
      default: "Saved/{site}/{userName}/{submissionId}_{title}_by_{userName}.{ext}",
      metas: ["site", "userName", "title", "submissionId", "submissionId36", "fileName", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss"]
    },
    larger: {
      location: "#dev-larger",
      default: false
    },
    stash: {
      location: "#stash",
      default: false
    },
    stashFile: {
      location: "#dev-stash",
      default: "Saved/{site}/{userName}/{submissionId}_{title}/{stashTitle}_by_{stashUserName}_{stashUrlId}.{stashExt}",
      metas: ["site", "userName", "title", "submissionId", "submissionId36", "fileName", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss", "stashUrlId", "stashUserName", "stashTitle", "stashSubmissionId", "stashFileName", "stashExt", "stashYYYY", "stashMM", "stashDD", "stashhh", "stashmm", "stashss"]
    },
    moveFile: {
      location: "#dev-move",
      default: false
    }
  },
  pixiv: {
    userFolder: {
      location: "#pix-user-folder",
      default: "Saved/{site}/{userName}_{userId}/",
      metas: ["site", "userName", "userId"]
    },
    file: {
      location: "#pix-file",
      default: "Saved/{site}/{userName}_{userId}/{submissionId}_{title}_by_{userName}.{ext}",
      metas: ["site", "userName", "userId", "title", "submissionId", "fileName", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss"]
    },
    multiple: {
      location: "#pix-multiple",
      default: "Saved/{site}/{userName}_{userId}/{submissionId}_{title}/{submissionId}_{title}_{page}_by_{userName}.{ext}",
      metas: ["site", "userName", "userId", "title", "submissionId", "fileName", "page", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss"]
    },
    ugoira: {
      location: "#ugoira",
      default: "multiple"
    }
  },
  furaffinity: {
    userFolder: {
      location: "#fur-user-folder",
      default: "Saved/{site}/{userLower}/",
      metas: ["site", "userName", "userLower"]
    },
    file: {
      location: "#fur-file",
      default: "Saved/{site}/{userLower}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}",
      metas: ["site", "userName", "userLower", "title", "submissionId", "fileName", "fileId", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss"]
    }
  },
  inkbunny: {
    userFolder: {
      location: "#ink-user-folder",
      default: "Saved/{site}/{userName}/",
      metas: ["site", "userName", "userId"]
    },
    file: {
      location: "#ink-file",
      default: "Saved/{site}/{userName}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}",
      metas: ["site", "userName", "userId", "title", "submissionId", "fileName", "fileId", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss"]
    },
    multiple: {
      location: "#ink-multiple",
      default: "Saved/{site}/{userName}/{submissionId}_{title}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}",
      metas: ["site", "userName", "userId", "title", "submissionId", "fileName", "fileId", "page", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss"]
    }
  }
};

function settingsList(){
  let settingslist = [];
  for ([site, values] of Object.entries(globalsettings)){
    for ([option, settings] of Object.entries(values)){
      settingslist.push({site, option, ...settings});
    }
  }
  return settingslist;
}

const popupState = {
  tab: "user",
  downloadLock: true
};

const infoBarState = {
  showFolders: false
};