import { writable } from 'svelte/store';
import type { KlipperMessage, KlipperStatus, WebSocketConnectionStatus } from '../types/klipper';

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
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.connectionStatus.set({ 
            connected: false, 
            connecting: false, 
            error: 'Connection failed' 
          });
          reject(error);
        };
      } catch (error) {
        this.connectionStatus.set({ 
          connected: false, 
          connecting: false, 
          error: 'Failed to create WebSocket connection' 
        });
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
      this.klipperStatus.set(message.params as KlipperStatus);
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
