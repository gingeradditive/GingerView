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

function clearAll(): void {
	toastList.set([]);
}

export const toasts = derived(toastList, ($list) => $list);

export const toastActions = {
	add: addToast,
	dismiss: dismissToast,
	clearAll,

	error(source: ToastSource, title: string, message: string, duration?: number, details?: string) {
		return addToast({ type: 'error', source, title, message, details, duration: duration ?? 8000, dismissible: true });
	},

	warning(source: ToastSource, title: string, message: string, duration?: number, details?: string) {
		return addToast({ type: 'warning', source, title, message, details, duration: duration ?? 6000, dismissible: true });
	},

	info(source: ToastSource, title: string, message: string, duration?: number, details?: string) {
		return addToast({ type: 'info', source, title, message, details, duration: duration ?? 4000, dismissible: true });
	},

	success(source: ToastSource, title: string, message: string, duration?: number, details?: string) {
		return addToast({ type: 'success', source, title, message, details, duration: duration ?? 3000, dismissible: true });
	}
};
