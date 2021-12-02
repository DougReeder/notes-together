// extractUserMessage.js - extracts a message for the end-user from an error
// Copyright © 2021 Doug Reeder under the MIT license

export function extractUserMessage(err) {
  if (err?.userMsg) {
    return err.userMsg;
  } else if (err?.error?.message) {   // Remote Storage
    return err.error.message;
  } else if (err?.message) {
    return err.message;
  } else {
    return "Restart your device";
  }
}
