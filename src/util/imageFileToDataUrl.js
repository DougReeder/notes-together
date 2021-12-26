// imageFileToDataUrl.js - downscales an image & converts to data URL
// Copyright © 2017-2021 Doug Reeder

export default function imageFileToDataUrl(file) {
  return new Promise(async (resolve, reject) => {
    const MAX_SIZE = 200_000;   // max note size / 3
    const texts = [];
    if (file.name) {
      const lastDotInd = file.name.lastIndexOf(".");
      if (lastDotInd > 0 && lastDotInd < file.name.length - 1) {
        texts.push(file.name.slice(0, lastDotInd));
      } else {
        texts.push(file.name);
      }
    }

    // avoids converting vector to raster if reasonably possible
    if (file.size < (MAX_SIZE * 1.4) && file.type === 'image/svg+xml') {
      const dataUrl = await fileToDataUrl(file);
      resolve({dataUrl, alt: texts.join('\n')});
      return;
    }

    const img = new Image();

    const objectURL = URL.createObjectURL(file);
    img.src = objectURL;

    img.onload = async function(evt) {   // 'this' is the img
      // Modern browsers respect the orientation data in EXIF.
      // console.log("img onload size:", this.width, this.height);

      if (this.width > 1280 || this.height > 1280 || file.size > MAX_SIZE ||
          ['image/tiff', 'image/jxl', 'image/avif', 'image/avci', 'image/heif', 'image/heic'].includes(file.type)) {
        const dataUrl = resize(img, file.type);
        URL.revokeObjectURL(objectURL);
        resolve({dataUrl, alt: texts.join('\n')});
      } else {
        const dataUrl = await fileToDataUrl(file);
        URL.revokeObjectURL(objectURL);
        resolve({dataUrl, alt: texts.join('\n')});
      }
    };

    img.onerror = function (evt) {
      console.error("img onerror:", evt)
      URL.revokeObjectURL(objectURL);
      reject(evt.error || new Error(evt.message));
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
      console.error(reader.error)
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
