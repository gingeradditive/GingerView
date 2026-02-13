// WiFi API Types based on actual API responses from http://discovery.local:8000

export interface ValidationError {
	loc: (string | number)[];
	msg: string;
	type: string;
}

export interface HTTPValidationError {
	detail: ValidationError[];
}

export interface WiFiNetwork {
	ssid: string;
	signal_strength: number;
	security: string;
	frequency: number;
	is_hidden: boolean;
}

export interface WiFiConnectionRequest {
	ssid: string;
	password: string | null;
}

export interface WiFiConnectionResult {
	success: boolean;
	ssid: string;
	message: string;
	status: string;
	current_connection: string | null;
	previous_connection: string | null;
}

// Updated to match actual API response
export interface NetworkStatus {
	adapter: {
		device: string;
		type: string;
		state: string;
		connection: string;
	};
	ip: {
		ipv4: string;
		ipv6: string;
		mac: string;
	};
	signal_info: {
		current_signal: number;
		available_networks: number;
		signal_range: string;
		current_connection_signal: number;
		current_ssid: string;
	};
}

export interface NetworkScanResult {
	networks: WiFiNetwork[];
}

export interface APIResponse<T = any> {
	success: boolean;
	data?: T;
	error?: HTTPValidationError;
	message?: string;
}
