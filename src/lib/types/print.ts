export interface PrintItem {
	id: string;
	name: string;
	material: string;
	duration: string;
	imageUrl?: string;
	filename: string;
	filepath: string;
	modified: number;
	size: number;
	isDirectory: boolean;
}
