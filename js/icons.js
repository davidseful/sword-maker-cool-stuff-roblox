/* ==========================================================================
   Sword Forge - icons.js
   A small set of line icons (24x24, drawn with currentColor).
   SF.icon('name', size) returns an <svg> string.
   ========================================================================== */
(function (SF) {
  'use strict';

  const I = {
    sword: '<path d="M20.5 3.5V8L10 18.5 5.5 14 16 3.5z"/><path d="M4 15.5 8.5 20M7 17 3.5 20.5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2 7 7M17 17l1.8 1.8M18.8 5.2 17 7M7 17l-1.8 1.8"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    swing: '<path d="M4 19C9 18 16 13 19.5 4.5"/><path d="M13.5 4.5h6v6"/>',
    rotate: '<path d="M20 11a8 8 0 0 0-14-4"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4"/><path d="M20 20v-4h-4"/>',
    avatar: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
    scene: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m4 16 5-5 4 4 3-3 4 4"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    download: '<path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 20h14"/>',
    upload: '<path d="M12 16V5M7.5 9 12 4.5 16.5 9M5 20h14"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    trash: '<path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 6A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.6M6.3 7.5A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.2-.6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2-2.5 3.6M12 17v.2"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4.5h4.5"/>',
    blade: '<path d="M12 2.5 15 6v10H9V6z"/><path d="M7 16h10M12 16v5"/>',
    hilt: '<path d="M4 9h16v3H4z"/><path d="M10.5 12h3v6h-3z"/><circle cx="12" cy="20.2" r="1.6"/>',
    effects: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
    moves: '<circle cx="9" cy="4.8" r="2"/><path d="M9 7.8v6.2l-3.2 5.5M9 14l4 2.2 2.2 4.3M9 10l5-2.5 4.5 2.2"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    powers: '<path d="M13 2.5 5.5 13.5H11L10 21.5l7.5-11H12z"/>',
    tune: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    glow: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.4.4.5.8.5 1.1h6c0-.3.1-.7.5-1.1A6 6 0 0 0 12 3z"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
    trail: '<circle cx="17.5" cy="6.5" r="2.5"/><path d="M15.5 8.5C11 11 8 14 3.5 20M17 9c-2 4-5 7-9 11M13 8.5C9 10 6 12 3 15"/>',
    aura: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5" stroke-dasharray="3 2.4"/><circle cx="12" cy="12" r="9.5" stroke-dasharray="1.5 3"/>',
    outline: '<rect x="5" y="5" width="14" height="14" rx="2" stroke-dasharray="3.2 2.4"/><path d="m9 15 3-8 3 8"/>',
    rainbow: '<path d="M3.5 17a8.5 8.5 0 0 1 17 0M6.5 17a5.5 5.5 0 0 1 11 0M9.5 17a2.5 2.5 0 0 1 5 0"/>',
    arcs: '<path d="M3 14l4-4 3 4 3.5-6 3 5 4.5-3"/><path d="M3 19l4-2 4 2 4-3 5 2"/>',
    flame: '<path d="M12 3c.8 3.6 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.4 2.5-4.5C9.7 9.6 11.4 7.8 12 3z"/><path d="M12 20a2.2 2.2 0 0 1-2.2-2.2c0-1.4 1.2-2.2 2.2-3.6 1 1.4 2.2 2.2 2.2 3.6A2.2 2.2 0 0 1 12 20z"/>',
    skull: '<path d="M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3z"/><circle cx="9.3" cy="11" r="1.3"/><circle cx="14.7" cy="11" r="1.3"/><path d="M10.5 19v-2.2M13.5 19v-2.2"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="m9.5 4.8 2.5 2 2.5-2M9.5 19.2l2.5-2 2.5 2"/>',
    shock: '<circle cx="12" cy="12" r="9"/><path d="M12.8 6 8 13h3.4l-.6 5 4.8-7h-3.4z"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    impact: '<circle cx="9" cy="12" r="3"/><path d="M14 8l4-3M15 12h6M14 16l4 3"/>',
    bolt: '<path d="M13 2.5 5.5 13.5H11L10 21.5l7.5-11H12z"/>',
    burst: '<path d="M12 3l1.6 4.2L17.5 5l-1.2 4.4L21 11l-4.3 1.7L18 17l-4-2.2-2 4.2-2-4.2-4 2.2 1.3-4.3L3 11l4.7-1.6L6.5 5l3.9 2.2z"/>',
    wave: '<path d="M4 19c1-9 7-15 16-15-3 3-3.500 7-3.500 9.5S15 19 4 19z"/>',
    sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.500-4H4z"/><path d="M15.500 9a4 4 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11"/>',
    stats: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.500 0 2-1 1.500-2s-.2-2.200 1.200-2.200H17a4 4 0 0 0 4-4C21 6.500 17 3 12 3z"/><circle cx="7.500" cy="11" r="1" fill="currentColor"/><circle cx="10" cy="7.200" r="1" fill="currentColor"/><circle cx="15" cy="7.500" r="1" fill="currentColor"/>',
    fire: '<path d="M12 3c.8 3.6 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.400 2.500-4.500C9.700 9.600 11.400 7.800 12 3z"/>',
  };

  SF.icon = function (name, size) {
    const body = I[name] || I.sword;
    const s = size || 18;
    return '<svg class="ico" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  };
  SF.ICON_NAMES = Object.keys(I);
})((globalThis.SF = globalThis.SF || {}));
