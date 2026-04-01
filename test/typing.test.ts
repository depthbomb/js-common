import { it, expect, describe } from 'vitest';
import { cast, assume, typedEntries } from '../dist/typing.mjs';
import type { Brand, ValueOf, JsonValue, OptionalKeys, RequiredKeys, NonEmptyArray } from '../dist/typing.mjs';

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends
	(<T>() => T extends B ? 1 : 2)
		? true
		: false;

type Assert<T extends true> = T;

type ExampleObject = {
	id: number;
	name?: string;
	active: boolean;
};

type _Assertions = [
	Assert<Equal<ValueOf<{ a: 1; b: 'x' }>, 1 | 'x'>>,
	Assert<Equal<OptionalKeys<ExampleObject>, 'name'>>,
	Assert<Equal<RequiredKeys<ExampleObject>, 'id' | 'active'>>,
	Assert<Equal<NonEmptyArray<string>, [string, ...string[]]>>,
	Assert<Equal<Brand<string, 'UserId'>, string & { readonly __brand: 'UserId' }>>
];

const typeAssertions: _Assertions = [true, true, true, true, true];

const typedJsonValue: JsonValue = {
	ok: true,
	items: [1, 'two', null]
};

describe('types helpers', () => {
	it('cast returns the input value unchanged', () => {
		const value = { a: 1, b: 'two' };
		expect(cast<object, typeof value>(value)).toBe(value);
	});

	it('assume is a runtime no-op', () => {
		expect(() => assume<string>(123)).not.toThrow();
	});

	it('typedEntries returns enumerable own key/value tuples', () => {
		const obj = { first: 1, second: 'two' };
		expect(typedEntries(obj)).toEqual([
			['first', 1],
			['second', 'two'],
		]);
	});

	it('supports the new utility typing shapes at compile time', () => {
		expect(typeAssertions).toEqual([true, true, true, true, true]);
		expect(typedJsonValue).toEqual({
			ok: true,
			items: [1, 'two', null]
		});
	});
});
