import { writable } from 'svelte/store';

// Stores the current browsing path relative to gcodes root
// e.g. '' means root (gcodes), 'subfolder' means gcodes/subfolder
export const currentDirPath = writable<string>('');

export function navigateToDir(dirname: string) {
	currentDirPath.update((p) => (p ? `${p}/${dirname}` : dirname));
}

export function navigateUp() {
	currentDirPath.update((p) => {
		const idx = p.lastIndexOf('/');
		return idx === -1 ? '' : p.substring(0, idx);
	});
}

export function navigateToRoot() {
	currentDirPath.set('');
}

export function navigateToSegment(segmentIndex: number, segments: string[]) {
	currentDirPath.set(segments.slice(0, segmentIndex + 1).join('/'));
}
