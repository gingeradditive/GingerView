import { writable } from 'svelte/store';
import type { KlipperMessage, KlipperStatus, WebSocketConnectionStatus } from '../types/klipper';
import { toastActions } from '$lib/stores/toastStore';

class KlipperWebSocketService {
  private ws: WebSocket | null = null;
  private url: string = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  public connectionStatus = writable<WebSocketConnectionStatus>({
    connected: false,
    connecting: false
  });

  public klipperStatus = writable<KlipperStatus | null>(null);

  constructor(url: string = 'ws://localhost:7125') {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.connectionStatus.set({ connected: false, connecting: true });

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected to Klipper');
          this.connectionStatus.set({ connected: true, connecting: false });
          this.reconnectAttempts = 0;
          toastActions.success('klipper', 'Connected', 'WebSocket connection to Kalico established');
          this.requestStatus();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: KlipperMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected from Klipper');
          this.connectionStatus.set({ connected: false, connecting: false });
          toastActions.warning('klipper', 'Disconnected', 'Lost connection to Kalico. Attempting to reconnect...');
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.connectionStatus.set({ 
            connected: false, 
            connecting: false, 
            error: 'Connection failed' 
          });
          toastActions.error('klipper', 'Connection error', 'Failed to connect to Kalico WebSocket');
          reject(error);
        };
      } catch (error) {
        this.connectionStatus.set({ 
          connected: false, 
          connecting: false, 
          error: 'Failed to create WebSocket connection' 
        });
        toastActions.error('klipper', 'Connection failed', 'Unable to create WebSocket connection to Kalico');
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionStatus.set({ connected: false, connecting: false });
  }

  private handleMessage(message: KlipperMessage): void {
    if (message.method === 'notify_status_update') {
      const status = message.params as KlipperStatus;
      this.klipperStatus.set(status);

      if (status?.state === 'error' && status.state_message) {
        toastActions.error('klipper', 'Printer error', status.state_message, 0);
      } else if (status?.state === 'shutdown') {
        toastActions.error('klipper', 'Printer shutdown', status.state_message || 'Kalico has shut down', 0);
      }
    }

    if (message.method === 'notify_klippy_disconnected') {
      toastActions.error('klipper', 'Klippy disconnected', 'Kalico host process has disconnected', 0);
    }

    if (message.method === 'notify_klippy_shutdown') {
      toastActions.error('klipper', 'Klippy shutdown', 'Kalico firmware has entered shutdown state', 0);
    }

    if (message.error) {
      toastActions.error('klipper', 'Command error', message.error.message);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(() => {
          // Connection failed, will try again
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      this.connectionStatus.set({ 
        connected: false, 
        connecting: false, 
        error: 'Unable to connect to Klipper' 
      });
      toastActions.error('klipper', 'Connection lost', 'Max reconnection attempts reached. Unable to connect to Kalico.', 0);
    }
  }

  send(message: KlipperMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  private requestStatus(): void {
    this.send({
      method: 'server.info',
      id: Date.now().toString()
    });
  }

  getKlipperInfo(): void {
    this.send({
      method: 'server.info',
      id: Date.now().toString()
    });
  }
}

export const klipperWebSocket = new KlipperWebSocketService();
