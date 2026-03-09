export interface PrintItem {
	id: string;
	name: string;
	material: string;
	duration: string;
	filamentName?: string;
	filamentType?: string;
	filamentWeight?: number;
	nozzleDiameter?: number;
	lastPrintDuration?: number;
	printTime?: number;
	imageUrl?: string;
	filename: string;
	filepath: string;
	modified: number;
	size: number;
	isDirectory: boolean;
}
