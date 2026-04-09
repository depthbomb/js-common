import { isUndefined } from './guards';
import type { DateLike } from './guards';

/**
 * Calendar/time delta values for add/subtract helpers.
 */
export interface IDateDelta {
	years?: number;
	months?: number;
	weeks?: number;
	days?: number;
	hours?: number;
	minutes?: number;
	seconds?: number;
	milliseconds?: number;
}

/**
 * Individual UTC date/time fields for {@link DateBuilder.set}.
 */
export interface IDateSetParts {
	year?: number;
	month?: number;
	date?: number;
	hours?: number;
	minutes?: number;
	seconds?: number;
	milliseconds?: number;
}

/**
 * Options for week-based boundaries.
 */
export interface IDateBoundaryOptions {
	weekStartsOn?: number;
}

export const enum DateUnit {
	Year        = 'year',
	Month       = 'month',
	Week        = 'week',
	Day         = 'day',
	Hour        = 'hour',
	Minute      = 'minute',
	Second      = 'second',
	Millisecond = 'millisecond'
}

/**
 * A chainable `Date` subclass for UTC-stable date manipulation.
 */
export class DateBuilder extends Date {
	public constructor(value: DateLike = new Date()) {
		super(coerceDate(value).getTime());
	}

	/**
	 * Clone the current rich date.
	 */
	public clone() {
		return new DateBuilder(this);
	}

	/**
	 * Return a plain `Date` copy.
	 */
	public toDate() {
		return new Date(this.getTime());
	}

	/**
	 * Add a calendar/time delta to the current date.
	 */
	public add(delta: IDateDelta) {
		applyDelta(this, delta, 1);
		return this;
	}

	/**
	 * Subtract a calendar/time delta from the current date.
	 */
	public subtract(delta: IDateDelta) {
		applyDelta(this, delta, -1);
		return this;
	}

	/**
	 * Set individual UTC date/time fields.
	 */
	public set(parts: IDateSetParts) {
		applySetParts(this, parts);
		return this;
	}

	/**
	 * Move the date to the start of the provided unit.
	 */
	public startOf(unit: DateUnit, options: IDateBoundaryOptions = {}) {
		switch (unit) {
			case DateUnit.Year:
				this.setUTCMonth(0, 1);
				this.setUTCHours(0, 0, 0, 0);
				break;
			case DateUnit.Month:
				this.setUTCDate(1);
				this.setUTCHours(0, 0, 0, 0);
				break;
			case DateUnit.Week: {
				const weekStartsOn = normalizeWeekStartsOn(options.weekStartsOn);
				const current      = this.getUTCDay();
				const offset       = (current - weekStartsOn + 7) % 7;

				this.setUTCDate(this.getUTCDate() - offset);
				this.setUTCHours(0, 0, 0, 0);
				break;
			}
			case DateUnit.Day:
				this.setUTCHours(0, 0, 0, 0);
				break;
			case DateUnit.Hour:
				this.setUTCMinutes(0, 0, 0);
				break;
			case DateUnit.Minute:
				this.setUTCSeconds(0, 0);
				break;
			case DateUnit.Second:
				this.setUTCMilliseconds(0);
				break;
			case DateUnit.Millisecond:
				break;
			default:
				assertUnreachable(unit);
		}

		return this;
	}

	/**
	 * Move the date to the end of the provided unit.
	 */
	public endOf(unit: DateUnit, options: IDateBoundaryOptions = {}) {
		return this.startOf(unit, options).add(getSingleUnitDelta(unit)).subtract({ milliseconds: 1 });
	}
}

/**
 * Create a rich date helper from a date-like input.
 */
export function date(value: DateLike = new Date()) {
	return new DateBuilder(value);
}

function coerceDate(value: DateLike) {
	const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error('invalid date');
	}

	return date;
}

function applyDelta(date: Date, delta: IDateDelta, direction: 1 | -1) {
	const years  = (delta.years ?? 0) * direction;
	const months = (delta.months ?? 0) * direction;

	if (years !== 0 || months !== 0) {
		applyCalendarDelta(date, years, months);
	}

	const fixedMs
		= ((delta.weeks ?? 0) * 7 * 24 * 60 * 60 * 1_000)
		+ ((delta.days ?? 0) * 24 * 60 * 60 * 1_000)
		+ ((delta.hours ?? 0) * 60 * 60 * 1_000)
		+ ((delta.minutes ?? 0) * 60 * 1_000)
		+ ((delta.seconds ?? 0) * 1_000)
		+ (delta.milliseconds ?? 0);

	if (fixedMs !== 0) {
		date.setTime(date.getTime() + fixedMs * direction);
	}
}

function applySetParts(date: Date, parts: IDateSetParts) {
	const currentYear  = date.getUTCFullYear();
	const currentMonth = date.getUTCMonth();
	const currentDate  = date.getUTCDate();
	const targetYear   = parts.year ?? currentYear;
	const targetMonth  = parts.month ?? currentMonth;
	const targetDate   = parts.date ?? currentDate;
	const maxDate      = getLastDayOfMonth(targetYear, targetMonth);

	date.setUTCFullYear(targetYear, targetMonth, Math.min(targetDate, maxDate));

	if (
		!isUndefined(parts.hours)        ||
		!isUndefined(parts.minutes)      ||
		!isUndefined(parts.seconds)      ||
		!isUndefined(parts.milliseconds)
	) {
		date.setUTCHours(
			parts.hours ?? date.getUTCHours(),
			parts.minutes ?? date.getUTCMinutes(),
			parts.seconds ?? date.getUTCSeconds(),
			parts.milliseconds ?? date.getUTCMilliseconds()
		);
	}
}

function applyCalendarDelta(date: Date, years: number, months: number) {
	const originalDay = date.getUTCDate();
	const totalMonths = date.getUTCMonth() + months + years * 12;
	const targetYear  = date.getUTCFullYear() + Math.floor(totalMonths / 12);
	const targetMonth = ((totalMonths % 12) + 12) % 12;
	const maxDay      = getLastDayOfMonth(targetYear, targetMonth);

	date.setUTCFullYear(targetYear, targetMonth, Math.min(originalDay, maxDay));
}

function getLastDayOfMonth(year: number, month: number) {
	return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function normalizeWeekStartsOn(weekStartsOn = 0) {
	if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
		throw new Error('weekStartsOn must be an integer from 0 to 6');
	}

	return weekStartsOn;
}

function getSingleUnitDelta(unit: DateUnit): IDateDelta {
	switch (unit) {
		case DateUnit.Year:
			return { years: 1 };
		case DateUnit.Month:
			return { months: 1 };
		case DateUnit.Week:
			return { weeks: 1 };
		case DateUnit.Day:
			return { days: 1 };
		case DateUnit.Hour:
			return { hours: 1 };
		case DateUnit.Minute:
			return { minutes: 1 };
		case DateUnit.Second:
			return { seconds: 1 };
		case DateUnit.Millisecond:
			return { milliseconds: 1 };
		default:
			return assertUnreachable(unit);
	}
}

function assertUnreachable(value: never): never {
	throw new Error(`unsupported date unit: ${value}`);
}
