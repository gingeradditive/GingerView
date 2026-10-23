import { connections, type DemoConnection } from './notify';
import { GcodeError, getStatus, queryObjects, runScript, type Status } from './printer';
import { listJobs } from './history';

/**
 * Un WebSocket di Moonraker, senza rete.
 *
 * Ha la stessa interfaccia di `WebSocket` per quello che GingerView usa
 * (`onopen`/`onmessage`/`onclose`, `send`, `close`, `readyState`) e risponde
 * al JSON-RPC come Moonraker: identificazione, sottoscrizione agli oggetti,
 * G-code dalla console. Le notifiche di stato sono differenziali, con i soli
 * campi cambiati, ogni 250 ms — come quelle vere.
 */

type Subscription = Record<string, string[] | null>;

const jsonEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

let nextConnectionId = 1000;

export class DemoWebSocket extends EventTarget implements DemoConnection {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;
	readonly CONNECTING = 0;
	readonly OPEN = 1;
	readonly CLOSING = 2;
	readonly CLOSED = 3;

	readonly url: string;
	readonly protocol = '';
	readonly extensions = '';
	binaryType: BinaryType = 'blob';
	bufferedAmount = 0;
	readyState = 0;

	onopen: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;

	private readonly connectionId = nextConnectionId++;
	private subscription: Subscription = {};
	/** Quello che il client sa già: la base delle notifiche differenziali. */
	private sent: Status = {};

	constructor(url: string | URL) {
		super();
		this.url = String(url);
		// Come una connessione vera, si apre dopo: chi crea il socket fa in tempo
		// ad assegnare `onopen`.
		setTimeout(() => {
			if (this.readyState !== 0) return;
			this.readyState = 1;
			connections.add(this);
			this.fire(new Event('open'));
		}, 30);
	}

	private fire(event: Event): void {
		const handler = (this as unknown as Record<string, unknown>)[`on${event.type}`];
		if (typeof handler === 'function') handler.call(this, event);
		this.dispatchEvent(event);
	}

	push(message: Record<string, unknown>): void {
		if (this.readyState !== 1) return;
		const data = JSON.stringify(message);
		// Asincrono, come la rete: nessun messaggio arriva dentro la `send` che lo provoca.
		setTimeout(() => {
			if (this.readyState === 1) this.fire(new MessageEvent('message', { data }));
		}, 0);
	}

	send(data: string): void {
		if (this.readyState !== 1) throw new DOMException('WebSocket is not open', 'InvalidStateError');
		let request: { id?: unknown; method?: unknown; params?: Record<string, unknown> };
		try {
			request = JSON.parse(data);
		} catch {
			return;
		}
		const id = request.id;
		this.handle(String(request.method ?? ''), request.params ?? {}).then(
			(result) => {
				if (id !== undefined) this.push({ jsonrpc: '2.0', id, result });
			},
			(error: unknown) => {
				const message = error instanceof Error ? error.message : 'Internal error';
				if (id !== undefined) this.push({ jsonrpc: '2.0', id, error: { code: 400, message } });
			}
		);
	}

	close(code = 1000, reason = ''): void {
		if (this.readyState >= 2) return;
		this.readyState = 3;
		connections.delete(this);
		this.fire(new CloseEvent('close', { code, reason, wasClean: true }));
	}

	onTick(): void {
		if (Object.keys(this.subscription).length === 0) return;
		const current = queryObjects(this.subscription);
		const diff: Status = {};
		for (const [name, fields] of Object.entries(current)) {
			const previous = this.sent[name] ?? {};
			for (const [field, value] of Object.entries(fields)) {
				if (!jsonEqual(previous[field], value)) {
					diff[name] = { ...diff[name], [field]: value };
				}
			}
		}
		if (Object.keys(diff).length === 0) return;
		this.sent = current;
		this.push({
			jsonrpc: '2.0',
			method: 'notify_status_update',
			params: [diff, performance.now() / 1000]
		});
	}

	private async handle(method: string, params: Record<string, unknown>): Promise<unknown> {
		switch (method) {
			case 'server.connection.identify':
				return { connection_id: this.connectionId };
			case 'printer.objects.subscribe': {
				this.subscription = (params.objects as Subscription) ?? {};
				const status = queryObjects(this.subscription);
				this.sent = status;
				return { eventtime: performance.now() / 1000, status };
			}
			case 'printer.objects.query':
				return {
					eventtime: performance.now() / 1000,
					status: queryObjects((params.objects as Subscription) ?? {})
				};
			case 'printer.objects.list':
				return { objects: Object.keys(getStatus()) };
			case 'printer.gcode.script':
				try {
					await runScript(String(params.script ?? ''));
				} catch (error) {
					if (error instanceof GcodeError) throw error;
					throw new Error('Internal error');
				}
				return 'ok';
			case 'server.history.list':
				return listJobs(Number(params.start ?? 0), Number(params.limit ?? 50));
			case 'server.info':
				return { klippy_connected: true, klippy_state: 'ready' };
			default:
				// Metodi che GingerView non usa: rispondere invece di ignorare evita
				// attese infinite in chi li chiamasse.
				return {};
		}
	}
}
