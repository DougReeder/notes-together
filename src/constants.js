// constants.js — constant values for Notes Together
// Copyright © 2021–2024 Doug Reeder under the MIT License


export const INLINE_ELEMENTS = ['link'];

// ASCII, Unicode, no-break & soft hyphens
// ASCII apostrophe, right-single-quote, modifier-letter-apostrophe
export const globalWordRE = /[\w\u00AA\u00B2\u00B3\u00B5\u00B9\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\u02BC\u037A\u037F\u0384-\u0386\u0388-\u03CE\u03D0-\u03D6\u03D9-\u03E1\u03F3\u1E00-\u1FFC\u2070-\u2079\u207F-\u2089\u2090-\u2094\u2460-\u24FD\u2C60-\u2C7F\uA728-\uA7AF\uFF10-\uFF5A]([-‐‑­'’ʼ.   ^]*[\w\u00AA\u00B2\u00B3\u00B5\u00B9\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\u02BC\u037A\u037F\u0384-\u0386\u0388-\u03CE\u03D0-\u03D6\u03D9-\u03E1\u03F3\u1E00-\u1FFC\u2070-\u2079\u207F-\u2089\u2090-\u2094\u2460-\u24FD\u2C60-\u2C7F\uA728-\uA7AF\uFF10-\uFF5A]+)*/g;

export const allowedFileTypesNonText = ['application/mathml+xml','application/xhtml+xml','image/svg+xml', 'application/yaml','application/x-yaml', 'application/json', 'application/ld+json', 'application/sql','application/javascript', 'application/x-javascript', 'application/ecmascript','message/rfc822','message/global', 'application/mbox', 'application/x-shellscript', 'application/x-sh', 'application/x-csh', 'application/x-tex', 'application/x-troff', 'application/x-info', 'application/vnd.uri-map', 'application/mathematica', 'application/vnd.dart', 'application/x-httpd-php'];

export const allowedExtensions = ['.txt', '.text', '.readme', '.me', '.1st', '.plain', '.ascii', '.log', '.markdown', '.md', '.mkd', '.mkdn', '.mdown', '.markdown', '.adoc', '.textile', '.rst', '.etx', '.org', '.apt', '.pod', '.html', '.htm', '.xhtml', '.mml', '.mathml', '.msg', '.eml', '.mbox', '.tex', '.t', '.php', '.jsp', '.asp', '.mustache', '.hbs', '.erb', '.njk', '.ejs', '.haml', '.pug', '.erb', '.webc', '.liquid', '.xo', '.json', '.yaml', '.yml', '.awk', '.vcs', '.ics', '.abc', '.js', '.ts', '.jsx', '.css', '.less', '.sass', '.glsl', '.webmanifest', '.m', '.java', '.properties', '.groovy', '.gvy', '.gy', '.gsh', '.el', '.sql', '.c', '.h', '.pch', '.cc', '.cxx', '.cpp', '.hpp', '.strings', '.p', '.py', '.rb', '.pm', '.dart', '.erl', '.hs', '.wat', '.asm', '.rcp', '.diff', '.make', '.mak', '.mk', '.nmk', '.cmake', '.snap', '.hbx', '.sh', '.bash', '.csh', '.bat', '.inf', '.ni', '.gradle', '.ldif', '.url', '.uri', '.uris', '.urim', '.urimap', '.meta', '.mtl', '.obj', '.gltf', '.service', '.toml'];

// The file filter allows all text/* types
export const unsupportedTextSubtypes = ['rtf', 'xml', 'xml-external-parsed-entity', 'SGML', 'uuencode'];
