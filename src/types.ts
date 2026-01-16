export type Awaitable<T> = PromiseLike<T> | T;
export type Maybe<T>     = T | undefined;
export type Nullable<T>  = T | null;

export const cast = <T, U extends T>(value: U) => value;

export function assume<T>(value: unknown): asserts value is T {};

export function typedEntries<T extends object>(obj: T) {
	return Object.entries(obj) as {
		[K in keyof T]: [K, T[K]];
	}[keyof T][];
}
