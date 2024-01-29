// installUtil.js - webapp installation utility
// Copyright © 2023 Doug Reeder

import {closeSnackbar, enqueueSnackbar} from "notistack";

const INSTALL_MIN_NOTES = 6;   // displays installation prompt when user has created enough notes
const INSTALL_REPROMPT_INTERVAL = 30 * 24 * 60 * 60 * 1000;    // ms before prompting again
let installPromptDeferred;
window.addEventListener('beforeinstallprompt', (evt) => {
  evt.preventDefault();   // Prevents the system install prompt
  installPromptDeferred = evt;   // Saves to display system install prompt later
});

async function install() {
  const { outcome, platform } = await installPromptDeferred.prompt();   // Shows the system install prompt
  console.info(`system install prompt ${outcome}; platform "${platform}"`);
  installPromptDeferred = null;   // can only be used once
}

async function checkIfInstallRecommended(notesLength, isFirstLaunch) {
  const installPromptedDate = new Date(localStorage.getItem("notesTogether:installPromptedDate") || 0);
  // console.log(isFirstLaunch, notes.length, `installPromptedDate:`, installPromptedDate)
  if (notesLength >= INSTALL_MIN_NOTES &&   // user engaged
    ! isFirstLaunch &&
    Date.now() - installPromptedDate > INSTALL_REPROMPT_INTERVAL &&   // not prompted too recently
    ! window.matchMedia('(display-mode: standalone)').matches &&   // not running standalone
    ! (await navigator.getInstalledRelatedApps?.())?.length) {   // not installed

    let promptString, action;
    if (installPromptDeferred) {   // System install prompt is available
      promptString = 'Install this webapp for a separate window & Sharing from native apps.';
      action = snackbarId => (
        <>
          <button onClick={() => {install(); closeSnackbar(snackbarId);}}>Install</button>
          <button onClick={() => { closeSnackbar(snackbarId); }}>Not now</button>
        </>
      );
    } else if (/\b(iPad|iPhone|iPod)\b/.test(navigator.userAgent) &&
      /WebKit/.test(navigator.userAgent) &&
      !/Edge/.test(navigator.userAgent) &&
      !window.MSStream &&   // not IE11, which lies
      !/\bFxiOS\/[\d.]+\b/.test(navigator.userAgent)) {   // not Firefox on iOS
      promptString = 'For a separate window & Sharing from native apps, tap the share button then scroll down to "Add to Home Screen"';
    } else if (/\bMacintosh\b/.test(navigator.userAgent) &&
      /Safari\/[\d.]+/.test(navigator.userAgent) &&
      ! /\bChrom\w{1,3}\/[\d.]+\b/.test(navigator.userAgent)) {   // not Chrome/Chromium
      promptString = 'For a separate window & Sharing from native apps, click the share button then "Add to Dock"';
    } else if (/\bMobile\b/.test(navigator.userAgent) &&
      /\bFirefox\/[\d.]+\b/.test(navigator.userAgent) &&
      ! /\bSeamonkey\/[\d.]+\b/.test(navigator.userAgent)) {   // not Seamonkey
      promptString = 'For a separate window & Sharing from native apps, from the Firefox (meatball) menu select "Install"';
    }   // else not installable, at least not now

    if (promptString) {
      enqueueSnackbar(promptString, {
        action,
        anchorOrigin: {horizontal: 'left', vertical: 'bottom'},
        autoHideDuration: 8000,
        onClose: () => {localStorage.setItem("notesTogether:installPromptedDate", Date());},
      });
    }
  }
}

export default checkIfInstallRecommended;
