// determine if type should be treated as rich text
// Copyright © 2021 Doug Reeder

export default function hasTagsLikeHtml(mimeType) {
  return ['text/html', 'application/xhtml+xml', 'application/mathml+xml', 'image/svg+xml', 'text/xml'].includes(mimeType?.split(';')[0]);
}
