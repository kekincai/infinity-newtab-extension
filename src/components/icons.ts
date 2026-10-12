/** Icons sized by CSS. Stroke icons use currentColor lines, solid icons currentColor fills. */
const icon = (paths: string) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const solid = (paths: string) => `<svg class="icon icon-solid" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
    settings: icon('<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>'),
    sparkle: icon('<path d="M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8z"></path><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"></path>'),
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
    look: icon('<circle cx="12" cy="12" r="8"></circle><path class="icon-fill" d="M12 4a8 8 0 0 0 0 16z"></path>'),
    widgets: solid('<rect x="4" y="4" width="7" height="7" rx="2"></rect><rect x="13" y="4" width="7" height="7" rx="2"></rect><rect x="4" y="13" width="7" height="7" rx="2"></rect><rect x="13" y="13" width="7" height="7" rx="2"></rect>'),
    wallpaper: icon('<rect x="3" y="5" width="18" height="14" rx="3"></rect><path class="icon-fill" d="M10 9.5v5l4.5-2.5z"></path>'),
    database: icon('<ellipse cx="12" cy="6" rx="7" ry="2.5"></ellipse><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"></path>'),
    close: icon('<path d="M6 6l12 12M18 6 6 18"></path>')
} as const;
