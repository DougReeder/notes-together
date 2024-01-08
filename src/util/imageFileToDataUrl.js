// imageFileToDataUrl.js - downscales an image & converts to data URL
// Copyright © 2017-2024 Doug Reeder


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

  // avoids converting vector to raster if reasonably possible
  if (file.size < (MAX_SIZE * 1.4) && file.type === 'image/svg+xml') {
    const dataUrl = await fileToDataUrl(file);
    return {dataUrl, alt: texts.join('\n')};
  }

  const objectUrl = URL.createObjectURL(file);
  const dataUrl = await evaluateImage(file, objectUrl);
  URL.revokeObjectURL(objectUrl);

  return {dataUrl, alt: texts.join('\n')};
}

function evaluateImage(blob, objectURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = objectURL;

    img.onload = async function (_evt) {   // 'this' is the img
      // Modern browsers respect the orientation data in EXIF.
      // console.log("img onload size:", this.width, this.height);

      if (this.width > 1280 || this.height > 1280 || blob.size > MAX_SIZE ||
          ['image/tiff', 'image/jxl', 'image/avif', 'image/avci', 'image/heif', 'image/heic'].includes(blob.type)) {
        resolve(resize(img, blob.type));
      } else {
        resolve(await fileToDataUrl(blob));
      }
    };

    img.onerror = function (_evt) {
      const msg = `img onerror: “${blob.name}” (${blob.type}) ${blob.size} bytes`;
      console.error(msg);
      const err = new Error(msg);
      err.userMsg = "Not loadable. Can you convert to a different format?";
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
    canvas.height = (img.height / img.width) * canvas.width;
  } else {   // constrain height
    canvas.height = Math.min(1280, img.height);   // logical height
    canvas.width = (img.width / img.height) * canvas.height;
  }
  console.info(`resizing to ${canvas.width}×${canvas.height}`);

  const context = canvas.getContext('2d');
  if (!(['image/jpeg', 'image/bmp'].includes(fileType))) {   // might have transparent background
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.4);
}

export {imageFileToDataUrl, fileToDataUrl, evaluateImage};
