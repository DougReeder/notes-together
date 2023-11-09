// testUtil.js - utility function for automated testing

export function dataURItoFile(dataURI, fileName, date) {
  // converts base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  const byteString = atob(dataURI.split(',')[1]);

  // separates out the mime component
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

  // writes the bytes of the string to an ArrayBuffer
  const ab = new ArrayBuffer(byteString.length);

  // creates a view into the buffer
  const ia = new Uint8Array(ab);

  // sets the bytes of the buffer to the correct values
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  // writes the ArrayBuffer to a file
  let options = {type: mimeString};
  if (date) {
    options.lastModified = date.valueOf();
  }
  return new File([ab], fileName, options);
}


export function base64DecToArr (sBase64, nBlocksSize) {
  let
      sB64Enc = sBase64.replace(/[^A-Za-z0-9+\/]/g, ""), nInLen = sB64Enc.length,
      nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2, taBytes = new Uint8Array(nOutLen);

  for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
    nMod4 = nInIdx & 3;
    nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 6 * (3 - nMod4);
    if (nMod4 === 3 || nInLen - nInIdx === 1) {
      for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
        taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
      }
      nUint24 = 0;

    }
  }

  return taBytes;
}

function b64ToUint6 (nChr) {
  return nChr > 64 && nChr < 91 ?
      nChr - 65
      : nChr > 96 && nChr < 123 ?
          nChr - 71
          : nChr > 47 && nChr < 58 ?
              nChr + 4
              : nChr === 43 ?
                  62
                  : nChr === 47 ?
                      63
                      :
                      0;
}
