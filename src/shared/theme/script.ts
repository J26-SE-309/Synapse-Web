/**
 * The theme's storage key and the inline script the root layout runs before the first paint. Kept apart from
 * theme.ts (a client module) so the server-rendered layout can import them as plain values.
 */
export const THEME_STORAGE_KEY = "synapse-theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=p==="dark"||(p!=="light"&&window.matchMedia(${JSON.stringify(DARK_QUERY)}).matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(e){}})()`;
