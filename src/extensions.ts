declare global {
	interface StringConstructor {
		empty(): string;
		isEmpty(value: unknown): value is '';
	}
}

String.empty = function(): string {
	return '';
}

String.isEmpty = function(value: unknown): value is '' {
	return value === '';
};
