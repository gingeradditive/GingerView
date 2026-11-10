import { connections } from '../notify';

/**
 * L'host simulato: rete, fuso orario, chiavetta USB e statistiche di sistema.
 * È quello che sulla macchina vera rispondono G2-Service e Moonraker
 * (`/machine/*`).
 */

// --- rete ---------------------------------------------------------------------

const MAC_ETH = 'd8:3a:dd:47:1c:02';
const MAC_WIFI = 'd8:3a:dd:47:1c:03';

const wifiNetworks = [
	{
		ssid: 'Formnext-Exhibitors',
		signalStrength: 82,
		security: 'WPA2',
		frequency: 5180,
		isHidden: false
	},
	{ ssid: 'Ginger-Booth', signalStrength: 74, security: 'WPA2', frequency: 2437, isHidden: false },
	{ ssid: 'Messe-Guest', signalStrength: 61, security: 'open', frequency: 2412, isHidden: false },
	{
		ssid: 'Hall11-Tech',
		signalStrength: 44,
		security: 'WPA1 WPA2',
		frequency: 5240,
		isHidden: false
	},
	{ ssid: '', signalStrength: 30, security: 'WPA2', frequency: 2462, isHidden: true }
];

let wifiConnection: { ssid: string; ip: string } | null = null;

export function networkStatus(): Record<string, unknown> {
	const interfaces = [
		{ device: 'eth0', type: 'ethernet', state: 'connected' },
		{ device: 'wlan0', type: 'wifi', state: wifiConnection ? 'connected' : 'disconnected' }
	];
	// Con entrambe attive vince la rete via cavo, come nel contratto di G2-Service.
	return {
		adapter: {
			device: 'eth0',
			type: 'ethernet',
			state: 'connected',
			connection: 'Wired connection 1'
		},
		ip: { ipv4: '192.168.10.42', ipv6: null, mac: MAC_ETH },
		signalInfo: null,
		interfaces
	};
}

export function listWifi(): Record<string, unknown>[] {
	return wifiNetworks.map((network) => ({
		...network,
		signalStrength: Math.max(
			5,
			Math.min(100, network.signalStrength + Math.round((Math.random() - 0.5) * 6))
		)
	}));
}

type Job = {
	jobId: string;
	type: string;
	status: 'running' | 'succeeded' | 'failed';
	startedAt: string;
	finishedAt: string | null;
	result: Record<string, unknown> | null;
	error: { code: string; message: string } | null;
};

const jobs = new Map<string, Job>();
let nextJob = 1;

type Outcome = { result: Record<string, unknown> } | { error: { code: string; message: string } };

function startJob(type: string, seconds: number, run: () => Outcome): Job {
	const job: Job = {
		jobId: `demo-${type}-${nextJob++}`,
		type,
		status: 'running',
		startedAt: new Date().toISOString(),
		finishedAt: null,
		result: null,
		error: null
	};
	jobs.set(job.jobId, job);
	setTimeout(() => {
		const outcome = run();
		job.finishedAt = new Date().toISOString();
		if ('error' in outcome) {
			job.status = 'failed';
			job.error = outcome.error;
		} else {
			job.status = 'succeeded';
			job.result = outcome.result;
		}
	}, seconds * 1000);
	return job;
}

export function getJob(id: string): Job | undefined {
	return jobs.get(id);
}

/** Qualunque password va bene, tranne una troppo corta: così si vede anche l'errore. */
export function connectWifi(ssid: string, password?: string | null): Job {
	return startJob('wifi.connect', 4, () => {
		const network = wifiNetworks.find((item) => item.ssid === ssid);
		if (!network)
			return { error: { code: 'WIFI_NETWORK_NOT_FOUND', message: 'Network not found' } };
		if (network.security !== 'open' && (!password || password.length < 8)) {
			return { error: { code: 'WIFI_AUTH_FAILED', message: 'Wrong password' } };
		}
		wifiConnection = { ssid, ip: '10.42.0.17' };
		return { result: { ssid, ip: { ipv4: '10.42.0.17', ipv6: null, mac: MAC_WIFI } } };
	});
}

// --- fuso orario --------------------------------------------------------------

let timezone = 'Europe/Berlin';

export function getTimezone(): Record<string, unknown> {
	return { timezone, ntpSynchronized: true };
}

export function setTimezone(id: string): Record<string, unknown> | null {
	try {
		new Intl.DateTimeFormat('en', { timeZone: id });
	} catch {
		return null;
	}
	timezone = id;
	return getTimezone();
}

// --- USB ----------------------------------------------------------------------

/** La chiavetta: il primo file del catalogo, più una cartella di prova. */
export const usbTree: Record<
	string,
	{ dirs: string[]; files: { name: string; size: number; source: string }[] }
> = {
	'': {
		dirs: ['Prototypes'],
		files: [{ name: 'Planter_XL_rPETG.gcode', size: 16_640_000, source: 'Planter_XL_rPETG.gcode' }]
	},
	Prototypes: {
		dirs: [],
		files: [
			{
				name: 'Lamp_Shade_Twist_PLA_v2.gcode',
				size: 8_060_000,
				source: 'Lamp_Shade_Twist_PLA.gcode'
			},
			{ name: 'Stool_rPP_v3.gcode', size: 25_480_000, source: 'Stool_rPP.gcode' }
		]
	}
};

export function usbDirectory(path: string): Record<string, unknown> | null {
	const dir = usbTree[path.replace(/^\/+|\/+$/g, '')];
	if (!dir) return null;
	const modified = new Date(Date.now() - 3 * 86400_000).toISOString();
	return {
		path,
		dirs: dir.dirs.map((name) => ({ name })),
		files: dir.files.map((file) => ({ name: file.name, size: file.size, modified }))
	};
}

export function findUsbFile(
	source: string
): { name: string; size: number; source: string } | undefined {
	const slash = source.lastIndexOf('/');
	const dir = usbTree[slash === -1 ? '' : source.slice(0, slash)];
	return dir?.files.find((file) => file.name === source.slice(slash + 1));
}

export function startUsbImport(run: () => Outcome): Job {
	return startJob('usb-import', 3, run);
}

// --- sistema ------------------------------------------------------------------

export function systemInfo(): Record<string, unknown> {
	return {
		system_info: {
			cpu_info: {
				cpu_count: 4,
				bits: '64bit',
				processor: 'aarch64',
				cpu_desc: 'Cortex-A76',
				hardware_desc: 'BCM2712',
				model: 'Raspberry Pi 5 Model B Rev 1.0',
				total_memory: 8_245_396,
				memory_units: 'kB'
			},
			sd_info: {
				manufacturer: 'SanDisk',
				product_name: 'SN64G',
				capacity: '59.5 GiB',
				total_bytes: 63_864_569_856
			},
			distribution: {
				name: 'G2-OS (Debian GNU/Linux 12)',
				id: 'debian',
				version: '12',
				codename: 'bookworm'
			},
			available_services: ['klipper', 'moonraker', 'g2-service', 'nginx'],
			network: {
				eth0: {
					mac_address: MAC_ETH,
					ip_addresses: [{ family: 'ipv4', address: '192.168.10.42', is_link_local: false }]
				},
				wlan0: { mac_address: MAC_WIFI, ip_addresses: [] }
			}
		}
	};
}

const bootTime = Date.now() / 1000 - 620;
let rx = 18_400_000;
let tx = 6_100_000;

export function procStats(): Record<string, unknown> {
	const now = Date.now() / 1000;
	rx += 40_000 + Math.random() * 20_000;
	tx += 15_000 + Math.random() * 10_000;
	const cpu = 6 + Math.random() * 8;
	return {
		moonraker_stats: Array.from({ length: 10 }, (_, i) => ({
			time: now - (9 - i),
			cpu_usage: 1.5 + Math.random() * 2,
			memory: 48_200 + Math.round(Math.random() * 400),
			mem_units: 'kB'
		})),
		throttled_state: { bits: 0, flags: [] },
		cpu_temp: 48 + Math.random() * 3,
		network: {
			eth0: {
				rx_bytes: Math.round(rx),
				tx_bytes: Math.round(tx),
				bandwidth: 2400 + Math.random() * 800
			},
			wlan0: { rx_bytes: 0, tx_bytes: 0, bandwidth: 0 }
		},
		system_cpu_usage: { cpu, cpu0: cpu + 2, cpu1: cpu - 1, cpu2: cpu + 1, cpu3: cpu - 2 },
		system_memory: {
			total: 8_245_396,
			available: 6_912_000 - Math.round(Math.random() * 20_000),
			used: 1_333_396
		},
		system_uptime: now - bootTime,
		websocket_connections: connections.size
	};
}
