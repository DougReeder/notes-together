// constants.js — constant values for Notes Together
// Copyright © 2021–2024 Doug Reeder under the MIT License


export const INLINE_ELEMENTS = ['link'];

// ASCII, Unicode, no-break & soft hyphens
// ASCII apostrophe, right-single-quote, modifier-letter-apostrophe
export const globalWordRE = /[\p{L}\p{N}_]([-‐‑­'’ʼ.   ^]*[\p{L}\p{N}_]+)*/ug;

export const allowedFileTypesNonText = ['application/mathml+xml','application/xhtml+xml','image/svg+xml', 'application/yaml','application/x-yaml', 'application/json', 'application/ld+json', 'application/sql','application/javascript', 'application/x-javascript', 'application/ecmascript','message/rfc822','message/global', 'application/mbox', 'application/x-shellscript', 'application/x-sh', 'application/x-csh', 'application/x-tex', 'application/x-troff', 'application/x-info', 'application/vnd.uri-map', 'application/mathematica', 'application/vnd.dart', 'application/x-httpd-php'];

export const allowedExtensions = ['.txt', '.text', '.readme', '.me', '.1st', '.plain', '.ascii', '.log', '.markdown', '.md', '.mkd', '.mkdn', '.mdown', '.markdown', '.adoc', '.textile', '.rst', '.etx', '.org', '.apt', '.pod', '.html', '.htm', '.xhtml', '.mml', '.mathml', '.msg', '.eml', '.mbox', '.tex', '.t', '.php', '.jsp', '.asp', '.mustache', '.hbs', '.erb', '.njk', '.ejs', '.haml', '.pug', '.erb', '.webc', '.liquid', '.xo', '.json', '.yaml', '.yml', '.awk', '.vcs', '.ics', '.abc', '.js', '.ts', '.jsx', '.css', '.less', '.sass', '.glsl', '.webmanifest', '.m', '.java', '.properties', '.groovy', '.gvy', '.gy', '.gsh', '.el', '.sql', '.c', '.h', '.pch', '.cc', '.cxx', '.cpp', '.hpp', '.strings', '.p', '.py', '.rb', '.pm', '.dart', '.erl', '.hs', '.wat', '.asm', '.rcp', '.diff', '.make', '.mak', '.mk', '.nmk', '.cmake', '.snap', '.hbx', '.sh', '.bash', '.csh', '.bat', '.inf', '.ni', '.gradle', '.ldif', '.url', '.uri', '.uris', '.urim', '.urimap', '.meta', '.mtl', '.obj', '.gltf', '.service', '.toml'];

// The file filter allows all text/* types
export const unsupportedTextSubtypes = ['rtf', 'xml', 'xml-external-parsed-entity', 'SGML', 'uuencode'];
