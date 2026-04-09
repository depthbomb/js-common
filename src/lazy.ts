import { deprecate } from './functional';
import { lazy as _lazy, lazyAsync as _lazyAsync } from './atomic';

/**
 * @deprecated
 * Import from the `atomic` module instead.
 */
export const lazy = deprecate(_lazy, {
	deprecatedName: 'lazy.lazy',
	replacementName: 'atomic.lazy',
	deprecatedSince: '2.5.0',
	removedIn: '3.0.0'
});

/**
 * @deprecated
 * Import from the `atomic` module instead.
 */
export const lazyAsync = deprecate(_lazyAsync, {
	deprecatedName: 'lazy.lazyAsync',
	replacementName: 'atomic.lazyAsync',
	deprecatedSince: '2.5.0',
	removedIn: '3.0.0'
});
