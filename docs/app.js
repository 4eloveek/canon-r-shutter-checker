import { parseCanonFile } from './canon-parser.js';

const TEXT = {
  ru: {
    pageTitle: 'Canon R Shutter Checker — счётчик кадров EOS R7, R10 и R100',
    ogTitle: 'Canon R Shutter Checker',
    metaDescription: 'Офлайн-проверка счётчика кадров Canon EOS R7, R10 и R100 по оригинальному JPEG или CR3. Метаданные читаются локально в браузере.',
    skip: 'Перейти к проверке файла',
    brandAria: 'Canon R Shutter Checker — на главную',
    langAria: 'Язык интерфейса',
    eyebrow: 'Локальная проверка метаданных',
    title: 'Счётчик кадров Canon',
    lede: 'Узнайте общий счётчик кадров EOS R7, R10 или R100 по оригинальному JPEG или CR3. Это общий счётчик на момент съёмки, а не только механический износ; файл читается локально и никуда не отправляется.',
    checkerTitle: 'Проверить файл',
    dropTitle: 'Перетащите файлы сюда',
    dropHint: 'или нажмите, чтобы выбрать JPEG или CR3',
    dropAria: 'Выбрать файлы JPEG или CR3 для проверки',
    clear: 'Очистить',
    processing: 'Обработка…',
    processingFile: 'Обработка: {name}',
    processed: 'Файлов: {files} · ошибок: {errors}',
    resultsAria: 'Результаты проверки',
    counterLabel: 'кадров',
    counterAria: 'Счётчик кадров: {count}',
    metaCamera: 'Камера',
    metaFirmware: 'Прошивка',
    metaFormat: 'Формат',
    unknownFirmware: 'неизвестна',
    errorChip: 'Ошибка',
    statusVerified: 'Проверено',
    statusPreliminary: 'Предварительно',
    statusUnverified: 'Не проверено',
    statusVerifiedTitle: 'Комбинация модель / прошивка / формат подтверждена оригинальными образцами.',
    statusPreliminaryTitle: 'Счётчик по кадрам подтверждён, но поведение после форматирования и сброса нумерации ещё не проверено.',
    statusUnverifiedTitle: 'Раскладка CameraInfo совпала, но эта пара прошивка / формат ещё не проверена на образцах.',
    notesTitle: 'Что важно знать',
    noteLocalTitle: 'Только на этом устройстве',
    noteLocal: 'Сайт читает файл в памяти браузера. Здесь нет серверной обработки, аналитики и сторонних запросов; фотография не загружается и не сохраняется сайтом.',
    noteCounterTitle: 'Это общий счётчик кадров',
    noteCounter: 'Значение берётся из метаданных на момент съёмки. Оно включает электронный и EFCS-затвор, поэтому не равно износу механического затвора.',
    noteOriginalTitle: 'Нужен оригинальный файл',
    noteOriginal: 'Блок CameraInfo сохраняется в JPEG или CR3 прямо с камеры. Мессенджеры, редакторы, облачные конвертеры и соцсети часто удаляют его.',
    noteCompositeTitle: 'Composite-кадры',
    noteComposite: 'Панорамы и focus stacking могут хранить 0, 65535, 4294967295 или другой размер блока. Для оценки смотрите ближайший обычный кадр.',
    noteR100Title: 'R100 — предварительно',
    noteR100: 'Счётчик по кадрам подтверждён, но сохранение после форматирования и сброса нумерации ещё не проверено на достаточном числе файлов.',
    noteWidthTitle: 'Четыре байта',
    noteWidth: 'Поле читается как 32-битное little-endian. На всех проверенных реальных файлах значение было ниже 65536, поэтому старшие байты пока не подтверждены файлом с большим значением.',
    tableCaption: 'Поддерживаемые модели',
    thModel: 'Модель',
    thFormat: 'Форматы',
    thStatus: 'Статус',
    tableR7Status: 'Проверено',
    tableR10Status: 'Проверено',
    tableR100Status: 'Предварительно',
    footerRepo: 'Исходники и CLI',
    footerFormat: 'Формат CameraInfo',
    footerLicense: 'MIT',
    footerDisclaimer: 'Не связан с Canon.',
    footerVersion: 'Версия 2.0',
  },
  en: {
    pageTitle: 'Canon R Shutter Checker — frame counter for EOS R7, R10 and R100',
    ogTitle: 'Canon R Shutter Checker',
    metaDescription: 'Offline Canon EOS R7, R10 and R100 frame counter reader for original JPEG and CR3 files. Metadata is parsed locally in your browser.',
    skip: 'Skip to the file checker',
    brandAria: 'Canon R Shutter Checker — home',
    langAria: 'Interface language',
    eyebrow: 'Local metadata check',
    title: 'Canon frame counter',
    lede: 'Read the total frame count of an EOS R7, R10 or R100 from an original JPEG or CR3. It is the total count at capture time, not mechanical-shutter wear alone; the file is parsed locally and never uploaded.',
    checkerTitle: 'Check a file',
    dropTitle: 'Drop files here',
    dropHint: 'or click to choose a JPEG or CR3',
    dropAria: 'Choose JPEG or CR3 files to check',
    clear: 'Clear',
    processing: 'Processing…',
    processingFile: 'Processing: {name}',
    processed: 'Files: {files} · errors: {errors}',
    resultsAria: 'Check results',
    counterLabel: 'frames',
    counterAria: 'Frame count: {count}',
    metaCamera: 'Camera',
    metaFirmware: 'Firmware',
    metaFormat: 'Format',
    unknownFirmware: 'unknown',
    errorChip: 'Error',
    statusVerified: 'Verified',
    statusPreliminary: 'Preliminary',
    statusUnverified: 'Unverified',
    statusVerifiedTitle: 'This camera / firmware / format combination is confirmed by original samples.',
    statusPreliminaryTitle: 'Per-frame counting is confirmed, but behaviour after formatting and file-number resets is not yet proven.',
    statusUnverifiedTitle: 'The CameraInfo layout matched, but this firmware / format pair has not been checked against samples.',
    notesTitle: 'What to know',
    noteLocalTitle: 'Only on this device',
    noteLocal: 'The page reads the file in browser memory. There is no server-side processing, analytics or third-party request; the photo is not uploaded and is not stored by this site.',
    noteCounterTitle: 'This is a total frame count',
    noteCounter: 'The value comes from metadata at capture time. It includes electronic and EFCS frames, so it is not a mechanical-shutter wear count.',
    noteOriginalTitle: 'Use an original file',
    noteOriginal: 'The CameraInfo block is written in camera-original JPEG and CR3 files. Messengers, editors, cloud converters and social networks often strip it.',
    noteCompositeTitle: 'Composite frames',
    noteComposite: 'Panoramas and focus stacks may store 0, 65535, 4294967295 or use a different block size. Read a nearby ordinary frame instead.',
    noteR100Title: 'R100 is preliminary',
    noteR100: 'Per-frame counting is confirmed, but persistence after formatting and file-number resets has not been checked on enough files.',
    noteWidthTitle: 'Four bytes',
    noteWidth: 'The field is read as a 32-bit little-endian value. Every verified real sample was below 65536, so the high bytes are not yet proven by a high-count file.',
    tableCaption: 'Supported models',
    thModel: 'Model',
    thFormat: 'Formats',
    thStatus: 'Status',
    tableR7Status: 'Verified',
    tableR10Status: 'Verified',
    tableR100Status: 'Preliminary',
    footerRepo: 'Source and CLI',
    footerFormat: 'CameraInfo format',
    footerLicense: 'MIT',
    footerDisclaimer: 'Not affiliated with Canon.',
    footerVersion: 'Version 2.0',
  },
};

const ERROR_TEXT = {
  ru: {
    UNSUPPORTED_FORMAT: {
      message: 'Это не JPEG и не CR3.',
      hint: 'Поддерживаются оригинальные JPEG и CR3 с Canon EOS R7, R10 или R100.',
    },
    INVALID_FILE: {
      message: 'Не удалось разобрать структуру файла.',
      hint: 'Файл повреждён, обрезан или имеет необычную структуру. Попробуйте другой оригинал.',
    },
    MISSING_METADATA: {
      message: 'В файле нет блока CameraInfo Canon.',
      hint: 'Используйте оригинал с карты памяти. Мессенджеры, редакторы и облачные конвертеры часто удаляют метаданные.',
    },
    UNSUPPORTED_MODEL: (details) => {
      const model = typeof details.model === 'string' && details.model ? details.model : '';
      return model
        ? {
          message: 'Неподдерживаемая модель: ' + model + '.',
          hint: 'Поддерживаются Canon EOS R7, R10 и R100.',
        }
        : {
          message: 'Не удалось определить модель камеры.',
          hint: 'Поддерживаются Canon EOS R7, R10 и R100.',
        };
    },
    UNSUPPORTED_FILE_TYPE: (details) => {
      const model = typeof details.model === 'string' && details.model ? details.model : '';
      const format = typeof details.format === 'string' && details.format ? details.format : '';
      const camera = model || 'этой камеры';
      return {
        message: format
          ? 'Формат ' + format + ' не поддерживается для ' + camera + '.'
          : 'Этот формат не поддерживается для ' + camera + '.',
        hint: 'Поддерживаются оригинальные JPEG и CR3.',
      };
    },
    UNKNOWN_LAYOUT: (details) => {
      if (details.panorama === true) {
        const size = Number.isInteger(details.blockSize) ? details.blockSize : 16896;
        return {
          message: 'Это панорамный composite: блок CameraInfo имеет размер ' + size + ' байт.',
          hint: 'Счётчик в таком файле недоступен. Проверьте ближайший обычный кадр.',
        };
      }
      return {
        message: 'Неизвестная раскладка блока CameraInfo.',
        hint: 'Возможно, это composite, другой формат или изменённый файл. Нужен оригинал поддерживаемой камеры.',
      };
    },
    MULTIFRAME: {
      message: 'Многокадровый RAW burst не поддерживается.',
      hint: 'Сохраните одиночный оригинальный CR3 и проверьте его.',
    },
    CONFLICTING_COUNTERS: {
      message: 'В файле несколько блоков CameraInfo с разными значениями.',
      hint: 'Файл повреждён или изменён. Проверьте другой оригинал.',
    },
    COUNTER_UNAVAILABLE: (details) => {
      const value = details.value === undefined ? '—' : String(details.value);
      return {
        message: 'Счётчик недоступен: служебное значение ' + value + '.',
        hint: '0, 65535 и 4294967295 неотличимы от маркеров composite или специального режима. Проверьте ближайший обычный кадр.',
      };
    },
    READ_ERROR: {
      message: 'Не удалось прочитать файл.',
      hint: 'Проверьте, что файл доступен и не повреждён.',
    },
  },
  en: {
    UNSUPPORTED_FORMAT: {
      message: 'This is not a JPEG or CR3 file.',
      hint: 'Supported files are original JPEG and CR3 from a Canon EOS R7, R10 or R100.',
    },
    INVALID_FILE: {
      message: 'The file structure could not be parsed.',
      hint: 'The file is damaged, truncated or has an unusual structure. Try another original.',
    },
    MISSING_METADATA: {
      message: 'This file has no Canon CameraInfo block.',
      hint: 'Use a camera-original file from the memory card. Messengers, editors and cloud converters often remove metadata.',
    },
    UNSUPPORTED_MODEL: (details) => {
      const model = typeof details.model === 'string' && details.model ? details.model : '';
      return model
        ? {
          message: 'Unsupported camera: ' + model + '.',
          hint: 'Supported cameras are Canon EOS R7, R10 and R100.',
        }
        : {
          message: 'The camera model was not recognised.',
          hint: 'Supported cameras are Canon EOS R7, R10 and R100.',
        };
    },
    UNSUPPORTED_FILE_TYPE: (details) => {
      const model = typeof details.model === 'string' && details.model ? details.model : '';
      const format = typeof details.format === 'string' && details.format ? details.format : '';
      const camera = model || 'this camera';
      return {
        message: format
          ? format + ' is not supported for ' + camera + '.'
          : 'This file type is not supported for ' + camera + '.',
        hint: 'Supported files are original JPEG and CR3.',
      };
    },
    UNKNOWN_LAYOUT: (details) => {
      if (details.panorama === true) {
        const size = Number.isInteger(details.blockSize) ? details.blockSize : 16896;
        return {
          message: 'This is a panorama composite: its CameraInfo block is ' + size + ' bytes.',
          hint: 'The counter is unavailable in this file. Check the nearest ordinary frame instead.',
        };
      }
      return {
        message: 'Unrecognised CameraInfo layout.',
        hint: 'This may be a composite, another format or a modified file. An original from a supported camera is required.',
      };
    },
    MULTIFRAME: {
      message: 'Multi-frame RAW bursts are not supported.',
      hint: 'Save a single original CR3 and check that instead.',
    },
    CONFLICTING_COUNTERS: {
      message: 'This file contains several CameraInfo blocks with different values.',
      hint: 'The file is damaged or modified. Try another original.',
    },
    COUNTER_UNAVAILABLE: (details) => {
      const value = details.value === undefined ? '—' : String(details.value);
      return {
        message: 'Counter unavailable: special value ' + value + '.',
        hint: '0, 65535 and 4294967295 are indistinguishable from composite or special-mode markers. Check the nearest ordinary frame.',
      };
    },
    READ_ERROR: {
      message: 'The file could not be read.',
      hint: 'Check that the file is accessible and not damaged.',
    },
  },
};

const STATUS_LABEL_KEYS = {
  verified: 'statusVerified',
  preliminary: 'statusPreliminary',
  unverified: 'statusUnverified',
};

const STATUS_TITLE_KEYS = {
  verified: 'statusVerifiedTitle',
  preliminary: 'statusPreliminaryTitle',
  unverified: 'statusUnverifiedTitle',
};

const numberFormats = {
  ru: new Intl.NumberFormat('ru-RU'),
  en: new Intl.NumberFormat('en-US'),
};

const elements = {
  metaDescription: document.querySelector('meta[name="description"]'),
  ogTitle: document.querySelector('meta[property="og:title"]'),
  ogDescription: document.querySelector('meta[property="og:description"]'),
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  toolbar: document.getElementById('toolbar'),
  status: document.getElementById('status'),
  clear: document.getElementById('clear'),
  results: document.getElementById('results'),
  langButtons: Array.from(document.querySelectorAll('.lang-button')),
};

const state = {
  lang: 'ru',
  results: [],
  queue: [],
  total: 0,
  done: 0,
  errors: 0,
  activeName: null,
  busy: false,
  processing: false,
  generation: 0,
};

function t(key) {
  const dictionary = TEXT[state.lang] || TEXT.ru;
  return typeof dictionary[key] === 'string' ? dictionary[key] : key;
}

function formatCount(value) {
  return numberFormats[state.lang].format(value);
}

function detectLanguage() {
  const languages = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language || ''];
  return languages.some((language) => /^ru\b/i.test(language)) ? 'ru' : 'en';
}

function describeError(code, details) {
  const dictionary = ERROR_TEXT[state.lang] || ERROR_TEXT.ru;
  const entry = dictionary[code] || dictionary.INVALID_FILE;
  const value = typeof entry === 'function' ? entry(details || {}) : entry;
  return value || dictionary.INVALID_FILE;
}

function normalizeError(error) {
  if (error && error.name === 'CanonFileError' && typeof error.code === 'string') {
    return {
      code: error.code,
      details: error.details && typeof error.details === 'object' ? error.details : {},
    };
  }
  return { code: 'READ_ERROR', details: {} };
}

function metaPair(label, value) {
  const wrap = document.createElement('div');
  const term = document.createElement('dt');
  const description = document.createElement('dd');
  term.textContent = label;
  description.textContent = value;
  wrap.append(term, description);
  return wrap;
}

function buildResultCard(item) {
  const data = item.data;
  const itemNode = document.createElement('li');
  itemNode.className = 'result';

  const head = document.createElement('div');
  head.className = 'result-head';
  const name = document.createElement('p');
  name.className = 'file-name';
  name.textContent = item.name;
  name.title = item.name;

  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.dataset.status = data.status;
  chip.textContent = t(STATUS_LABEL_KEYS[data.status] || 'statusUnverified');
  chip.title = t(STATUS_TITLE_KEYS[data.status] || 'statusUnverifiedTitle');
  head.append(name, chip);

  const counterRow = document.createElement('div');
  counterRow.className = 'counter-row';
  const counter = document.createElement('span');
  counter.className = 'counter-value';
  counter.textContent = formatCount(data.shutterCount);
  counter.setAttribute(
    'aria-label',
    t('counterAria').replace('{count}', () => formatCount(data.shutterCount)),
  );
  const counterLabel = document.createElement('span');
  counterLabel.className = 'counter-label';
  counterLabel.setAttribute('aria-hidden', 'true');
  counterLabel.textContent = t('counterLabel');
  counterRow.append(counter, counterLabel);

  const meta = document.createElement('dl');
  meta.className = 'meta';
  meta.append(
    metaPair(t('metaCamera'), data.model),
    metaPair(
      t('metaFirmware'),
      data.firmware === 'unknown' ? t('unknownFirmware') : data.firmware,
    ),
    metaPair(t('metaFormat'), data.format),
  );

  itemNode.append(head, counterRow, meta);
  return itemNode;
}

function buildErrorCard(item) {
  const itemNode = document.createElement('li');
  itemNode.className = 'result is-error';

  const head = document.createElement('div');
  head.className = 'result-head';
  const name = document.createElement('p');
  name.className = 'file-name';
  name.textContent = item.name;
  name.title = item.name;

  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.dataset.status = 'error';
  chip.textContent = t('errorChip');
  head.append(name, chip);

  const copy = describeError(item.error.code, item.error.details);
  const message = document.createElement('p');
  message.className = 'error-message';
  message.textContent = copy.message;
  const hint = document.createElement('p');
  hint.className = 'error-hint';
  hint.textContent = copy.hint;

  itemNode.append(head, message, hint);
  return itemNode;
}

function renderResults() {
  const fragment = document.createDocumentFragment();
  for (const item of state.results) {
    fragment.append(item.error ? buildErrorCard(item) : buildResultCard(item));
  }
  elements.results.replaceChildren(fragment);
  elements.results.setAttribute('aria-label', t('resultsAria'));
  elements.toolbar.hidden = !state.busy && state.results.length === 0;
}

function updateStatus() {
  const busy = state.busy;
  elements.results.setAttribute('aria-busy', busy ? 'true' : 'false');
  elements.status.classList.toggle('is-busy', busy);
  elements.toolbar.hidden = !busy && state.results.length === 0;

  if (busy) {
    elements.status.textContent = state.activeName
      ? t('processingFile').replace('{name}', () => state.activeName)
      : t('processing');
    return;
  }

  if (state.results.length > 0) {
    elements.status.textContent = t('processed')
      .replace('{files}', () => String(state.done))
      .replace('{errors}', () => String(state.errors));
  } else {
    elements.status.textContent = '';
  }
}

function applyLanguage() {
  const dictionary = TEXT[state.lang] || TEXT.ru;
  document.documentElement.lang = state.lang;
  document.title = dictionary.pageTitle;

  if (elements.metaDescription) {
    elements.metaDescription.setAttribute('content', dictionary.metaDescription);
  }
  if (elements.ogTitle) {
    elements.ogTitle.setAttribute('content', dictionary.ogTitle);
  }
  if (elements.ogDescription) {
    elements.ogDescription.setAttribute('content', dictionary.metaDescription);
  }

  for (const node of document.querySelectorAll('[data-i18n]')) {
    const value = dictionary[node.dataset.i18n];
    if (typeof value === 'string') node.textContent = value;
  }
  for (const node of document.querySelectorAll('[data-i18n-aria]')) {
    const value = dictionary[node.dataset.i18nAria];
    if (typeof value === 'string') node.setAttribute('aria-label', value);
  }
  for (const button of elements.langButtons) {
    button.setAttribute('aria-pressed', button.dataset.lang === state.lang ? 'true' : 'false');
  }

  renderResults();
  updateStatus();
}

function setLanguage(language) {
  if (language !== 'ru' && language !== 'en') return;
  if (state.lang === language) return;
  state.lang = language;
  applyLanguage();
}

async function processQueue() {
  if (state.processing) return;
  state.processing = true;

  while (state.queue.length > 0) {
    const file = state.queue.shift();
    const generation = state.generation;
    state.activeName = file.name;
    updateStatus();

    let buffer = null;
    let outcome = null;
    try {
      buffer = await file.arrayBuffer();
      if (generation === state.generation) {
        outcome = { data: parseCanonFile(new Uint8Array(buffer)) };
      }
    } catch (error) {
      if (generation === state.generation) {
        outcome = { error: normalizeError(error) };
      }
    } finally {
      buffer = null;
    }

    if (generation !== state.generation) {
      state.activeName = null;
      continue;
    }

    if (outcome && outcome.error) {
      state.results.push({ name: file.name, error: outcome.error });
      state.errors += 1;
    } else if (outcome && outcome.data) {
      state.results.push({ name: file.name, data: outcome.data });
    }
    state.done += 1;
    state.activeName = null;
    renderResults();
    updateStatus();
  }

  state.processing = false;
  state.busy = false;
  state.activeName = null;
  updateStatus();
}

function enqueue(fileList) {
  const files = Array.from(fileList || []).filter(
    (file) => file && typeof file.arrayBuffer === 'function',
  );
  if (files.length === 0) return;

  state.total += files.length;
  state.busy = true;
  state.queue.push(...files);
  updateStatus();
  void processQueue();
}

function clearAll() {
  state.generation += 1;
  state.results = [];
  state.queue = [];
  state.total = 0;
  state.done = 0;
  state.errors = 0;
  state.activeName = null;
  state.busy = false;
  elements.fileInput.value = '';
  renderResults();
  updateStatus();
  elements.dropzone.focus();
}

function bindEvents() {
  for (const button of elements.langButtons) {
    button.addEventListener('click', () => setLanguage(button.dataset.lang));
  }

  elements.dropzone.addEventListener('click', () => elements.fileInput.click());
  elements.dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      elements.fileInput.click();
    }
  });
  elements.fileInput.addEventListener('change', () => {
    if (elements.fileInput.files && elements.fileInput.files.length > 0) {
      enqueue(elements.fileInput.files);
    }
    elements.fileInput.value = '';
  });
  elements.clear.addEventListener('click', clearAll);

  for (const type of ['dragenter', 'dragover']) {
    elements.dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      event.stopPropagation();
      elements.dropzone.classList.add('is-over');
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    });
  }
  elements.dropzone.addEventListener('dragleave', (event) => {
    event.preventDefault();
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !elements.dropzone.contains(next)) {
      elements.dropzone.classList.remove('is-over');
    }
  });
  elements.dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    elements.dropzone.classList.remove('is-over');
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      enqueue(event.dataTransfer.files);
    }
  });

  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());
}

state.lang = detectLanguage();
bindEvents();
applyLanguage();
