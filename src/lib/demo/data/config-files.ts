/**
 * La cartella `config` della stampante simulata, per l'editor di configurazione.
 *
 * Non è la configurazione vera della G2: la demo è pubblica, e pin, PID e
 * tarature della macchina non vanno pubblicati. È una versione ridotta con la
 * stessa struttura (file per area, macro START_PRINT/END_PRINT, quattro zone
 * dell'ugello), credibile per chi la apre ma senza dati sensibili.
 */

const header = (title: string): string =>
	`# ${'='.repeat(74)}\n# ${title}\n# ${'='.repeat(74)}\n# Virtual G2 — demo configuration, not the real machine settings.\n`;

const zone = (name: string, index: number): string => `
[${name}]
# Zone ${index} of the nozzle
heater_pin: demo:heater_${index}
sensor_type: NTC100K3950.1
sensor_pin: demo:sensor_${index}
control: pid
min_temp: 0
max_temp: 300
`;

export const CONFIG_FILES: Record<string, string> = {
	'printer.cfg': `${header('G2 / Kalico - Root configuration')}
[include G2-Configs/10_kinematics.cfg]
[include G2-Configs/20_extruder.cfg]
[include G2-Configs/30_bed.cfg]
[include G2-Configs/50_feeder.cfg]
[include G2-Configs/60_peripherals.cfg]
[include G2-Configs/80_system.cfg]

[mcu]
serial: /dev/serial/by-id/demo-mcu

[virtual_sdcard]
path: ~/printer_data/gcodes

[pause_resume]

[display_status]
`,

	'G2-Configs/10_kinematics.cfg': `${header('10 - Kinematics: machine limits and X/Y/Z axes')}
[printer]
kinematics: cartesian
max_velocity: 500
max_accel: 3000
max_z_velocity: 7
max_z_accel: 100
square_corner_velocity: 5.0

[stepper_x]
position_endstop: 0
position_max: 1100
homing_speed: 120

[stepper_y]
position_endstop: 0
position_max: 1000
homing_speed: 120

[stepper_z]
position_min: -5
position_max: 1050
homing_speed: 7
`,

	'G2-Configs/20_extruder.cfg': `${header('20 - Extruder: the four heated zones of the nozzle')}
# Kalico has no multi-zone nozzle: each zone is declared as an extruder and
# they are driven together. Only [extruder] has a stepper behind it.
${zone('extruder', 1)}nozzle_diameter: 3.0
filament_diameter: 1.1284   # 1 mm of "filament" = 1 mm³ of pellet
rotation_distance: 465      # mm³ per rotation
${zone('extruder1', 2)}${zone('extruder2', 3)}${zone('extruder3', 4)}
[gcode_macro EXTRUDER_SHUTDOWN]
gcode:
  {% for zone in ['extruder', 'extruder1', 'extruder2', 'extruder3'] %}
    SET_HEATER_TEMPERATURE HEATER={zone} TARGET=0
  {% endfor %}
`,

	'G2-Configs/30_bed.cfg': `${header('30 - Heated bed')}
[heater_bed]
heater_pin: demo:bed
sensor_type: NTC100K3950.1
sensor_pin: demo:bed_sensor
control: pid
min_temp: 0
max_temp: 110

[gcode_macro BED_SHUTDOWN]
gcode:
  SET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=0
`,

	'G2-Configs/50_feeder.cfg': `${header('50 - Pellet feeder')}
[output_pin _FEEDER_STATUS]
pin: demo:feeder
value: 0

[gcode_macro FEEDER_ENABLE]
gcode:
  SET_PIN PIN=_FEEDER_STATUS VALUE=1

[gcode_macro FEEDER_DISABLE]
gcode:
  SET_PIN PIN=_FEEDER_STATUS VALUE=0
`,

	'G2-Configs/60_peripherals.cfg': `${header('60 - Peripherals: fan, camera light')}
[fan]
pin: demo:fan

[led LED_CAMERA]
white_pin: demo:led
initial_WHITE: 0
`,

	'G2-Configs/80_system.cfg': `${header('80 - System: START_PRINT / END_PRINT')}
[gcode_macro START_PRINT]
description: Homing, bed and nozzle heating, purge
gcode:
  {% set bed = params.BED_TEMPERATURE|default(50)|float %}
  {% set zone = params.ZONE_TEMPERATURE|default(200)|float %}
  FEEDER_ENABLE
  SET_HEATER_TEMPERATURE HEATER=heater_bed TARGET={bed}
  G28
  {% for z in ['extruder', 'extruder1', 'extruder2', 'extruder3'] %}
    SET_HEATER_TEMPERATURE HEATER={z} TARGET={zone}
  {% endfor %}
  {% for z in ['extruder', 'extruder1', 'extruder2', 'extruder3'] %}
    TEMPERATURE_WAIT SENSOR={z} MINIMUM={zone}
  {% endfor %}

[gcode_macro END_PRINT]
description: Heaters off, lift and park
gcode:
  BED_SHUTDOWN
  EXTRUDER_SHUTDOWN
  M107
  FEEDER_DISABLE
  G91
  G1 Z10 F420
  G90
  G28 X
`,

	'moonraker.conf': `# Virtual G2 — demo configuration
[server]
host: 0.0.0.0
port: 7125

[file_manager]
enable_object_processing: True

[history]

[update_manager]
channel: stable
refresh_interval: 168

[update_manager GingerView]
type: web
repo: gingeradditive/GingerView
path: ~/GingerView
`
};
