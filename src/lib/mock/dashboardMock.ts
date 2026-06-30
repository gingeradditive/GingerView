// DEBUG: forces realistic mock values across the dashboard (print at ~50%).
// Flip to false to restore live Moonraker data.
export const DASHBOARD_MOCK_ENABLED = true;

export const mockJobInfo = {
	jobName: 'Benchy',
	jobMaterial: 'PETG GF 10 V2',
	thumbnailUrl: '/error-thumbnail.png'
};

export const mockControlPanel = {
	progress: 50,
	elapsed: '01:30:00',
	remaining: '01:30:00',
	eta: '14:30',
	isPrinting: true,
	isPaused: false,
	fanSpeed: 0.6,
	fanOn: true,
	lightValue: 0.4,
	lightOn: true
};

export const mockTemperatures = {
	extruderTemperatures: [235, null, null, null] as (number | null)[],
	extruderTargets: [235, null, null, null] as (number | null)[],
	bedTemperature: 60,
	bedTarget: 60
};

export const mockFlow = {
	isIdle: false,
	flowValue: 15
};

export const mockZHeight = {
	isIdle: false,
	currentHeight: 475,
	maxHeight: 950
};

export const mockPellet = {
	isIdle: false,
	usedKg: 1.2,
	totalKg: 2.4
};
