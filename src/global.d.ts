import ImportedBrowser from 'webextension-polyfill';

declare global {
    const browser: ImportedBrowser.Browser;
    export import Browser = ImportedBrowser;

    // libs
    const Whammy: any;
    const GIF: any;
    const DOMPurify: DOMPurifyLib;
    const UPNG: UPNGLib;
    const UZIP: UZIPLib;
}
