/**
 * I log scaricabili da `/settings/log`. Generati al caricamento della pagina,
 * con orari a ridosso di "adesso", così sembrano di una macchina appena accesa.
 */

const stamp = (secondsAgo: number): string =>
	new Date(Date.now() - secondsAgo * 1000).toISOString().replace('T', ' ').slice(0, 19);

const lines = (entries: [number, string][]): string =>
	entries.map(([ago, text]) => `${stamp(ago)} ${text}`).join('\n') + '\n';

export const LOG_FILES: Record<string, () => string> = {
	'klippy.log': () =>
		lines([
			[620, 'Starting Klippy...'],
			[620, 'Args: [\'/home/pi/kalico/klippy/klippy.py\', \'/home/pi/printer_data/config/printer.cfg\']'],
			[619, 'Git version: \'v2026.09-demo\''],
			[618, 'Loaded MCU \'mcu\' 112 commands'],
			[617, 'Configured MCU \'mcu\' (1024 moves)'],
			[617, 'Extruder zones: extruder, extruder1, extruder2, extruder3'],
			[616, 'webhooks client: identified GingerView'],
			[615, 'Printer is ready'],
			[300, 'Stats 300.0: gcodein=0 mcu: mcu_awake=0.002 bed: target=0 temp=22.1 pwm=0.000'],
			[0, 'Virtual G2: this log belongs to the demo printer.']
		]),
	'moonraker.log': () =>
		lines([
			[625, '[server.py:main()] Starting Moonraker on (0.0.0.0, 7125)'],
			[624, '[confighelper.py:read_file()] Configuration File: /home/pi/printer_data/config/moonraker.conf'],
			[623, '[file_manager.py:__init__()] Using File Manager root: gcodes'],
			[622, '[update_manager.py:__init__()] Update manager initialized'],
			[618, '[klippy_connection.py:_check_ready()] Klippy ready'],
			[0, '[websockets.py:open()] Websocket opened: GingerView (Virtual G2 demo)']
		]),
	'crowsnest.log': () =>
		lines([
			[630, 'crowsnest: Starting...'],
			[629, 'crowsnest: No camera configured on the Virtual G2.']
		])
};
