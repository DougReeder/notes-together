// imageFileToDataUrl.js - downscales an image & converts to data URL
// Copyright © 2017-2024 Doug Reeder
/* eslint-env browser, worker */

const MAX_SIZE = 200_000;   // max content size / 3


async function imageFileToDataUrl(file) {
  const texts = [];
  if (file.name) {
    // const lastDotInd = file.name.lastIndexOf(".");
    // if (lastDotInd > 0 && lastDotInd < file.name.length - 1) {
    //   texts.push(file.name.slice(0, lastDotInd));
    // } else {
      texts.push(file.name);
    // }
  }

  let dataUrl;
  // avoids converting vector to raster if reasonably possible
  if ((file.size < (MAX_SIZE * 1.4) && file.type === 'image/svg+xml')) {
    dataUrl = await fileToDataUrl(file);
  } else if ('function' === typeof URL.createObjectURL) {   // not available in a Service Worker
    const objectUrl = URL.createObjectURL(file);
    dataUrl = await evaluateImage(file, objectUrl);
    URL.revokeObjectURL(objectUrl);
  } else if ('function' === typeof createImageBitmap) {   // not available in Node (for testing)
    dataUrl = await evaluateImageBitmap(file);
  } else {
    dataUrl = await fileToDataUrl(file);
  }

  return {dataUrl, alt: texts.join('\n')};
}

const NOT_CROSS_BROWSER = ['image/tiff', 'image/jp2', 'image/jxl', 'image/avci', 'image/heif', 'image/heic'];

function evaluateImage(blob, objectURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = objectURL;

    img.onload = async function (_evt) {   // 'this' is the img
      // Modern browsers respect the orientation data in EXIF.
      // console.log("img onload size:", this.width, this.height);

      if (this.width > 1280 || this.height > 1280 || blob.size > MAX_SIZE || NOT_CROSS_BROWSER.includes(blob.type)) {
        resolve(resize(img, blob.type));
      } else {
        resolve(await fileToDataUrl(blob));
      }
    };

    img.onerror = function (_evt) {
      const msg = `img onerror: “${blob.name}” (${blob.type}) ${blob.size} bytes`;
      console.error(msg);
      const err = new Error(msg);
      err.userMsg = "Can you convert to a different format? Not loadable";
      reject(err);
    }
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (evt) {
      const dataUrl = evt.target.result;
      resolve(dataUrl);
    };
    reader.onerror = evt => {
      console.error("fileToDataUrl:", reader.error);
      reject(evt.target.error);
    }
    reader.readAsDataURL(file);
  });
}

function resize(img, fileType) {
  const canvas = document.createElement('canvas');
  if (img.width >= img.height) {   // constrain width
    canvas.width = Math.min(1280, img.width);   // logical width
    canvas.height = Math.round((img.height / img.width) * canvas.width);
  } else {   // constrain height
    canvas.height = Math.min(1280, img.height);   // logical height
    canvas.width = Math.round((img.width / img.height) * canvas.height);
  }
  console.info(`resizing to ${canvas.width}×${canvas.height} using Canvas`);

  const context = canvas.getContext('2d');
  if (!(['image/jpeg', 'image/bmp'].includes(fileType))) {   // might have transparent background
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  let dataUrl = canvas.toDataURL('image/webp', 0.4);
  const actualMimeType = /^data:([A-Za-z]+\/[-\w.+]+)/.exec(dataUrl)?.[1];
  if ('image/png' === actualMimeType) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.4);
  }
  return dataUrl;
}

async function evaluateImageBitmap(file) {
  let imageBitmap = await createImageBitmap(file);
  if ((imageBitmap.width > 1280 || imageBitmap.height > 1280 || file.size > MAX_SIZE ||
      NOT_CROSS_BROWSER.includes(file.type)) &&
      !('image/jpeg' === file.type && imageBitmap.height > imageBitmap.width && file.size <= MAX_SIZE)) {
      // portrait JPEGs don't always come through with the correct orientation
    let canvasWidth, canvasHeight;
    if (imageBitmap.width > imageBitmap.height) {
      canvasWidth = Math.min(imageBitmap.width, 1280);
      canvasHeight = Math.round(imageBitmap.height * canvasWidth / imageBitmap.width);
    } else {
      canvasHeight = Math.min(imageBitmap.height, 1280);
      canvasWidth = Math.round(imageBitmap.width * canvasHeight / imageBitmap.height);
    }
    if (canvasWidth !== imageBitmap.width || canvasHeight !== imageBitmap.height) {
      imageBitmap.close();
      imageBitmap = await createImageBitmap(file, {resizeWidth: canvasWidth, resizeHeight: canvasHeight});
    }
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    console.info(`resizing “${file.name}” to ${canvas.width}×${canvas.height} using OffscreenCanvas`);
    const context = canvas.getContext("bitmaprenderer");
    context.transferFromImageBitmap(imageBitmap);   // consumes bitmap
    let blob = await canvas.convertToBlob({type: 'image/webp', quality: 0.4});
    if ('image/png' === blob.type) {
      blob = await canvas.convertToBlob({type: 'image/jpeg', quality: 0.4});
    }
    return await fileToDataUrl(blob);
  } else {
    console.info(`importing “${file.name}” at original resolution of ${imageBitmap.width}×${imageBitmap.height}`);
    imageBitmap.close();
    return await fileToDataUrl(file);
  }
}

export {imageFileToDataUrl, fileToDataUrl, evaluateImage};
