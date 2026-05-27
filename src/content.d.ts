type ButtonState = Record<string, any>;
type ButtonType = 'check' | 'waiting' | 'download' | 'downloading' | 'error';
type ContainerOptions = {
    screen: boolean;
};
type SubmissionAction = {
    info: SubmissionInfo;
    type: ButtonType;
    parent: HTMLElement;
    container: HTMLElement;
    options: ContainerOptions;
    update?: (o: ButtonState) => void;
    remove: () => void;
};
interface CheckButtonState extends ButtonState {
    saved_user: User;
}
interface DownloadingButtonState extends ButtonState {
    message: string;
    width: number;
    is_stoppable: boolean;
}
interface ErrorButtonState extends ButtonState {
    message: string;
}

type PageInfo = {
    site: Site;
    url: string;
    page: string;
    user?: User;
};

type UserInfo = {
    site: Site;
    user: User;
    name: string;
    icon?: string;
    stats: Map<string, string>;
    folder: string;
};

type SubmissionInfo = {
    site: Site;
    user: User;
    submission: Submission;
};
type SubmissionData<T> = { meta: T; info: SubmissionInfo };

type FileInfo = {
    download: Blob | string;
    size?: number;
};
type FileData<T> = { meta: T; info: FileInfo };

type DownloadInfo = {
    path: string;
    download: Blob | string;
    size?: number;
};

type LogType = 'error' | 'warn' | 'info' | 'debug';

type PageStats = {
    checks: number;
    downloads: number;
};

type DownloadReturn = {
    files: { path: string; id: number }[];
    user: string;
    title?: string;
};

type XClientValues = {
    key_bytes: Uint8Array<ArrayBuffer>;
    animation_string: string;
};

//---------------------------------------------------------------------------------------------------------------------
// options value
//---------------------------------------------------------------------------------------------------------------------

type ValueElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type OptionClass = {
    id: string;
    block: HTMLElement;
    value_element: ValueElement;
    getValue(): OptionValue;
    setValue(value: OptionValue): void;
};

//---------------------------------------------------------------------------------------------------------------------
// background work send and return
//---------------------------------------------------------------------------------------------------------------------

type WorkProgress = { message: 'progress'; loaded: number; total: number };
type WorkResult<T> = { message: 'result'; result: T };
type WorkError = { message: 'error'; error: any };

type WorkResponse<T> = WorkResult<T> | WorkError;

type WorkFetchSend = { url: RequestInfo; init?: RequestInit };
type WorkFetchResult = { url: string; headers: Record<string, string>; body: Blob };
type WorkFetchResponse = WorkProgress | WorkResponse<WorkFetchResult>;

type WorkUgoiraSend = { type: string; blobs: Blob[]; width: number; height: number; delays: number[]; ext: string };
type WorkUgoiraResult = Blob;
type WorkUgoiraResponse = WorkResponse<WorkUgoiraResult>;

type WorkZipSend = { blob: Blob };
type WorkZipResult = Record<string, Uint8Array<ArrayBuffer>>;
type WorkZipResponse = WorkResponse<WorkZipResult>;

type WorkTileSend = {
    width: number;
    height: number;
    tile_width: number;
    tile_height: number;
    url: string;
    token: string;
    watermarked: boolean;
};
type WorkTileResult = Blob;
type WorkTileResponse = WorkResponse<WorkTileResult>;

type WorkMessage =
    | ({
          action: 'work_fetch';
      } & WorkFetchSend)
    | ({
          action: 'work_ugoira';
      } & WorkUgoiraSend)
    | ({ action: 'work_zip' } & WorkZipSend)
    | ({
          action: 'work_tile';
      } & WorkTileSend);

//---------------------------------------------------------------------------------------------------------------------
// runtime messages
//---------------------------------------------------------------------------------------------------------------------

type ContentMessage =
    | { action: 'content_db_update'; site: Site }
    | { action: 'content_page_info' }
    | { action: 'content_user_info'; user: User }
    | { action: 'content_download_all' }
    | { action: 'content_refresh' };

type BackgroundMessage =
    | { action: 'background_download_blob'; blob: Blob; path: string }
    | { action: 'background_create_object_url'; blob: Blob }
    | { action: 'background_revoke_object_url'; url: string }
    | { action: 'background_find_submission'; info: SubmissionInfo }
    | { action: 'background_add_submission'; info: SubmissionInfo }
    | { action: 'background_remove_user'; site: Site; user: User }
    | { action: 'background_remove_submission'; site: Site; submission: Submission }
    | { action: 'background_get_db_site_values'; site: Site }
    | { action: 'background_get_db_user_values'; site: Site; user: User }
    | { action: 'background_get_db_json' }
    | { action: 'background_set_db_json'; saved_json: Partial<JsonSaved> }
    | { action: 'background_add_db_json'; saved_json: Partial<JsonSaved> }
    | { action: 'background_open_user_folder'; path: string }
    | { action: 'background_show_download'; id: number };

type PopupMessage = { action: 'popup_db_update'; site: Site };

type OptionsMessage = { action: 'options_db_update'; site: Site };

//---------------------------------------------------------------------------------------------------------------------
// libs
//---------------------------------------------------------------------------------------------------------------------

type GIFLib = {
    addFrame: (img: ImageData, options: { delay: number }) => void;
    on: (event: string, callback: (blob: Blob) => void) => void;
    render: () => void;
};
type WhammyLib = {
    add: (data: string, delay: number) => void;
    compile: (flag: boolean, callback: (blob: Blob) => void) => void;
};
type DOMPurifyLib = {
    sanitize: (element: HTMLElement, params: any) => any;
};
type UPNGLib = {
    encode: (
        image_data: ImageDataArray[],
        width: number,
        height: number,
        colors: number,
        delays?: number[],
    ) => Uint8Array<ArrayBuffer>;
};
type UZIPLib = {
    parse: (buffer: ArrayBuffer) => Record<string, Uint8Array<ArrayBuffer>>;
    encode: (data: Record<string, Uint8Array<ArrayBuffer>>) => Uint8Array<ArrayBuffer>;
};
