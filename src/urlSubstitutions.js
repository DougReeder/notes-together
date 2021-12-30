// urlSubstitutions.js - URL replacement for save
// Copyright © 2021 Doug Reeder

import {evaluateImage, fileToDataUrl} from "./util/imageFileToDataUrl";


const MAX_SIZE = 200_000;    // max content size / 3


let promises = [];

function clearSubstitutions() {
  promises = [];
}

function addSubstitution(objectUrl) {
  promises.push(
      objectUrlToDataUrl(objectUrl)
  );
}

async function objectUrlToDataUrl(objectUrl) {
  try {
    let blob;
    const response = await fetch(objectUrl);
    if (response.ok) {
      blob = await response.blob();
    } else {
      throw new Error(response.statusText);
    }

    // avoids converting vector to raster if reasonably possible
    if (blob?.size < (MAX_SIZE * 1.4) && blob?.type === 'image/svg+xml') {
      const dataUrl = await fileToDataUrl(blob);
      return {old: objectUrl, new: dataUrl};
    }

    const dataUrl = await evaluateImage(blob, objectUrl);
    window.postMessage({kind: 'TRANSIENT_MSG', message: "Graphic may not be saved", severity: 'warning'}, window?.location?.origin);
    return {old: objectUrl, new: dataUrl};
  } catch (err) {
    console.error(`URL substitution err ${objectUrl}:`, err);
    window.postMessage({kind: 'TRANSIENT_MSG', message: "Can't save graphic"}, window?.location?.origin);
    throw err;
  }
}

async function currentSubstitutions() {
  const outcomes = await Promise.allSettled(promises);

  const map = new Map();
  for (const outcome of outcomes) {
    if ('fulfilled' === outcome.status) {
      map.set(outcome.value.old, outcome.value.new);
    }
  }
  return map;
}

export {clearSubstitutions, addSubstitution, currentSubstitutions};
