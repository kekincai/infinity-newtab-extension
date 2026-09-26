/** Stroke icons sized by CSS; every path uses currentColor. */
const icon = (paths: string) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
    settings: icon('<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"></path><circle cx="16" cy="6" r="2"></circle><circle cx="8" cy="12" r="2"></circle><circle cx="13" cy="18" r="2"></circle>'),
    shuffle: icon('<path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 4.8c1.1 1.6 2.3 2.6 4.3 2.6H21M17.5 13.5 21 17l-3.5 3.5M3 17h3.5c1.2 0 2.1-.4 2.9-1.1M14.6 8.1c.8-.7 1.7-1.1 2.9-1.1H21M17.5 3.5 21 7l-3.5 3.5"></path>'),
    search: icon('<circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path>'),
    plus: icon('<path d="M12 5v14M5 12h14"></path>'),
    folderPlus: icon('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l2 2h7.8A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"></path><path d="M12 11v5M9.5 13.5h5"></path>'),
    back: icon('<path d="M15 5 8 12l7 7"></path>'),
    more: icon('<circle cx="6" cy="12" r="1.2"></circle><circle cx="12" cy="12" r="1.2"></circle><circle cx="18" cy="12" r="1.2"></circle>'),
    edit: icon('<path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="m13.5 6.5 4 4"></path>'),
    trash: icon('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"></path>'),
    open: icon('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path>'),
    move: icon('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l2 2h7.8A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"></path><path d="M10 13.5h6M13.5 11l2.5 2.5-2.5 2.5"></path>'),
    refresh: icon('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"></path>'),
    upload: icon('<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"></path>'),
    download: icon('<path d="M12 4v12M7 11l5 5 5-5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"></path>'),
    reset: icon('<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"></path>'),
    play: icon('<path d="M8 5.5v13l10-6.5z"></path>'),
    battery: icon('<rect x="3" y="7.5" width="16" height="9" rx="2"></rect><path d="M21 11v2"></path>'),
    bolt: icon('<path d="m13 3-7 10h5l-1 8 7-10h-5z"></path>'),
    palette: icon('<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-.9.7-1.7 1.7-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"></path><circle cx="7.5" cy="11" r="1"></circle><circle cx="10" cy="7" r="1"></circle><circle cx="15" cy="7.5" r="1"></circle>'),
    widgets: icon('<rect x="4" y="4" width="7" height="7" rx="2"></rect><rect x="13" y="4" width="7" height="7" rx="2"></rect><rect x="4" y="13" width="7" height="7" rx="2"></rect><rect x="13" y="13" width="7" height="7" rx="2"></rect>'),
    image: icon('<rect x="3" y="5" width="18" height="14" rx="2.5"></rect><circle cx="9" cy="10" r="1.8"></circle><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"></path>'),
    database: icon('<ellipse cx="12" cy="6" rx="7" ry="2.8"></ellipse><path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8"></path>'),
    clock: icon('<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>'),
    bookmark: icon('<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"></path>'),
    pulse: icon('<path d="M3 12h4l2.5-6 4 12 2.5-6H21"></path>'),
    close: icon('<path d="M6 6l12 12M18 6 6 18"></path>')
} as const;
