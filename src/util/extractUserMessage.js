// extractUserMessage.js - extracts a message for the end-user from an error
// Copyright © 2021-2024 Doug Reeder under the MIT license

export function extractUserMessage(err, defaultMessage = "Close and re-open this tab") {
  if (err?.userMsg) {
    return err.userMsg;
  } else if (err?.error?.message) {   // Remote Storage
    return err.error.message;
  } else if (err?.message) {
    return err.message;
  } else {
    return defaultMessage;
  }
}


export  function transientMsg(message, severity = 'error', atTop = false) {
  postMessage({
    kind: 'TRANSIENT_MSG',
    severity,
    message,
    atTop,
  }, '/');
}
