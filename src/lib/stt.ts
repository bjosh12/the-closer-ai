export interface STTProvider {
  connect(): Promise<void>;
  disconnect(): void;
  sendAudio(data: ArrayBuffer): void;
  onTranscript(callback: (text: string, isFinal: boolean, analytics?: { wpm: number, fillers: number }) => void): void;
}

export class DeepgramProvider implements STTProvider {
  private apiKey: string;
  private callback: ((text: string, isFinal: boolean, analytics?: { wpm: number, fillers: number }) => void) | null = null;
  private utteranceEndCallback: (() => void) | null = null;
  private socket: WebSocket | null = null;
  private language: string;
  private totalBytesSent: number = 0;
  private lastError: string | null = null;

  constructor(apiKey: string, language: string = 'en') {
    // Sanitize key: remove quotes, spaces, and ensure it's a string
    this.apiKey = String(apiKey || '').replace(/["']/g, '').trim();
    this.language = language;
  }

  async connect(): Promise<void> {
    if (!this.apiKey || this.apiKey === 'mock_key') {
      const err = "Deepgram API Key is missing or invalid. Please check your cloud configuration.";
      this.lastError = err;
      return Promise.reject(new Error(err));
    }

    this.lastError = null;
    return new Promise((resolve, reject) => {
      try {
        const url = `wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&interim_results=true&filler_words=true&language=${this.language}&encoding=linear16&sample_rate=16000&endpointing=300&utterance_end_ms=1000&vad_events=true`;
        this.socket = new WebSocket(url, ['token', this.apiKey]);

        this.socket.onopen = () => {
          console.log('STT: Connected to Deepgram (Linear16)');
          resolve();
        };

        this.socket.onerror = (error) => {
          const errStr = 'WebSocket Connection Failed. This is usually due to an invalid API Key or network firewall.';
          console.error('STT Error:', error);
          this.lastError = errStr;
          reject(new Error(errStr));
        };

        this.socket.onclose = (event) => {
          this.lastError = `Closed (${event.code})`;
          console.warn('STT: WebSocket Closed:', event.code, event.reason);
        };

        this.socket.onmessage = (message) => {
          try {
            const received = JSON.parse(message.data);

            // Handle UtteranceEnd event (fired by Deepgram when speaker stops)
            if (received.type === 'UtteranceEnd') {
              if (this.utteranceEndCallback) this.utteranceEndCallback();
              return;
            }

            // Handle speech_final — Deepgram marks a pause-detected boundary
            if (received.speech_final === true && this.utteranceEndCallback) {
              this.utteranceEndCallback();
            }

            const transcript = received.channel?.alternatives[0]?.transcript;
            if (transcript && received.is_final !== undefined) {
              if (this.callback && transcript.trim().length > 0) {
                // Analytics
                const duration = received.duration || 0;
                let wpm = 0;
                if (duration > 0) {
                  const words = transcript.trim().split(/\s+/).length;
                  wpm = Math.round((words / duration) * 60);
                }
                const fillerMatches = transcript.match(/\b(um|uh|like|you know)\b/gi);
                const fillers = fillerMatches ? fillerMatches.length : 0;

                this.callback(transcript, received.is_final, { wpm, fillers });
              }
            }
          } catch (e) {
            console.error('STT: Failed to parse message:', e);
          }
        };
      } catch (err: any) {
        this.lastError = err.message;
        reject(err);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  sendAudio(data: ArrayBuffer): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
      this.totalBytesSent += data.byteLength;
    }
  }

  getStats() {
    return {
      state: this.socket ? this.socket.readyState : -1,
      sent: (this.totalBytesSent / 1024 / 1024).toFixed(2) + ' MB',
      error: this.lastError
    };
  }

  onTranscript(callback: (text: string, isFinal: boolean, analytics?: { wpm: number, fillers: number }) => void): void {
    this.callback = callback;
  }

  onUtteranceEnd(callback: () => void): void {
    this.utteranceEndCallback = callback;
  }
}
