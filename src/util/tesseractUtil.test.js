// tesseractUtil.test.js — Unit tests for text recognition helpers
// Copyright © 2024 Doug Reeder

import {tesseractWordsToHTML} from "./tesseractUtil";

describe("tesseractWordsToHTML", () => {
	it("should be italicized superscript block quote containing only confident matches", () => {
		const tesseractWords = [
			{choices: [{confidence: 90, text: "puffer"}]},
			{choices: [{confidence: 1, text: "alembic"}]},
			{choices: [{confidence: 90, text: "misanthrope"}]},
		];

		const html = tesseractWordsToHTML(tesseractWords);
		expect(html).toMatch(/\bPUFFER\b/);
		expect(html).toMatch(/\bMISANTHROPE\b/);
		expect(html).not.toMatch(/\bALEMBIC\b/);
		expect(html).toMatch(/^<blockquote><sup><i>/);
		expect(html).toMatch(/<\/i><\/sup><\/blockquote>$/);
	});

	it("should produce minimal set of words for indexing", () => {
		const tesseractWords = [
			{choices: [{confidence: 1, text: "unicorn"}]},
			{choices: [{confidence: 90, text: "there"}]},
			{choices: [{confidence: 90, text: "the"}]},
			{choices: [{confidence: 90, text: "therein"}]},
		];

		const html = tesseractWordsToHTML(tesseractWords);
		expect(html).toMatch(/\bTHEREIN\b/);
		expect(html).not.toMatch(/\bTHERE\b/);
		expect(html).not.toMatch(/\bTHE\b/);
	});
});
