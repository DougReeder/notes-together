// InstallCheck.js - webapp installation component
// Copyright © 2023–2024 Doug Reeder

import {NonmodalDialog} from "./NonmodalDialog.jsx";
import PropTypes from "prop-types";
import {useEffect, useRef, useState} from "react";

const INSTALL_MIN_NOTES = 6;   // displays installation prompt when user has created enough notes
const INSTALL_REPROMPT_INTERVAL = 30 * 24 * 60 * 60 * 1000;    // ms before prompting again

let isInstalled = 'getInstalledRelatedApps' in navigator;   // true prevents showing dialog until check is complete
navigator.getInstalledRelatedApps?.()
  .then(installedApps => { isInstalled = installedApps?.length > 0; })
  .catch(console.error);

let installPromptDeferred;
window.addEventListener('beforeinstallprompt', (evt) => {
  evt.preventDefault();   // Prevents the system install prompt
  installPromptDeferred = evt;   // Saves to display system install prompt later
});

async function install() {
  const { outcome, platform } = await installPromptDeferred.prompt();   // Shows the system install prompt
  console.info(`system install prompt ${outcome}; platform "${platform}"`);
  isInstalled = 'accepted' === outcome;
  installPromptDeferred = null;   // can only be used once
}

export default function InstallCheck({notesLength, isFirstLaunch}) {
  const [promptString, setPromptString] = useState("");
  const onOkRef = useRef(null);
  const [cancelName, setCancelName] = useState("");

  useEffect(() => {
    const installPromptedDate = new Date(localStorage.getItem("notesTogether:installPromptedDate") || 0);
    // console.log(`isInstalled: ${isInstalled}  notesLength: ${notesLength}  isFirstLaunch: ${isFirstLaunch}  installPromptedDate: ${installPromptedDate}  display-mode standalone: «${window.matchMedia?.('(display-mode: standalone)').matches}»`);
    if (notesLength >= INSTALL_MIN_NOTES &&   // user engaged
        ! isFirstLaunch &&
        Date.now() - installPromptedDate > INSTALL_REPROMPT_INTERVAL &&   // not prompted too recently
        ! window.matchMedia('(display-mode: standalone)').matches &&   // not running standalone (i.e. installed)
        ! isInstalled) {

      if (installPromptDeferred) {   // System install prompt is available
        setPromptString('Install this webapp for a separate window & Sharing from native apps.');
        onOkRef.current = async () => {
          setPromptString("");
          onOkRef.current = null;
          await install();
          localStorage.setItem("notesTogether:installPromptedDate", Date())
        };
        setCancelName("Not Now");
      } else if (/\b(iPad|iPhone|iPod)\b/.test(navigator.userAgent) &&
        /WebKit/.test(navigator.userAgent) &&
        !/Edge/.test(navigator.userAgent) &&
        !window.MSStream &&   // not IE11, which lies
        !/\bFxiOS\/[\d.]+\b/.test(navigator.userAgent)) {   // not Firefox on iOS
        setPromptString('For easy access and a separate window, tap the share button, then scroll down to "Add to Home Screen"');
        setCancelName("Close");
      } else if (/\bMacintosh\b/.test(navigator.userAgent) &&
        /Safari\/[\d.]+/.test(navigator.userAgent) &&
        ! /\bChrom\w{1,3}\/[\d.]+\b/.test(navigator.userAgent)) {   // not Chrome/Chromium
        setPromptString('For easy access and a separate window, click the share button, then "Add to Dock"');
        setCancelName("Close");
      } else if (/\bMobile\b/.test(navigator.userAgent) &&
        /\bFirefox\/[\d.]+\b/.test(navigator.userAgent) &&
        ! /\bSeamonkey\/[\d.]+\b/.test(navigator.userAgent)) {   // not Seamonkey
        setPromptString('For easy access and a separate window, from the Firefox (meatball) menu select "Install"');
        setCancelName("Close");
      }   // else not installable, at least not now, in this browser
    }
  }, [notesLength, isFirstLaunch]);

  return <NonmodalDialog open={Boolean(promptString)}
                         title={"Suggestion"} message={promptString}
                         okName="Install" onOk={onOkRef.current}
                         cancelName={cancelName}
                         onCancel={() => {
                           setPromptString("");
                           onOkRef.current = null;
                           localStorage.setItem("notesTogether:installPromptedDate", Date());
                         }} ></NonmodalDialog>;
}

InstallCheck.propTypes = {
  notesLength: PropTypes.number.isRequired,
  isFirstLaunch: PropTypes.bool.isRequired,
}
