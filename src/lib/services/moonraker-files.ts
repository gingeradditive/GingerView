import { configService } from './config';

export interface MoonrakerThumbnail {
	width: number;
	height: number;
	size: number;
	relative_path: string;
}

export interface MoonrakerFileItem {
	filename: string;
	modified: number;
	size: number;
	print_start_time?: number;
	job_id?: string;
	slicer?: string;
	slicer_version?: string;
	layer_height?: number;
	first_layer_height?: number;
	object_height?: number;
	filament_total?: number;
	estimated_time?: number;
	thumbnails?: MoonrakerThumbnail[];
}

export interface MoonrakerDirItem {
	dirname: string;
	modified: number;
	size: number;
}

export interface MoonrakerDirectoryResponse {
	dirs: MoonrakerDirItem[];
	files: MoonrakerFileItem[];
	disk_usage: {
		total: number;
		used: number;
		free: number;
	};
	root_info: {
		name: string;
		permissions: string;
	};
}

function getApiUrl(): string {
	const config = configService.getKlipperConfig();
	return config.moonrakerApiUrl ?? `http://${config.moonrakerHost}:${config.moonrakerPort}`;
}

export async function fetchDirectory(path: string = 'gcodes'): Promise<MoonrakerDirectoryResponse> {
	const apiUrl = getApiUrl();
	const res = await fetch(`${apiUrl}/server/files/directory?path=${encodeURIComponent(path)}`);
	if (!res.ok) {
		throw new Error(`Failed to fetch directory: ${res.status} ${res.statusText}`);
	}
	const json = await res.json();
	return json.result;
}

export interface MoonrakerFileMetadata {
	filename: string;
	modified: number;
	size: number;
	print_start_time?: number;
	job_id?: string;
	slicer?: string;
	slicer_version?: string;
	layer_height?: number;
	first_layer_height?: number;
	object_height?: number;
	filament_total?: number;
	filament_type?: string;
	filament_name?: string;
	filament_weight_total?: number;
	nozzle_diameter?: number;
	estimated_time?: number;
	first_layer_extr_temp?: number;
	first_layer_bed_temp?: number;
	extruder_temp?: number;
	bed_temp?: number;
	thumbnails?: MoonrakerThumbnail[];
}

export async function getFileMetadata(filename: string, dirPath: string = 'gcodes'): Promise<MoonrakerFileMetadata> {
	const apiUrl = getApiUrl();
	const fullPath = dirPath === 'gcodes' ? filename : `${dirPath}/${filename}`;
	const res = await fetch(`${apiUrl}/server/files/metadata?filename=${encodeURIComponent(fullPath)}`);
	if (!res.ok) {
		throw new Error(`Failed to fetch file metadata: ${res.status} ${res.statusText}`);
	}
	const json = await res.json();
	return json.result;
}

export function getThumbnailUrl(file: MoonrakerFileItem, dirPath: string = 'gcodes'): string | undefined {
	if (!file.thumbnails || file.thumbnails.length === 0) return undefined;

	// Pick the largest thumbnail available
	const best = file.thumbnails.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b));
	const apiUrl = getApiUrl();
	return `${apiUrl}/server/files/${dirPath}/${best.relative_path}`;
}

export function getErrorThumbnailUrl(): string {
	return '/error-thumbnail.png';
}

export async function extractThumbnailFromGcode(filename: string, dirPath: string = 'gcodes'): Promise<string | null> {
	try {
		const apiUrl = getApiUrl();
		// Construct the full path - if dirPath already includes gcodes/, don't double-prefix
		const fullPath = dirPath === 'gcodes' ? `gcodes/${filename}` : `${dirPath}/${filename}`;
		
		// Only fetch the first 32KB — thumbnails are always in the header
		// Split the path and encode each part separately (same as deleteFile)
		const parts = fullPath.split('/');
		const encodedPath = parts.map(part => encodeURIComponent(part)).join('/');
		const res = await fetch(`${apiUrl}/server/files/${encodedPath}`, {
			headers: { Range: 'bytes=0-32767' }
		});
		if (!res.ok && res.status !== 206) {
			throw new Error(`Failed to fetch G-code header: ${res.status} ${res.statusText}`);
		}
		
		const content = await res.text();
		
		// Look for the thumbnail block more flexibly
		// The format can have blank lines and different whitespace
		const thumbnailMatch = content.match(/; thumbnail begin (\d+)x(\d+) \d+\r?\n([\s\S]*?)\r?\n; thumbnail end/);
		
		if (thumbnailMatch) {
			// Extract base64 lines - strip leading '; ' or just ';'
			const base64Lines = thumbnailMatch[3]
				.split('\n')
				.map(line => line.replace(/^;\s?/, '').trim())
				.filter(line => line.length > 0);
			
			const base64 = base64Lines.join('');
			
			if (base64.length > 0) {
				return `data:image/png;base64,${base64}`;
			}
		}
		
		return null;
	} catch (e) {
		console.warn(`Failed to extract thumbnail from ${filename}:`, e);
		return null;
	}
}

export function formatEstimatedTime(seconds?: number): string {
	if (seconds == null || seconds <= 0) return '--';
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) return `${h}h ${m.toString().padStart(2, '0')} min`;
	return `${m} min`;
}

export function getFilamentType(metadata: MoonrakerFileMetadata): string {
	// Try filament_type first, then filament_name, then slicer as fallback
	if (metadata.filament_type) {
		// Extract just the material type (e.g., "PLA" from "PLA @ Bambu Lab")
		const match = metadata.filament_type.match(/^([A-Z]+(?:\+\d+)?)/i);
		return match ? match[1].toUpperCase() : metadata.filament_type;
	}
	if (metadata.filament_name) {
		const match = metadata.filament_name.match(/^([A-Z]+(?:\+\d+)?)/i);
		return match ? match[1].toUpperCase() : metadata.filament_name;
	}
	// Fallback to slicer info if available
	if (metadata.slicer) {
		return metadata.slicer;
	}
	return '';
}

export async function deleteFile(path: string): Promise<void> {
	const apiUrl = getApiUrl();
	// Split the path and encode each part separately
	const parts = path.split('/');
	const encodedPath = parts.map(part => encodeURIComponent(part)).join('/');
	const res = await fetch(`${apiUrl}/server/files/${encodedPath}`, { method: 'DELETE' });
	if (!res.ok) {
		throw new Error(`Failed to delete file: ${res.status} ${res.statusText}`);
	}
}

export async function deleteDirectory(path: string): Promise<void> {
	const apiUrl = getApiUrl();
	const res = await fetch(`${apiUrl}/server/files/directory?path=${encodeURIComponent(path)}&force=true`, { method: 'DELETE' });
	if (!res.ok) {
		throw new Error(`Failed to delete directory: ${res.status} ${res.statusText}`);
	}
}

export async function moveFile(source: string, dest: string): Promise<void> {
	const apiUrl = getApiUrl();
	const res = await fetch(`${apiUrl}/server/files/move`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ source, dest })
	});
	if (!res.ok) {
		throw new Error(`Failed to move file: ${res.status} ${res.statusText}`);
	}
}

export async function fetchDirectoriesRecursive(path: string = 'gcodes'): Promise<{ name: string; path: string }[]> {
	const result = await fetchDirectory(path);
	const dirs: { name: string; path: string }[] = [];
	for (const d of result.dirs) {
		if (d.dirname.startsWith('.')) continue;
		const dirRelPath = path === 'gcodes' ? d.dirname : `${path.replace(/^gcodes\/?/, '')}/${d.dirname}`;
		const dirFullPath = path === 'gcodes' ? `gcodes/${d.dirname}` : `${path}/${d.dirname}`;
		dirs.push({ name: d.dirname, path: dirRelPath });
		const subDirs = await fetchDirectoriesRecursive(dirFullPath);
		dirs.push(...subDirs);
	}
	return dirs;
}

export async function createDirectory(path: string): Promise<void> {
	const apiUrl = getApiUrl();
	const res = await fetch(`${apiUrl}/server/files/directory?path=${encodeURIComponent(path)}`, {
		method: 'POST'
	});
	if (!res.ok) {
		throw new Error(`Failed to create directory: ${res.status} ${res.statusText}`);
	}
}

export async function uploadFile(file: File, path: string = 'gcodes'): Promise<void> {
	const apiUrl = getApiUrl();
	const formData = new FormData();
	formData.append('file', file);
	formData.append('root', path);

	const res = await fetch(`${apiUrl}/server/files/upload`, {
		method: 'POST',
		body: formData
	});
	if (!res.ok) {
		throw new Error(`Failed to upload file: ${res.status} ${res.statusText}`);
	}
}
