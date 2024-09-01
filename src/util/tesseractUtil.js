// tesseractUtil.js — text recognition helpers
// Copyright © 2024–2025 Doug Reeder

import escapeHtml from "escape-html";
import {normalizeWord} from "../storage.js";
import {globalWordRE} from "../constants.js";

const THRESHOLD_GOOD = 77.5;
const THRESHOLD_IFFY = 55;
const THRESHOLD_POOR = 32.5;

function qualityMarks(confidence) {
	if (confidence >= THRESHOLD_GOOD) {
		return [true, '', ''];
	} else if (confidence >= THRESHOLD_IFFY) {
		return [true, '<ins>', '</ins>'];
	} else if (confidence >= THRESHOLD_POOR) {
		return [true, '<del>', '</del>'];
	} else {
		return [false, null, null];
	}
}

export function tesseractBlocksToHTML(blocks = []) {
	const htmlBlocks = [];
	for (const block of blocks) {
		try {
			console.debug(block.blocktype, Math.round(block.confidence * 100) / 100, block.text);
			const [usableBlock, qualStartBlock, qualEndBlock] = qualityMarks(block.confidence);
			switch (block.blocktype) {
				case 'FLOWING_TEXT':
					for (const paragraph of block.paragraphs) {
						htmlBlocks.push('<p>');
						for (const line of paragraph.lines) {
							const [use, qualStart, qualEnd] = qualityMarks(line.confidence);
							if (use) {
								htmlBlocks.push(qualStart + escapeHtml(line.text) + qualEnd);
							}
						}
						htmlBlocks.push('</p>');
					}
					break;
				case 'HEADING_TEXT':
					if (usableBlock) {
						htmlBlocks.push('<h3>' + qualStartBlock + escapeHtml(block.text) + qualEndBlock + '</h3>');
					}
					break;
				case 'TABLE':
					htmlBlocks.push('<table>');
					for (const paragraph of block.paragraphs) {
						for (const line of paragraph.lines) {
							const [use, qualStart, qualEnd] = qualityMarks(line.confidence);
							if (use) {
								htmlBlocks.push('<tr><td>' + qualStart + escapeHtml(line.text) + qualEnd + '</td></tr>');
							}
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
						lines.push(...paragraph.lines.map(line => {
							const [use, qualStart, qualEnd] = qualityMarks(line.confidence);
							if (use) {
								return qualStart + escapeHtml(line.text) + qualEnd;
							}
						}));
					}
					htmlBlocks.push(lines.join('<br>'));
					htmlBlocks.push('</blockquote>');
					break;
				case 'HORZ_LINE':
					if (usableBlock) {
						htmlBlocks.push(qualStartBlock + '<hr>' + qualEndBlock);
					}
					break;
				case 'FLOWING_IMAGE':
				case 'NOISE':
					break;
				default:
					if (usableBlock) {
						const text = block.text?.trim();
						if (text) {
							htmlBlocks.push('<pre>' + qualStartBlock + escapeHtml(text) + qualEndBlock + '</pre>');
						}
					}
					break;
			}
		} catch (err) {
			console.error(err, block);
		}
	}

	return htmlBlocks.join('');
}

export function tesseractWordsToHTML(words = []) {
	const wordRE = new RegExp(globalWordRE);
	/**
	 * @typedef WordRec
	 * @type {object}
	 * @property {string} word — normalized word
	 * @property {number} confidence — recognition confidence
	 */
	/** @type {Set<WordRec>} */
	const wordRecs = new Set();
	for (const word of words) {
		for (const choice of word.choices) {
			console.debug(Math.round(choice.confidence * 100) / 100, choice.text);
			if (choice.confidence < THRESHOLD_POOR) { continue; }
			wordRE.lastIndex = 0;
			const match = wordRE.exec(choice.text);
			if (match) {
				const normalizedWord = normalizeWord(match[0]);
				if (normalizedWord.length >= 3) {
					let addWordFlag = true;
					for (const existingRec of wordRecs) {
						if (normalizedWord === existingRec.word) {
							addWordFlag = false;
							existingRec.confidence = Math.max(choice.confidence, existingRec.confidence);
							break;   // no need to compare with further words
						} else if (normalizedWord.length === existingRec.word?.length) {
							// just adds word to set
						} else if (normalizedWord.startsWith(existingRec.word)) {
							wordRecs.delete(existingRec);
							break;   // no need to compare with further words
						} else if (existingRec?.word?.startsWith(normalizedWord)) {
							addWordFlag = false;
							break;   // no need to compare with further words
						}
					}
					if (addWordFlag) {
						wordRecs.add({word: normalizedWord, confidence: choice.confidence});
					}
				}
			}
		}
	}

	const sortedRecs = Array.from(wordRecs).sort((a, b) => a.word.localeCompare(b.word));

	/** @type {Array<string>} */
	const wordHtml = [];
	for (const rec of sortedRecs) {
		const [_, qualityStart, qualityEnd] = qualityMarks(rec.confidence);
		wordHtml.push(qualityStart + rec.word + qualityEnd);
	}

	if (wordHtml.length > 0) {
		return '<sup><i>' + wordHtml.join(' ') + '</i></sup>';
	} else {
		return '';
	}
}
