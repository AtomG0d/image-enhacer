import * as tf from '@tensorflow/tfjs';

export interface EnhancementParams {
  brightness: number;   // -1.0 to 1.0
  contrast: number;     // 0.0 to 2.0 (1.0 = normal)
  saturation: number;   // 0.0 to 2.0 (1.0 = normal)
}

export class ImageEnhancementModel {
  private model: tf.LayersModel | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.model = await this.createModel();
      this.isInitialized = true;
      console.log('ML Model initialized');
    } catch (error) {
      console.error('Failed to initialize ML model:', error);
      throw error;
    }
  }

  private async createModel(): Promise<tf.LayersModel> {
    const model = tf.sequential();

    model.add(tf.layers.conv2d({
      inputShape: [224, 224, 3],
      filters: 32,
      kernelSize: 3,
      activation: 'relu',
      strides: 2
    }));

    model.add(tf.layers.conv2d({
      filters: 64,
      kernelSize: 3,
      activation: 'relu',
      strides: 2
    }));

    model.add(tf.layers.conv2d({
      filters: 128,
      kernelSize: 3,
      activation: 'relu',
      strides: 2
    }));

    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
    
    model.add(tf.layers.dense({ 
      units: 3, 
      activation: 'linear' 
    }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });

    return model;
  }



async predictParams(imageBitmap: ImageBitmap): Promise<EnhancementParams> {
  if (!this.isInitialized) {
    await this.initialize();
  }

  const thumbCanvas = new OffscreenCanvas(224, 224);
  const thumbCtx = thumbCanvas.getContext('2d')!;
  thumbCtx.drawImage(imageBitmap, 0, 0, 224, 224);
  
  const imageData = thumbCtx.getImageData(0, 0, 224, 224);
  
  const params = this.analyzeImage(imageData.data);

  if (this.model) {
    try {
      const tensor = tf.browser.fromPixels(imageData).toFloat().div(255.0).expandDims(0);
      const prediction = this.model.predict(tensor) as tf.Tensor;
      const values = await prediction.data();
      
      params.brightness = Math.max(-1, Math.min(1, values[0]));
      params.contrast = Math.max(0, Math.min(2, values[1] + 1));
      params.saturation = Math.max(0, Math.min(2, values[2] + 1));
      
      tensor.dispose();
      prediction.dispose();
      console.log('Model prediction used');
    } catch (error) {
      console.warn('Model prediction failed, using heuristic:', error);
    }
  }

  return params;
}


  private analyzeImage(pixels: Uint8ClampedArray): EnhancementParams {
    let totalBrightness = 0;
    let minBrightness = 255;
    let maxBrightness = 0;
    let totalSaturation = 0;

    const numPixels = pixels.length / 4;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      // Яркость (luminance)
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += brightness;
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);

      // Насыщенность
      const maxRGB = Math.max(r, g, b);
      const minRGB = Math.min(r, g, b);
      const saturation = maxRGB === 0 ? 0 : (maxRGB - minRGB) / maxRGB;
      totalSaturation += saturation;
    }

    const avgBrightness = totalBrightness / numPixels;
    const avgSaturation = totalSaturation / numPixels;
    const dynamicRange = maxBrightness - minBrightness;

    
    const brightness = avgBrightness < 100 ? (100 - avgBrightness) / 255 : 
                       avgBrightness > 180 ? (180 - avgBrightness) / 255 : 0;

    const contrast = dynamicRange < 100 ? 1.3 : 
                     dynamicRange > 200 ? 0.9 : 1.1;

    const saturation = avgSaturation < 0.3 ? 1.4 : 
                       avgSaturation > 0.7 ? 0.9 : 1.1;

    return {
      brightness: Math.max(-0.5, Math.min(0.5, brightness)),
      contrast: Math.max(0.8, Math.min(1.5, contrast)),
      saturation: Math.max(0.8, Math.min(1.5, saturation))
    };
  }

  async saveModel(): Promise<void> {
    if (this.model) {
      await this.model.save('localstorage://enhancement-model');
      console.log('Model saved to localStorage');
    }
  }

  async loadModel(): Promise<boolean> {
    try {
      this.model = await tf.loadLayersModel('localstorage://enhancement-model');
      this.isInitialized = true;
      console.log('Model loaded from localStorage');
      return true;
    } catch (error) {
      console.log('No saved model found');
      return false;
    }
  }
}