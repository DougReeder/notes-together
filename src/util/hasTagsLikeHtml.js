// determine if type should be treated as rich text
// Copyright © 2021 Doug Reeder

export default function hasTagsLikeHtml(mimeType, extension) {
  if (['text/html', 'application/xhtml+xml', 'application/mathml+xml', 'text/php'].includes(mimeType?.split(';')[0])) {
    return true;
  }
  return !mimeType && ['.php', '.jsp', '.asp', '.mustache', '.hbs', '.erb', '.njk', '.ejs'].includes(extension);
}
