export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface TaskInfo {
  id: string;
  status: TaskStatus;
  progress: number;
  result?: Blob;
}

export type EventCallback = (...args: any[]) => void;

export class ImageEnhancerAPI {
  private tasks: Map<string, TaskInfo> = new Map();
  private listeners: Map<string, EventCallback[]> = new Map();
  private worker: Worker;

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    
    this.worker.onmessage = (e) => {
      const { type, taskId, status, progress, result } = e.data;
      const task = this.tasks.get(taskId);
      if (!task) return;

      if (status !== undefined) {
        task.status = status;
        task.progress = progress;
        this.emit('status-change', taskId, status, progress);
      }

      if (type === 'COMPLETE') {
        task.result = result;
        task.status = 'completed';
        task.progress = 100;
        this.emit('task-complete', taskId, 'completed', 100);
      } else if (type === 'ERROR') {
        task.status = 'failed';
        this.emit('task-error', taskId, 'failed', task.progress);
      }
    };
  }

  private async convertHeicToJpeg(file: File): Promise<File> {
    console.log(`Starting HEIC conversion for: ${file.name}, type: ${file.type}`);
    
    try {
      const { default: heic2any } = await import('heic2any');
      console.log('heic2any loaded');
      
      const blob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.9
      });
      
      console.log('Conversion complete, blob type:', (blob as Blob).type);
      
      const jpegFile = new File([blob as Blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      
      console.log(`Created JPEG file: ${jpegFile.name}, type: ${jpegFile.type}, size: ${jpegFile.size}`);
      
      return jpegFile;
    } catch (error) {
      console.error('HEIC conversion failed:', error);
      throw new Error('Failed to convert HEIC to JPEG');
    }
  }

  async submitTask(imageFile: File): Promise<string> {
    const taskId = crypto.randomUUID();
    const task: TaskInfo = { id: taskId, status: 'pending', progress: 0 };
    this.tasks.set(taskId, task);

    try {
      let fileToProcess = imageFile;
      let mimeType = imageFile.type;

      console.log(`Original file: ${imageFile.name}, type: ${imageFile.type}, size: ${imageFile.size}`);

      if (imageFile.type === 'image/heic' || imageFile.type === 'image/heif' || imageFile.name.match(/\.(heic|heif)$/i)) {
        console.log('Detected HEIC format, starting conversion...');
        fileToProcess = await this.convertHeicToJpeg(imageFile);
        mimeType = 'image/jpeg';
        console.log(`HEIC converted. New file type: ${mimeType}`);
      }

      const arrayBuffer = await fileToProcess.arrayBuffer();
      console.log(`ArrayBuffer created: ${arrayBuffer.byteLength} bytes`);
      
      const message = {
        type: 'START',
        taskId,
        image: arrayBuffer,
        fileName: fileToProcess.name,
        mimeType: mimeType
      };
      
      console.log(`Sending to worker: mimeType="${mimeType}", fileName="${fileToProcess.name}"`);
      
      this.worker.postMessage(message);
      
    } catch (error: any) {
      console.error('Failed to submit task:', error);
      task.status = 'failed';
      this.emit('task-error', taskId, 'failed', 0);
    }
    
    this.emit('status-change', taskId, 'pending', 0);
    return taskId;
  }

  getStatus(taskId: string): TaskInfo | null {
    return this.tasks.get(taskId) || null;
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task && task.status !== 'completed' && task.status !== 'cancelled') {
      this.worker.postMessage({ type: 'CANCEL', taskId });
      task.status = 'cancelled';
      this.emit('status-change', taskId, 'cancelled', task.progress);
      return true;
    }
    return false;
  }

  async getResult(taskId: string): Promise<Blob | null> {
    const task = this.tasks.get(taskId);
    if (task?.status === 'completed' && task.result) {
      return task.result;
    }
    return new Promise((resolve) => {
      const check = (id: string) => {
        if (id === taskId) {
          this.off('task-complete', check);
          resolve(this.tasks.get(taskId)?.result || null);
        }
      };
      this.on('task-complete', check);
    });
  }

  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback) {
    const cbs = this.listeners.get(event);
    if (cbs) this.listeners.set(event, cbs.filter(cb => cb !== callback));
  }

  private emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach(cb => cb(...args));
  }
}