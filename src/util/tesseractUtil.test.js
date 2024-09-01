// tesseractUtil.test.js — Unit tests for text recognition helpers
// Copyright © 2024–2025 Doug Reeder

import {tesseractBlocksToHTML, tesseractWordsToHTML} from "./tesseractUtil";

describe("tesseractBlocksToHTML", () => {
	it("should wrap iffy flowing text with insert and poor with delete", async () => {
		console.log = vitest.fn();
		const consoleErrorSpy = vitest.spyOn(console, 'error');
		const tesseractBlocks = [
			{confidence: 0.123, blocktype: 'FLOWING_TEXT', paragraphs: [{lines: [{confidence: 90.123, text: "Eratosthenes"}, {confidence: 70.123, text: "Cyrene"}]}]},
			{confidence: 1.123, blocktype: 'FLOWING_TEXT', paragraphs: [{lines: [{confidence: 50.987, text: "Library"}, {confidence: 15.123, text: "Alexandria"}]}]},
			{confidence: 90.123, blocktype: 'FLOWING_TEXT', paragraphs: [{lines: [{confidence: 20.456, text: "Sieve"}, {confidence: 29.456, text: "prime numbers"}]}]},
			{confidence: 3.123, blocktype: 'FLOWING_TEXT', paragraphs: [{lines: [{confidence: 11.111, text: "scientific writer"}, {confidence: 70.111, text: "astronomer"}]}]},
		];

		const html = tesseractBlocksToHTML(tesseractBlocks);
		expect(html).toMatch(/<p>Eratosthenes<ins>Cyrene<\/ins><\/p>/);
		expect(html).toMatch(/<p><del>Library<\/del><\/p>/);
		expect(html).not.toMatch(/\bAlexandria\b/);
		expect(html).not.toMatch(/\bSieve\b/);
		expect(html).not.toMatch(/\bprime numbers\b/);
		expect(html).not.toMatch(/\bscientific writer\b/);
		expect(html).toMatch(/<p><ins>astronomer<\/ins><\/p>/);
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});

	it("should wrap iffy table rows with insert and poor with delete", async () => {
		console.log = vitest.fn();
		const consoleErrorSpy = vitest.spyOn(console, 'error');
		const tesseractBlocks = [
			{confidence: 0.123, blocktype: 'TABLE', paragraphs: [
					{lines: [{confidence: 50.123, text: "oldest"}, {confidence: 70.123, text: "complaint"}]},
					{lines: [{confidence: 20.987, text: "tablet"}, {confidence: 50.123, text: "Ea-nāṣir"}]},
				]},
		];

		const html = tesseractBlocksToHTML(tesseractBlocks);
		expect(html).toMatch(/<tr><td><del>oldest<\/del><\/td><\/tr>/);
		expect(html).toMatch(/<tr><td><ins>complaint<\/ins><\/td><\/tr>/);
		expect(html).not.toMatch(/\btablet\b/);
		expect(html).toMatch(/<tr><td><del>Ea-nāṣir<\/del><\/td><\/tr>/);
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});
});

describe("tesseractWordsToHTML", () => {
	it("should be italicized superscript block quote containing only confident matches", () => {
		const tesseractWords = [
			{choices: [{confidence: 90.123, text: "puffer"}]},
			{choices: [{confidence: 70.123, text: "misanthrope"}]},
			{choices: [{confidence: 50.123, text: "unremarkable"}]},
			{choices: [{confidence: 1, text: "alembic"}]},
		];

		const html = tesseractWordsToHTML(tesseractWords);
		expect(html).toMatch(/\bPUFFER(?!<)\b/);
		expect(html).toMatch(/<ins>MISANTHROPE<\/ins>/);
		expect(html).toMatch(/<del>UNREMARKABLE<\/del>/);
		expect(html).not.toMatch(/\bALEMBIC\b/);
		expect(html).toMatch(/^<sup><i>/);
		expect(html).toMatch(/<\/i><\/sup>$/);
	});

	it("should produce sorted minimal set of words for indexing", () => {
		const tesseractWords = [
			{choices: [{confidence: 1, text: "unicorn"}]},
			{choices: [{confidence: 70, text: "valve"}]},
			{choices: [{confidence: 70, text: "there"}]},
			{choices: [{confidence: 50, text: "the"}]},
			{choices: [{confidence: 90, text: "therein"}]},
		];

		const html = tesseractWordsToHTML(tesseractWords);
		expect(html).toEqual('<sup><i>THEREIN <ins>VALVE</ins></i></sup>');
		expect(html).not.toMatch(/\bTHERE\b/);
		expect(html).not.toMatch(/\bTHE\b/);
	});
});
