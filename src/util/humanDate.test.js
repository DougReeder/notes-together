// unit tests for Notes Together humanDate.js
// Copyright © 2013-2021 Doug Reeder

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
		const yesterday = new Date(Date.now() - 86400000);
		yesterday.setHours(23, 59, 59, 999);
		expect(humanDate(yesterday)).toEqual('Yesterday (' + daysOfWeek[yesterday.getDay()] + ')');
	});

	it('should format 12am yesterday as "Yesterday (<day-of-week>)"', function () {
		const yesterday = new Date(Date.now() - 86400000);
		yesterday.setHours(0, 0, 0, 0);
		expect(humanDate(yesterday)).toEqual('Yesterday (' + daysOfWeek[yesterday.getDay()] + ')');
	});


	it('should format 11:59 p.m. two days ago as "Day before yesterday (<day-of-week>)"', function () {
		const twoDaysAgo = new Date(Date.now() - 2*86400000);
		twoDaysAgo.setHours(23, 59, 59, 999);
		const twoDaysAgoDayOfWeek = daysOfWeek[twoDaysAgo.getDay()];
		expect(humanDate(twoDaysAgo)).toEqual('Day before yesterday (' + twoDaysAgoDayOfWeek + ')');
	});

	it('should format 12am two days ago as "Day before yesterday (<day-of-week>)"', function () {
		const twoDaysAgo = new Date(Date.now() - 2*86400000);
		twoDaysAgo.setHours(0, 0, 0, 0);
		const twoDaysAgoDayOfWeek = daysOfWeek[twoDaysAgo.getDay()];
		expect(humanDate(twoDaysAgo)).toEqual('Day before yesterday (' + twoDaysAgoDayOfWeek + ')');
	});


	it('should format three days ago as a day-of-week', function () {
		const threeDaysAgo = new Date(Date.now() - 3*86400000);
		threeDaysAgo.setHours(23, 59, 59, 999);
		const threeDaysAgoDayOfWeek = daysOfWeek[threeDaysAgo.getDay()];
		expect(humanDate(threeDaysAgo)).toEqual(threeDaysAgoDayOfWeek);
	});

	it('should format six days ago as a day-of-week', function () {
		const sixDaysAgo = new Date(Date.now() - 6*86400000);
		sixDaysAgo.setHours(0, 0, 0, 0);   // midnight beginning
		const sixDaysAgoDayOfWeek = daysOfWeek[sixDaysAgo.getDay()];
		expect(humanDate(sixDaysAgo)).toEqual(sixDaysAgoDayOfWeek);
	});


	it('should format a week ago as "Last week"', function () {
		const weekAgo = new Date(Date.now() - 7*86400000);
		weekAgo.setHours(23, 59, 59, 999);
		const dateStr = humanDate(weekAgo);
		expect(dateStr).toEqual('Last week');
	});


	const monthStart = new Date();
	monthStart.setDate(1);
	monthStart.setHours(0, 0, 0, 0);

	const twoWeeksAgo = new Date(Date.now() - 14*86400000);
	twoWeeksAgo.setHours(23, 59, 59, 999);

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
		const tomorrow = new Date(Date.now() + 86400000);
		tomorrow.setHours(0, 0, 0, 0);
		expect(humanDate(tomorrow)).toEqual('Tomorrow (' + daysOfWeek[tomorrow.getDay()] + ')');
	});

	it("should convert 11:59 p.m. tomorrow into 'Tomorrow (<day-of-week>)'", function () {
		const tomorrow = new Date(Date.now() + 86400000);
		tomorrow.setHours(23, 59, 59, 999);
		expect(humanDate(tomorrow)).toEqual('Tomorrow (' + daysOfWeek[tomorrow.getDay()] + ')');
	});


	it('should format two days ahead as "Day after tomorrow (<day-of-week>)"', function () {
		const twoDaysAhead = new Date(Date.now() + 2*86400000);
		twoDaysAhead.setHours(0, 0, 0, 0);   // midnight beginning
		expect(humanDate(twoDaysAhead)).toEqual('Day after tomorrow (' + daysOfWeek[twoDaysAhead.getDay()] + ')');
	});


	it('should format three days ahead as "This coming <day of week>"', function () {
		const threeDaysAhead = new Date(Date.now() + 3*86400000);
		threeDaysAhead.setHours(0, 0, 0, 0);   // midnight beginning
		expect(humanDate(threeDaysAhead)).toEqual('This coming ' + daysOfWeek[threeDaysAhead.getDay()]);
	});

	it('should format six days ahead as as "This coming <day of week>"', function () {
		const sixDaysAhead = new Date(Date.now() + 6*86400000);
		sixDaysAhead.setHours(23, 59, 59, 999);
		expect(humanDate(sixDaysAhead)).toEqual('This coming ' + daysOfWeek[sixDaysAhead.getDay()]);
	});


	it('should format a week ahead as month and year', function () {
		const weekAhead = new Date(Date.now() + 8*86400000);
		weekAhead.setHours(0, 0, 0, 0);
		const dateStr = humanDate(weekAhead);
		expect(dateStr).toMatch(new RegExp('^(January|February|March|April|May|June|July|August|September|October|November|December)\\s\\d\\d\\d\\d$'));
	});
});


