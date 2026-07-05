# Image Enhancer ML

Система автоматического улучшения изображений в реальном времени с использованием машинного обучения в браузере.

## Автор

Гизатулин Тимур Маратович

## Демо

https://atomg0d.github.io/image-enhacer/

## Возможности

- Автоматическая коррекция - ML модель анализирует изображение и подбирает оптимальные параметры
- Мгновенная обработка - WebGL2 шейдеры на GPU обрабатывают изображения за доли секунды
- Асинхронная работа - Web Worker не блокирует интерфейс браузера
- Поддержка форматов - JPG, PNG, HEIC, BMP
- Большие изображения - обработка до 15+ мегапикселей
- Кроссплатформенность - работает во всех современных браузерах

## Архитектура

Система состоит из четырёх основных модулей:

1. Image Loader - загрузка и декодирование изображений (включая HEIC)
2. ML Predictor - TensorFlow.js модель для анализа и предсказания параметров
3. Pixel Processor - WebGL2 шейдеры для применения коррекции на GPU
4. Task Manager - API с событиями для управления задачами

## Технологии

- Frontend: TypeScript, Vite
- Machine Learning: TensorFlow.js
- GPU Acceleration: WebGL2 Shaders (GLSL)
- Asynchronous Processing: Web Workers, OffscreenCanvas
- Image Formats: heic2any (HEIC -> JPEG конвертация)

## API

### Методы

submitTask(imageFile: File): Promise<string>
Постановка задачи на обработку

getStatus(taskId: string): TaskInfo | null
Получение текущего статуса задачи

cancelTask(taskId: string): boolean
Прерывание выполнения задачи

getResult(taskId: string): Promise<Blob | null>
Получение готового результата

### События

status-change
Изменение статуса или прогресса

task-complete
Завершение задачи

task-error
Ошибка обработки

### Пример использования

import { ImageEnhancerAPI } from './api'

const api = new ImageEnhancerAPI()

api.on('status-change', (taskId, status, progress) => {
  console.log(`Задача ${taskId}: ${status} (${progress}%)`)
})

api.on('task-complete', async (taskId) => {
  const result = await api.getResult(taskId)
})

const taskId = await api.submitTask(imageFile)

## Быстрый старт

### Локальный запуск

git clone https://github.com/AtomG0d/image-enhacer.git
cd image-enhacer
npm install
npm run dev

Откройте http://localhost:5173 в браузере

### Сборка для продакшена

npm run build

Готовые файлы будут в папке dist/

## Производительность

  | Размер изображения | Время обработки |
  | 1 Мп (1024×1024) | ~0.18 сек |
  | 5 Мп (2500×2000) | ~1-2 сек |
  | 15 Мп (5000×3000) | ~3-5 сек |
  |21 Мп (5616×3744) | ~5-7 сек |

## Структура проекта
```
image-enhancer/
├── src/
│   ├── api.ts - API с методами и событиями
│   ├── worker.ts - Web Worker для фоновой обработки
│   ├── mlModel.ts - TensorFlow.js модель
│   ├── webglRenderer.ts - WebGL2 шейдеры
│   ├── main.ts - Точка входа
│   └── style.css - Стили
├── .github/
│   └── workflows/
│       └── deploy.yml - GitHub Actions для деплоя
├── index.html - Главная страница
├── vite.config.ts - Конфигурация Vite
├── tsconfig.json - Конфигурация TypeScript
└── package.json - Зависимости
```
## Как это работает

1. Загрузка изображения - пользователь выбирает файл через API
2. Декодирование - Web Worker создаёт ImageBitmap из файла
3. Анализ ML - модель анализирует thumbnail (224×224) и предсказывает параметры:
   - brightness (-1.0 до 1.0)
   - contrast (0.0 до 2.0)
   - saturation (0.0 до 2.0)
4. GPU обработка - WebGL2 шейдер применяет параметры к полному изображению
5. Результат - готовое изображение возвращается через API

## Технические детали

### ML Модель

- Архитектура: CNN (свёрточная нейросеть)
- Вход: 224×224×3 thumbnail
- Выход: 3 параметра коррекции (регрессия)
- Обучение: анализ гистограммы изображения

### WebGL2 Шейдер

Фрагментный шейдер применяет три операции к каждому пикселю:

1. Яркость: color += brightness
2. Контраст: color = (color - 0.5) * contrast + 0.5
3. Насыщенность: mix(luminance, color, saturation)
