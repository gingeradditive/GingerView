import { writable, derived } from 'svelte/store';

export type ToastType = 'error' | 'warning' | 'info' | 'success';
export type ToastSource = 'klipper' | 'moonraker' | 'network' | 'system';

export interface Toast {
	id: string;
	type: ToastType;
	source: ToastSource;
	title: string;
	message: string;
	details?: string;
	timestamp: Date;
	duration: number;
	dismissible: boolean;
	/**
	 * Per i toast che descrivono una **condizione** (Kalico fermo, un avviso di Moonraker):
	 * un nuovo toast con la stessa chiave sostituisce il vecchio invece di accumularsi, e
	 * `resolve(key)` lo chiude quando la condizione rientra. Senza chiave è un evento singolo.
	 */
	key?: string;
}

type ToastInput = Omit<Toast, 'id' | 'timestamp'> & { duration?: number; dismissible?: boolean };

const TOAST_DEFAULTS: Pick<Toast, 'duration' | 'dismissible'> = {
	duration: 6000,
	dismissible: true
};

const MAX_VISIBLE_TOASTS = 20;

const toastList = writable<Toast[]>([]);

function generateId(): string {
	return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function addToast(input: ToastInput): string {
	if (input.key) {
		const key = input.key;
		toastList.update((list) => list.filter((t) => t.key !== key));
	}
	const id = generateId();
	const toast: Toast = {
		...TOAST_DEFAULTS,
		...input,
		id,
		timestamp: new Date()
	};

	toastList.update((list) => {
		const updated = [...list, toast];
		if (updated.length > MAX_VISIBLE_TOASTS) {
			return updated.slice(updated.length - MAX_VISIBLE_TOASTS);
		}
		return updated;
	});

	if (toast.duration > 0) {
		setTimeout(() => dismissToast(id), toast.duration);
	}

	return id;
}

function dismissToast(id: string): void {
	toastList.update((list) => list.filter((t) => t.id !== id));
}

/** Chiude il toast di una condizione che è rientrata (vedi `Toast.key`). */
function resolve(key: string): void {
	toastList.update((list) => list.filter((t) => t.key !== key));
}

/** Toglie gli avvisi di una sorgente: quando quello che dicevano non vale più. */
function clearSource(source: ToastSource): void {
	toastList.update((list) => list.filter((t) => t.source !== source));
}

function clearAll(): void {
	toastList.set([]);
}

export const toasts = derived(toastList, ($list) => $list);

export const toastActions = {
	add: addToast,
	dismiss: dismissToast,
	clearAll,
	clearSource,
	resolve,

	error(
		source: ToastSource,
		title: string,
		message: string,
		duration?: number,
		details?: string,
		key?: string
	) {
		return addToast({
			type: 'error',
			source,
			title,
			message,
			details,
			duration: duration ?? 8000,
			dismissible: true,
			key
		});
	},

	warning(
		source: ToastSource,
		title: string,
		message: string,
		duration?: number,
		details?: string,
		key?: string
	) {
		return addToast({
			type: 'warning',
			source,
			title,
			message,
			details,
			duration: duration ?? 6000,
			dismissible: true,
			key
		});
	},

	info(source: ToastSource, title: string, message: string, duration?: number, details?: string) {
		return addToast({
			type: 'info',
			source,
			title,
			message,
			details,
			duration: duration ?? 4000,
			dismissible: true
		});
	},

	success(
		source: ToastSource,
		title: string,
		message: string,
		duration?: number,
		details?: string
	) {
		return addToast({
			type: 'success',
			source,
			title,
			message,
			details,
			duration: duration ?? 3000,
			dismissible: true
		});
	}
};
