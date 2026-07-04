import './style.css'
import { ImageEnhancerAPI } from './api'

const api = new ImageEnhancerAPI();

const fileInput = document.getElementById('file-input') as HTMLInputElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const resultImg = document.getElementById('result-img') as HTMLImageElement;

api.on('status-change', (taskId, status, progress) => {
  statusDiv.innerText = `Статус: ${status} | Прогресс: ${progress}%`;
  console.log(`Task ${taskId}: ${status} (${progress}%)`);
});

api.on('task-complete', async (taskId) => {
  statusDiv.innerText = 'Готово!';
  const blob = await api.getResult(taskId);
  if (blob) {
    resultImg.src = URL.createObjectURL(blob);
  }
});

fileInput.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  resultImg.src = '';
  statusDiv.innerText = 'Загрузка...';

  const taskId = await api.submitTask(file);
  console.log('Создана задача:', taskId);
});