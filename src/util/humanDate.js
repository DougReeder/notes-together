// humanDate.js - utility function for Serene Notes
// Copyright © 2013-2021 Doug Reeder

const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function humanDate(dateTimeValue) {
	let date, dayDiff;

	if (typeof dateTimeValue === "number") {
		date = new Date(dateTimeValue);
	} else if (dateTimeValue instanceof Date) {
		date = dateTimeValue;
	} else {
		return 'not a date';
	}

	const now = new Date();

	if (now - date > 32 * 86400000) {   // quick check for more than a month ago
		return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
	} else {
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

		const weekAgo = new Date(now - 6 * 86400000);
		weekAgo.setHours(0, 0, 0, 0);

		if (now.getDay() === 0) {   // Sunday
			dayDiff = 13;
		} else {
			dayDiff = now.getDay() + 6;
		}
		const lastWeekStart = new Date(now - dayDiff * 86400000);   // a Monday
		lastWeekStart.setHours(0, 0, 0, 0);

		if (date < weekAgo) {
			if (date > lastWeekStart) {
				return 'Last week';
			} else if (date < monthStart) {   // last month
				return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
			} else {
				return 'Earlier this month';
			}
		} else {
			const dayBeforeYesterday = new Date(now - 2 * 86400000);
			dayBeforeYesterday.setHours(0, 0, 0, 0);
			const dayOfWeek = daysOfWeek[date.getDay()];
			if (date < dayBeforeYesterday) {
				return dayOfWeek;
			} else {
				const yesterday = new Date(now - 86400000);
				yesterday.setHours(0, 0, 0, 0);
				if (date < yesterday) {
					return `Day before yesterday (${dayOfWeek})`;
				} else {
					const today = new Date();
					today.setHours(0, 0, 0, 0);
					if (date < today) {
						return `Yesterday (${dayOfWeek})`;
					} else {
						const tomorrow = new Date(Date.now() + 86400000);
						tomorrow.setHours(0, 0, 0, 0);
						if (date < tomorrow) {
							return `Today (${dayOfWeek})`;
						} else {
							const dayAfterTomorrow = new Date(Date.now() + 2 * 86400000);
							dayAfterTomorrow.setHours(0, 0, 0, 0);
							if (date < dayAfterTomorrow) {
								return `Tomorrow (${dayOfWeek})`;
							} else {
								const threeDaysAhead = new Date(Date.now() + 3 * 86400000);
								threeDaysAhead.setHours(0, 0, 0, 0);
								if (date < threeDaysAhead) {
									return `Day after tomorrow (${dayOfWeek})`;
								} else {
									const weekAhead = new Date(Date.now() + 7 * 86400000);
									weekAhead.setHours(0, 0, 0, 0);
									if (date < weekAhead) {
										return `This coming ${dayOfWeek}`;
									} else {
										return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
									}
								}
							}
						}
					}
				}
			}
		}
	}
};
