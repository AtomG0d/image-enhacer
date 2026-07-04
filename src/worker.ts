// src/worker.ts

import { WebGLRenderer } from './webglRenderer';
import { ImageEnhancementModel } from './mlModel';

interface TaskMessage {
  type: 'START' | 'CANCEL';
  taskId: string;
  image?: ArrayBuffer;
  fileName?: string;
  mimeType?: string;
}

const activeTasks = new Map<string, boolean>();
let mlModel: ImageEnhancementModel | null = null;

async function getMLModel(): Promise<ImageEnhancementModel> {
  if (!mlModel) {
    mlModel = new ImageEnhancementModel();
    await mlModel.initialize();
  }
  return mlModel;
}

self.onmessage = async (e: MessageEvent<TaskMessage>) => {
  const { type, taskId, image, mimeType } = e.data;

  if (type === 'START' && image) {
    activeTasks.set(taskId, true);
    const startTime = performance.now();
    
    try {
      console.log(`Worker [${taskId}]: Starting processing...`);
      console.log(`Worker [${taskId}]: MIME type:`, mimeType);
      console.log(`Worker [${taskId}]: Image size:`, image.byteLength, 'bytes');
      
      postMessage({ taskId, status: 'processing', progress: 10 });

      // Создаём Blob
      const blob = new Blob([image], { type: mimeType || 'image/jpeg' });
      console.log(`Worker [${taskId}]: Created blob, size:`, blob.size);
      
      if (!activeTasks.get(taskId)) return;
      postMessage({ taskId, status: 'processing', progress: 20 });

      // Декодируем
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(blob);
        console.log(`Worker [${taskId}]: Decoded bitmap ${bitmap.width}x${bitmap.height}`);
      } catch (decodeError: any) {
        console.error(`Worker [${taskId}]: Decode error:`, decodeError);
        throw new Error(`Failed to decode image: ${decodeError.message}. Try using JPEG or PNG format.`);
      }
      
      if (!activeTasks.get(taskId)) {
        bitmap.close();
        return;
      }
      postMessage({ taskId, status: 'processing', progress: 30 });

      // ML модель
      const model = await getMLModel();
      
      if (!activeTasks.get(taskId)) {
        bitmap.close();
        return;
      }
      postMessage({ taskId, status: 'processing', progress: 40 });

      const params = await model.predictParams(bitmap);
      console.log(`Worker [${taskId}]: Predicted params:`, params);
      
      if (!activeTasks.get(taskId)) {
        bitmap.close();
        return;
      }
      postMessage({ taskId, status: 'processing', progress: 50 });

      // WebGL рендеринг
      const renderer = new WebGLRenderer(bitmap.width, bitmap.height);
      const resultBlob = await renderer.render(bitmap, params);
      console.log(`Worker [${taskId}]: Rendering complete, blob size:`, resultBlob.size);
      
      bitmap.close();

      if (!activeTasks.get(taskId)) return;
      postMessage({ taskId, status: 'processing', progress: 90 });

      postMessage({ type: 'COMPLETE', taskId, result: resultBlob });
      activeTasks.delete(taskId);
      
      // ТАЙМЕР: считаем время
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      console.log(`Worker [${taskId}]: Task completed in ${duration} seconds`);

    } catch (error: any) {
      console.error(`Worker [${taskId}] error:`, error);
      postMessage({ type: 'ERROR', taskId, error: error.message });
      activeTasks.delete(taskId);
    }
  }

  if (type === 'CANCEL') {
    activeTasks.set(taskId, false);
  }
};