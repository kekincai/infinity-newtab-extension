/** Icons sized by CSS. Stroke icons use currentColor lines, solid icons currentColor fills. */
const icon = (paths: string) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const solid = (paths: string) => `<svg class="icon icon-solid" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
    settings: icon('<path d="M10.02 4.87L10.45 2.73A9.4 9.4 0 0 1 13.55 2.73L13.98 4.87A7.4 7.4 0 0 1 15.64 5.56L17.46 4.35A9.4 9.4 0 0 1 19.65 6.54L18.44 8.36A7.4 7.4 0 0 1 19.13 10.02L21.27 10.45A9.4 9.4 0 0 1 21.27 13.55L19.13 13.98A7.4 7.4 0 0 1 18.44 15.64L19.65 17.46A9.4 9.4 0 0 1 17.46 19.65L15.64 18.44A7.4 7.4 0 0 1 13.98 19.13L13.55 21.27A9.4 9.4 0 0 1 10.45 21.27L10.02 19.13A7.4 7.4 0 0 1 8.36 18.44L6.54 19.65A9.4 9.4 0 0 1 4.35 17.46L5.56 15.64A7.4 7.4 0 0 1 4.87 13.98L2.73 13.55A9.4 9.4 0 0 1 2.73 10.45L4.87 10.02A7.4 7.4 0 0 1 5.56 8.36L4.35 6.54A9.4 9.4 0 0 1 6.54 4.35L8.36 5.56A7.4 7.4 0 0 1 10.02 4.87Z"></path><circle cx="12" cy="12" r="3.1"></circle>'),
    shuffle: icon('<path d="M3 17h3.4c1.6 0 2.6-.7 3.5-2l4.2-6c.9-1.3 1.9-2 3.5-2H21"></path><path d="M3 7h3.4c1.6 0 2.6.7 3.5 2l.6.9M13.5 14.1l.6.9c.9 1.3 1.9 2 3.5 2H21"></path><path d="m18.5 4.5 2.5 2.5-2.5 2.5M18.5 14.5l2.5 2.5-2.5 2.5"></path>'),
    search: icon('<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path>'),
    plus: icon('<path d="M12 5v14M5 12h14"></path>'),
    folder: icon('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l2 2h7.8A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"></path>'),
    folderPlus: icon('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l2 2h7.8A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"></path><path d="M12 11v5M9.5 13.5h5"></path>'),
    more: icon('<circle cx="6" cy="12" r="1.2"></circle><circle cx="12" cy="12" r="1.2"></circle><circle cx="18" cy="12" r="1.2"></circle>'),
    edit: icon('<path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="m13.5 6.5 4 4"></path>'),
    trash: icon('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"></path>'),
    open: icon('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path>'),
    move: icon('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l2 2h7.8A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"></path><path d="M10 13.5h6M13.5 11l2.5 2.5-2.5 2.5"></path>'),
    refresh: icon('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"></path>'),
    download: icon('<path d="M12 4v12M7 11l5 5 5-5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"></path>'),
    pause: solid('<rect x="6" y="4.5" width="4" height="15" rx="1.3"></rect><rect x="14" y="4.5" width="4" height="15" rx="1.3"></rect>'),
    play: solid('<path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z"></path>'),
    speaker: icon('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"></path><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"></path>'),
    muted: icon('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"></path><path d="m16 9.5 5 5M21 9.5l-5 5"></path>'),
    battery: icon('<rect x="3" y="7.5" width="16" height="9" rx="2"></rect><path d="M21 11v2"></path>'),
    bolt: icon('<path d="m13 3-7 10h5l-1 8 7-10h-5z"></path>'),
    clock: icon('<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>'),
    grid: solid('<rect x="4" y="4" width="4" height="4" rx="1.2"></rect><rect x="10" y="4" width="4" height="4" rx="1.2"></rect><rect x="16" y="4" width="4" height="4" rx="1.2"></rect><rect x="4" y="10" width="4" height="4" rx="1.2"></rect><rect x="10" y="10" width="4" height="4" rx="1.2"></rect><rect x="16" y="10" width="4" height="4" rx="1.2"></rect><rect x="4" y="16" width="4" height="4" rx="1.2"></rect><rect x="10" y="16" width="4" height="4" rx="1.2"></rect><rect x="16" y="16" width="4" height="4" rx="1.2"></rect>'),
    close: icon('<path d="M6 6l12 12M18 6 6 18"></path>')
} as const;

/** Settings sidebar glyphs, drawn white on a coloured tile like macOS System Settings. */
export const SETTINGS_GLYPHS = {
    appearance: icon('<circle cx="12" cy="12" r="7.6"></circle><path class="icon-fill" d="M12 4.4a7.6 7.6 0 0 0 0 15.2z"></path>'),
    widgets: solid('<rect x="4.5" y="4.5" width="6.4" height="6.4" rx="1.8"></rect><rect x="13.1" y="4.5" width="6.4" height="6.4" rx="1.8"></rect><rect x="4.5" y="13.1" width="6.4" height="6.4" rx="1.8"></rect><rect x="13.1" y="13.1" width="6.4" height="6.4" rx="1.8"></rect>'),
    wallpaper: icon('<rect x="3.8" y="5.3" width="16.4" height="13.4" rx="2.8"></rect><path class="icon-fill" stroke="none" d="M5.6 16.9l4-4.9 2.9 3.2 2.1-2.2 3.8 3.9z"></path><circle class="icon-fill" stroke="none" cx="15.4" cy="9.4" r="1.5"></circle>'),
    data: icon('<path d="M3.8 12.6 6.2 6.5A2 2 0 0 1 8.1 5.2h7.8a2 2 0 0 1 1.9 1.3l2.4 6.1"></path><rect x="3.8" y="12.6" width="16.4" height="6.2" rx="2"></rect><circle class="icon-fill" stroke="none" cx="16.6" cy="15.7" r="1"></circle>')
} as const;
