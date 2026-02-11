export interface KlipperMessage {
  id?: string;
  method?: string;
  params?: Record<string, any>;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export interface KlipperStatus {
  state: string;
  state_message: string;
  hostname: string;
  klipper_path: string;
  config_file: string;
  software_version: string;
  cpu_usage: number;
}

export interface WebSocketConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error?: string;
}
