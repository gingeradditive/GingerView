import type { 
	WiFiNetwork, 
	WiFiConnectionRequest, 
	WiFiConnectionResult, 
	NetworkStatus, 
	NetworkScanResult,
	APIResponse,
	HTTPValidationError 
} from '$lib/types/wifi';

const API_BASE_URL = 'http://discovery.local:8000';

class NetworkAPIError extends Error {
	constructor(
		message: string,
		public status?: number,
		public response?: HTTPValidationError
	) {
		super(message);
		this.name = 'NetworkAPIError';
	}
}

class NetworkAPI {
	private async request<T>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<T> {
		const url = `${API_BASE_URL}${endpoint}`;
		console.log(`Making request to: ${url}`);
		
		try {
			const response = await fetch(url, {
				headers: {
					'Content-Type': 'application/json',
					...options.headers,
				},
				...options,
			});

			console.log(`Response status: ${response.status} for ${url}`);

			if (!response.ok) {
				let errorData: HTTPValidationError;
				try {
					errorData = await response.json();
				} catch {
					errorData = { detail: [{ loc: [], msg: response.statusText, type: 'error' }] };
				}
				
				throw new NetworkAPIError(
					errorData.detail[0]?.msg || `HTTP ${response.status} - ${response.statusText}`,
					response.status,
					errorData
				);
			}

			const data = await response.json();
			console.log(`Response data for ${url}:`, data);
			return data;
		} catch (error) {
			if (error instanceof NetworkAPIError) {
				throw error;
			}
			
			if (error instanceof TypeError && error.message.includes('fetch')) {
				throw new NetworkAPIError('Failed to connect to the network service. Please check if the service is running.');
			}
			
			throw new NetworkAPIError(`Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	async getNetworkStatus(): Promise<NetworkStatus> {
		return this.request<NetworkStatus>('/api/wifi/status');
	}

	async scanNetworks(): Promise<NetworkScanResult> {
		// The scan endpoint doesn't exist, use networks endpoint instead
		const networks = await this.request<WiFiNetwork[]>('/api/wifi/networks');
		return { networks };
	}

	async connectToNetwork(request: WiFiConnectionRequest): Promise<WiFiConnectionResult> {
		return this.request<WiFiConnectionResult>('/api/wifi/connect', {
			method: 'POST',
			body: JSON.stringify(request),
		});
	}

	async disconnectNetwork(): Promise<APIResponse> {
		return this.request<APIResponse>('/api/wifi/disconnect', {
			method: 'POST',
		});
	}

	async getAvailableNetworks(): Promise<WiFiNetwork[]> {
		return this.request<WiFiNetwork[]>('/api/wifi/networks');
	}
}

export const networkAPI = new NetworkAPI();
export { NetworkAPIError };
export type { NetworkStatus, WiFiNetwork, WiFiConnectionRequest, WiFiConnectionResult };
