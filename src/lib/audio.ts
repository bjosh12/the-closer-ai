export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onDataAvailable: (data: ArrayBuffer) => void;
  private mode: 'system' | 'mic';

  private analyser: AnalyserNode | null = null;
  private volume: number = 0;

  constructor(onDataAvailable: (data: ArrayBuffer) => void, mode: 'system' | 'mic' = 'mic') {
    this.onDataAvailable = onDataAvailable;
    this.mode = mode;
  }

  async start() {
    try {
      if (this.mode === 'system') {
        this.stream = await (navigator.mediaDevices as any).getDisplayMedia({
          audio: true,
          video: true
        }) as MediaStream;
        // We cannot stop the video track here because in Chromium/Electron, stopping the 
        // video track of a display media stream will terminate the entire stream (including audio).
        // Instead, we just disable the track to reduce processing.
        if (this.stream) this.stream.getVideoTracks().forEach(track => { track.enabled = false; });
      } else {
        this.stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { echoCancellation: true, noiseSuppression: true } 
        });
      }

      this.audioCtx = new AudioContext({ sampleRate: 16000 });
      await this.audioCtx.resume(); // CRITICAL: Ensure context is running

      const source = this.audioCtx.createMediaStreamSource(this.stream!);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      
      this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
      
      source.connect(this.analyser);
      this.analyser.connect(this.processor);
      this.processor.connect(this.audioCtx.destination);

      const pcmData = new Int16Array(4096);
      const fftData = new Uint8Array(this.analyser.frequencyBinCount);

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Track volume for debug
        if (this.analyser) {
          this.analyser.getByteFrequencyData(fftData);
          let sum = 0;
          for (let i = 0; i < fftData.length; i++) sum += fftData[i];
          this.volume = sum / fftData.length;
        }

        // Convert Float32 to Int16 (Linear16)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        this.onDataAvailable(pcmData.buffer.slice(0)); // Clone to avoid mutation
      };

      return true;
    } catch (error) {
      console.error(`Error starting ${this.mode} audio capture:`, error);
      return false;
    }
  }

  getVolume() {
    return Math.round(this.volume);
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}
