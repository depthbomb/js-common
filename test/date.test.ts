import { it, expect, describe } from 'vitest';
import { date, DateUnit, DateBuilder } from '../dist/date.mjs';

describe('date helper', () => {
	it('creates a DateBuilder instance that is also a Date', () => {
		const value = date('2026-04-08T12:00:00.000Z');

		expect(value).toBeInstanceOf(Date);
		expect(value).toBeInstanceOf(DateBuilder);
		expect(value.toISOString()).toBe('2026-04-08T12:00:00.000Z');
	});

	it('adds and subtracts calendar/time deltas', () => {
		const value = date('2024-01-31T12:30:00.000Z')
			.add({ months: 1, days: 2, hours: 3 })
			.subtract({ minutes: 30 });

		expect(value.toISOString()).toBe('2024-03-02T15:00:00.000Z');
	});

	it('clamps month/year transitions to the last valid day', () => {
		const value = date('2024-01-31T00:00:00.000Z').add({ months: 1 });

		expect(value.toISOString()).toBe('2024-02-29T00:00:00.000Z');
	});

	it('sets UTC date/time parts ergonomically', () => {
		const value = date('2026-04-08T12:34:56.789Z').set({
			year: 2027,
			month: 0,
			date: 1,
			hours: 8,
			minutes: 0,
			seconds: 0,
			milliseconds: 0
		});

		expect(value.toISOString()).toBe('2027-01-01T08:00:00.000Z');
	});

	it('supports startOf and endOf boundaries', () => {
		const start = date('2026-04-08T12:34:56.789Z').startOf(DateUnit.Day);
		const end = date('2026-04-08T12:34:56.789Z').endOf(DateUnit.Day);

		expect(start.toISOString()).toBe('2026-04-08T00:00:00.000Z');
		expect(end.toISOString()).toBe('2026-04-08T23:59:59.999Z');
	});

	it('supports all unit boundaries', () => {
		const value = date('2026-04-08T12:34:56.789Z');

		expect(value.clone().startOf(DateUnit.Year).toISOString()).toBe('2026-01-01T00:00:00.000Z');
		expect(value.clone().endOf(DateUnit.Year).toISOString()).toBe('2026-12-31T23:59:59.999Z');
		expect(value.clone().startOf(DateUnit.Month).toISOString()).toBe('2026-04-01T00:00:00.000Z');
		expect(value.clone().endOf(DateUnit.Month).toISOString()).toBe('2026-04-30T23:59:59.999Z');
		expect(value.clone().startOf(DateUnit.Hour).toISOString()).toBe('2026-04-08T12:00:00.000Z');
		expect(value.clone().endOf(DateUnit.Hour).toISOString()).toBe('2026-04-08T12:59:59.999Z');
		expect(value.clone().startOf(DateUnit.Minute).toISOString()).toBe('2026-04-08T12:34:00.000Z');
		expect(value.clone().endOf(DateUnit.Minute).toISOString()).toBe('2026-04-08T12:34:59.999Z');
		expect(value.clone().startOf(DateUnit.Second).toISOString()).toBe('2026-04-08T12:34:56.000Z');
		expect(value.clone().endOf(DateUnit.Second).toISOString()).toBe('2026-04-08T12:34:56.999Z');
		expect(value.clone().startOf(DateUnit.Millisecond).toISOString()).toBe('2026-04-08T12:34:56.789Z');
		expect(value.clone().endOf(DateUnit.Millisecond).toISOString()).toBe('2026-04-08T12:34:56.789Z');
	});

	it('supports week boundaries with a configurable week start', () => {
		const value = date('2026-04-08T12:34:56.789Z');
		const sundayStart = value.clone().startOf(DateUnit.Week);
		const mondayStart = value.clone().startOf(DateUnit.Week, { weekStartsOn: 1 });

		expect(sundayStart.toISOString()).toBe('2026-04-05T00:00:00.000Z');
		expect(mondayStart.toISOString()).toBe('2026-04-06T00:00:00.000Z');
	});

	it('clone and toDate return independent copies', () => {
		const original = date('2026-04-08T12:00:00.000Z');
		const clone = original.clone().add({ days: 1 });
		const plain = original.toDate();

		expect(original.toISOString()).toBe('2026-04-08T12:00:00.000Z');
		expect(clone.toISOString()).toBe('2026-04-09T12:00:00.000Z');
		expect(plain).toBeInstanceOf(Date);
		expect(plain).not.toBeInstanceOf(DateBuilder);
		expect(plain.toISOString()).toBe('2026-04-08T12:00:00.000Z');
	});

	it('throws on invalid date input and invalid weekStartsOn', () => {
		expect(() => date('not-a-date')).toThrow('invalid date');
		expect(() => date().startOf(DateUnit.Week, { weekStartsOn: 7 })).toThrow('weekStartsOn must be an integer from 0 to 6');
	});

	it('clamps invalid dates when setting year or month parts', () => {
		const leapDay = date('2024-02-29T12:00:00.000Z').set({ year: 2023 });
		const monthClamp = date('2024-01-31T12:00:00.000Z').set({ month: 1 });

		expect(leapDay.toISOString()).toBe('2023-02-28T12:00:00.000Z');
		expect(monthClamp.toISOString()).toBe('2024-02-29T12:00:00.000Z');
	});
});
