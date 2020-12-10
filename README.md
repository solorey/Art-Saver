<p align="center">
<img src="https://github.com/solorey/Art-Saver/blob/master/icons/icon.svg" height=128 width=128>
</p>

<h1 align="center">Art Saver</h1>

A Webextension to easily download art submissions directly from the thumbnail.

## How to use

Simply hover over a thumbnail on any page of the website and click the download button.
<img src="https://github.com/solorey/Art-Saver/blob/master/icons/download.svg" width=16 height=16>

Submissions that have already been downloaded will show a green checkmark.
<img src="https://github.com/solorey/Art-Saver/blob/master/icons/check_green.svg" width=16 height=16>

Check the [Wiki][wiki] for additional information.

View the [Supported Sites][sites].

### Hotkeys
- **D**: Download submission that is currently being hovered over.

## Features
- Custom filenames
- Download full image resolution
- Export and restore the information on what you saved

## Download
[![For Firefox][amo]][addon]

## Install Temporarily
- Download repository anywhere on your computer.
- Enter `about:debugging` in the URL bar and click `This Firefox`.
- Click `Load Temporary Add-on...` and select the `manifest.json` file.

## Credits
Inspired by:
- ![][px-logo] [Px Downloader][px]
- ![][raccony-logo] [Raccoony][raccony]

Code used:
- [UPNG.js][upng] : for APNG encoding
- [gif.js][gif] : for GIF encoding
- [JSZip][zip] : for ZIP encoding

Other:
- [icomoon][iconfont] : for icon font creation

[wiki]: https://github.com/solorey/Art-Saver/wiki
[sites]: https://github.com/solorey/Art-Saver/wiki/Supported-Sites

[addon]: https://addons.mozilla.org/en-US/firefox/addon/art-saver/

[amo]: https://addons.cdn.mozilla.net/static/img/addons-buttons/AMO-button_1.png

[px]: https://addons.mozilla.org/en-US/firefox/addon/px-downloader/
[px-logo]: https://addons.cdn.mozilla.net/user-media/addon_icons/802/802600-32.png

[raccony]: https://github.com/Simon-Tesla/RaccoonyWebEx
[raccony-logo]: https://raw.githubusercontent.com/Simon-Tesla/RaccoonyWebEx/master/src/icon-32.png

[upng]: https://github.com/photopea/UPNG.js/
[gif]: https://jnordberg.github.io/gif.js/
[zip]: https://stuk.github.io/jszip/

[iconfont]: https://icomoon.io/
