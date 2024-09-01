// tesseractUtil.js — text recognition helpers
// Copyright © 2024 Doug Reeder

import {normalizeWord} from "../storage.js";
import {globalWordRE} from "../constants.js";

export function tesseractBlocksToHTML(blocks) {
	const htmlBlocks = [];
	for (const block of blocks) {
		console.log(block.blocktype, block.text);
		switch (block.blocktype) {
			case 'FLOWING_TEXT':
				for (const paragraph of block.paragraphs) {
					htmlBlocks.push('<p>' + paragraph.text + '</p>');
				}
				break;
			case 'HEADING_TEXT':
				htmlBlocks.push('<h3>' + block.text + '</h3>');
				break;
			case 'TABLE':
				htmlBlocks.push('<table>');
				for (const paragraph of block.paragraphs) {
					for (const line of paragraph.lines) {
						htmlBlocks.push('<tr><td>' + line.text + '</td></tr>');
					}
				}
				htmlBlocks.push('</table>');
				break;
			case 'PULLOUT_TEXT':
			case 'VERTICAL_TEXT':
			case 'CAPTION_TEXT':
				htmlBlocks.push('<blockquote>');
				const lines = [];
				for (const paragraph of block.paragraphs) {
					lines.push(...paragraph.lines.map(line => line.text));
				}
				htmlBlocks.push(lines.join('<br>'));
				htmlBlocks.push('</blockquote>');
				break;
			case 'HORZ_LINE':
				htmlBlocks.push('<hr>');
				break;
			case 'NOISE':
				break;
			default:
				const text = block.text?.trim();
				if (text) {
					htmlBlocks.push('<pre>' + text + '</pre>');
				}
				break;
		}
	}

	return htmlBlocks.join('');
}

const THRESHOLD_FOR_INDEXING = 40;

export function tesseractWordsToHTML(words) {
	const wordRE = new RegExp(globalWordRE);
	const wordSet = new Set();
	for (const word of words) {
		for (const choice of word.choices) {
			if (choice.confidence > THRESHOLD_FOR_INDEXING) {
				wordRE.lastIndex = 0;
				const match = wordRE.exec(choice.text);
				if (match) {
					const normalizedWord = normalizeWord(match[0]);
					if (normalizedWord.length >= 3) {
						let addWordFlag = true;
						for (const existingWord of wordSet) {
							if (normalizedWord.length > existingWord.length) {
								if (normalizedWord.startsWith(existingWord)) {
									wordSet.delete(existingWord);
									break;
								}
							} else if (existingWord.startsWith(normalizedWord)) {
								addWordFlag = false;
								break;
							}
						}
						if (addWordFlag) {
							wordSet.add(normalizedWord);
						}
					}
				}
			}
		}
	}

	const htmlBlocks = [];
	htmlBlocks.push('<blockquote><sup><i>');
	for (const word of wordSet) {
		htmlBlocks.push(word + ' ');
	}
	htmlBlocks.push('</i></sup></blockquote>');

	return htmlBlocks.join('');
}
