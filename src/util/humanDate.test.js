// unit tests for Notes Together humanDate.js
// Copyright © 2013-2022 Doug Reeder

import humanDate from './humanDate';

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

describe('humanDate utility function', function () {
	it("should convert 12 a.m. today into 'Today (<day-of-week>)'", function () {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		expect(humanDate(today)).toEqual('Today (' + daysOfWeek[today.getDay()] + ')');
	});

	it("should convert 11:59 p.m. today into 'Today (<day-of-week>)'", function () {
		const today = new Date();
		today.setHours(23, 59, 59, 999);
		expect(humanDate(today)).toEqual('Today (' + daysOfWeek[today.getDay()] + ')');
	});


	it("should convert 11:59 p.m. yesterday into 'Yesterday (<day-of-week>)'", function () {
		const now = new Date();
		const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
		expect(humanDate(yesterday)).toEqual('Yesterday (' + daysOfWeek[yesterday.getDay()] + ')');
	});

	it('should format 12am yesterday as "Yesterday (<day-of-week>)"', function () {
		const now = new Date();
		const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
		expect(humanDate(yesterday)).toEqual('Yesterday (' + daysOfWeek[yesterday.getDay()] + ')');
	});


	it('should format 11:59 p.m. two days ago as "Day before yesterday (<day-of-week>)"', function () {
		const now = new Date();
		const twoDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 23, 59, 59, 999);
		const twoDaysAgoDayOfWeek = daysOfWeek[twoDaysAgo.getDay()];
		expect(humanDate(twoDaysAgo)).toEqual('Day before yesterday (' + twoDaysAgoDayOfWeek + ')');
	});

	it('should format 12am two days ago as "Day before yesterday (<day-of-week>)"', function () {
		const now = new Date();
		const twoDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 0, 0, 0, 0);
		const twoDaysAgoDayOfWeek = daysOfWeek[twoDaysAgo.getDay()];
		expect(humanDate(twoDaysAgo)).toEqual('Day before yesterday (' + twoDaysAgoDayOfWeek + ')');
	});


	it('should format three days ago as a day-of-week', function () {
		const now = new Date();
		const threeDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 23, 59, 59, 999);
		const threeDaysAgoDayOfWeek = daysOfWeek[threeDaysAgo.getDay()];
		expect(humanDate(threeDaysAgo)).toEqual(threeDaysAgoDayOfWeek);
	});

	it('should format six days ago as a day-of-week', function () {
		const now = new Date();
		const sixDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
		const sixDaysAgoDayOfWeek = daysOfWeek[sixDaysAgo.getDay()];
		expect(humanDate(sixDaysAgo)).toEqual(sixDaysAgoDayOfWeek);
	});


	it('should format a week ago as "Last week"', function () {
		const now = new Date();
		const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 23, 59, 59, 999);
		const dateStr = humanDate(weekAgo);
		expect(dateStr).toEqual('Last week');
	});


	const monthStart = new Date();
	monthStart.setDate(1);
	monthStart.setHours(0, 0, 0, 0);

	const now = new Date();
	const twoWeeksAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14, 23, 59, 59, 999);

	if (twoWeeksAgo < monthStart) {
		it('should format two weeks ago as month and year', function () {
			const dateStr = humanDate(twoWeeksAgo);
			expect(dateStr).toMatch(new RegExp('^(January|February|March|April|May|June|July|August|September|October|November|December)\\s\\d\\d\\d\\d$'));
		});
	} else {
		it('should format two weeks ago as "Earlier this month"', function () {
			const dateStr = humanDate(twoWeeksAgo);
			expect(dateStr).toEqual('Earlier this month');
		});
	}


	it('should format June 6, 2009 as "June 2009"', function () {
		const dateStr = humanDate(new Date('June 6, 2009'));
		expect(dateStr).toEqual('June 2009');
	});


	it("should convert 12 a.m. tomorrow into 'Tomorrow (<day-of-week>)'", function () {
		const now = new Date();
		const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
		expect(humanDate(tomorrow)).toEqual('Tomorrow (' + daysOfWeek[tomorrow.getDay()] + ')');
	});

	it("should convert 11:59 p.m. tomorrow into 'Tomorrow (<day-of-week>)'", function () {
		const now = new Date();
		const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999);
		expect(humanDate(tomorrow)).toEqual('Tomorrow (' + daysOfWeek[tomorrow.getDay()] + ')');
	});


	it('should format two days ahead as "Day after tomorrow (<day-of-week>)"', function () {
		const now = new Date();
		const twoDaysAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 0, 0, 0, 0);
		expect(humanDate(twoDaysAhead)).toEqual('Day after tomorrow (' + daysOfWeek[twoDaysAhead.getDay()] + ')');
	});


	it('should format three days ahead as "This coming <day of week>"', function () {
		const now = new Date();
		const threeDaysAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 0, 0, 0, 0);
		expect(humanDate(threeDaysAhead)).toEqual('This coming ' + daysOfWeek[threeDaysAhead.getDay()]);
	});

	it('should format six days ahead as as "This coming <day of week>"', function () {
		const now = new Date();
		const sixDaysAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6, 23, 59, 59, 999);
		expect(humanDate(sixDaysAhead)).toEqual('This coming ' + daysOfWeek[sixDaysAhead.getDay()]);
	});


	it('should format a week ahead as month and year', function () {
		const now = new Date();
		const weekAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8, 0, 0, 0, 0);
		const dateStr = humanDate(weekAhead);
		expect(dateStr).toMatch(new RegExp('^(January|February|March|April|May|June|July|August|September|October|November|December)\\s\\d\\d\\d\\d$'));
	});
});


