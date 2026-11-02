# Support / Model verification

[English](#english) | [Русский](#русский)

---

<a id="english"></a>
## English

GitHub has no private messages. Please use a public issue:

**[Open a Model test request](../../issues/new?template=model-test.yml)**

### Currently supported

- EOS R7 firmware 1.8.0: CR3
- EOS R7 JPEG with matching layout: accepted as unverified; composite outputs may have no counter
- EOS R10 firmware 1.5.0: CR3/JPEG
- EOS R10 firmware 1.7.0: CR3
- EOS R10 firmware 1.8.0: JPEG (community-confirmed)
- EOS R100 firmware 1.0.0: JPEG/CR3, preliminary

Useful new samples include another Canon R-series model, a new firmware,
ordinary consecutive R7 JPEG files, R10 1.7.0 JPEG, a panorama composite, or a
verified counter above 65535.

Unknown firmware is no longer blocked when the known binary layout matches;
the CLI returns the result with status `unverified`. Samples are still useful
to promote that exact firmware/format combination to verified status.

For R100, natural evidence from a camera whose card was already formatted or
whose file numbering was already reset is useful. Please do not reset or format
anything solely for this project.

### What to include

- exact camera model and firmware;
- 3-5 original files in shooting order;
- original camera filenames;
- at least two directly consecutive frames;
- one electronic/EFCS/mechanical transition when available;
- whether any intermediate frames were deleted;
- known card formatting or file-number reset history;
- a trusted camera counter reading, if available.

Do not edit, resize or convert the files. Small in-camera JPEG files are ideal
when they preserve the original metadata.

### Privacy

Camera files may contain serial numbers, GPS data and other EXIF metadata. Use
test pictures of a wall or desk and share only files you are comfortable making
public.

If the files are too large for GitHub, provide a temporary cloud link. If you
need a private channel, open the issue first without the files and arrange one.

### Verification method

CameraInfo blocks are compared across the sequence. Candidate fields must
follow every known frame gap, survive deleted files and, where possible, remain
independent of filename resets. A result is not enabled in the CLI until its
model, firmware, file format and metadata layout are sufficiently constrained.

---

<a id="русский"></a>
## Русский

В GitHub нет личных сообщений. Используйте публичный issue:

**[Открыть запрос на проверку модели](../../issues/new?template=model-test.yml)**

### Сейчас поддерживаются

- EOS R7, прошивка 1.8.0: CR3
- EOS R7 JPEG с совпадающей раскладкой: принимается как unverified; в composite-файле счётчика может не быть
- EOS R10, прошивка 1.5.0: CR3/JPEG
- EOS R10, прошивка 1.7.0: CR3
- EOS R10, прошивка 1.8.0: JPEG (подтверждено пользователем)
- EOS R100, прошивка 1.0.0: JPEG/CR3, предварительно

Полезны файлы с другой Canon R-серии, новой прошивкой, обычные соседние JPEG с
R7, JPEG с R10 1.7.0, составная панорама или подтверждённый счётчик выше 65535.

Неизвестная прошивка больше не блокируется при совпадении знакомой бинарной
раскладки; CLI возвращает результат со статусом `unverified`. Образцы всё равно
полезны, чтобы перевести точную пару прошивка/формат в проверенный статус.

Для R100 полезны естественно появившиеся файлы с камеры, на которой карта уже
форматировалась или нумерация уже сбрасывалась. Не сбрасывайте и не форматируйте
ничего специально ради проекта.

### Что приложить

- точную модель и прошивку;
- 3-5 оригинальных файлов в порядке съёмки;
- исходные имена файлов с камеры;
- минимум два непосредственно соседних кадра;
- переход electronic/EFCS/mechanical, если доступен;
- информацию об удалённых промежуточных кадрах;
- известную историю форматирования карты или сброса нумерации;
- достоверное показание счётчика с камеры, если оно есть.

Не редактируйте, не уменьшайте и не конвертируйте файлы. Небольшие JPEG прямо
с камеры подходят отлично, если исходные метаданные сохранены.

### Приватность

Файлы могут содержать серийный номер, GPS и другие EXIF-данные. Снимайте стену
или стол и публикуйте только те файлы, которые готовы сделать общедоступными.

Если файлы слишком большие для GitHub, дайте временную ссылку на облако. Если
нужен приватный канал, сначала откройте issue без файлов и договоритесь о нём.

### Метод проверки

Блоки CameraInfo сравниваются по всей последовательности. Поле-кандидат должно
следовать всем известным пропускам кадров, учитывать удалённые файлы и, по
возможности, не зависеть от сброса имён. Результат включается в CLI только после
достаточной проверки модели, прошивки, формата и раскладки метаданных.
