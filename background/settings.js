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
  },
  deviantart: {
    userFolder: {
      location: "#dev-user-folder",
      default: "Saved/{site}/{userName}/"
    },
    file: {
      location: "#dev-file",
      default: "Saved/{site}/{userName}/{submissionId}_{title}_by_{userName}.{ext}"
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
      default: "Saved/{site}/{userName}/{submissionId}_{title}/{stashTitle}_by_{stashUserName}_{stashUrlId}.{stashExt}"
    },
    moveFile: {
      location: "#dev-move",
      default: false
    }
  },
  pixiv: {
    userFolder: {
      location: "#pix-user-folder",
      default: "Saved/{site}/{userName}_{userId}/"
    },
    file: {
      location: "#pix-file",
      default: "Saved/{site}/{userName}_{userId}/{submissionId}_{title}_by_{userName}.{ext}"
    },
    multiple: {
      location: "#pix-multiple",
      default: "Saved/{site}/{userName}_{userId}/{submissionId}_{title}/{submissionId}_{title}_{page}_by_{userName}.{ext}"
    },
    ugoira: {
      location: "#ugoira",
      default: "multiple"
    }
  },
  furaffinity: {
    userFolder: {
      location: "#fur-user-folder",
      default: "Saved/{site}/{userLower}/"
    },
    file: {
      location: "#fur-file",
      default: "Saved/{site}/{userLower}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}"
    }
  },
  inkbunny: {
    userFolder: {
      location: "#ink-user-folder",
      default: "Saved/{site}/{userName}/"
    },
    file: {
      location: "#ink-file",
      default: "Saved/{site}/{userName}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}"
    },
    multiple: {
      location: "#ink-multiple",
      default: "Saved/{site}/{userName}/{submissionId}_{title}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}"
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