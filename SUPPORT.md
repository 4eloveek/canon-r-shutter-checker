# Support / Testing another camera model

[English](#english) | [Русский](#русский)

---

<a id="english"></a>
## English

GitHub does not provide private messages. The preferred way to get in
touch is a public issue:

**[Open a Model test request](../../issues/new?template=model-test.yml)**

Use it if you have a Canon model whose shutter counter is not verified
yet, for example **EOS R7** or **EOS R100**. You do not need to modify
the tool or write code.

### What to include

- camera model and firmware version;
- **3–5 original files** from the camera, preferably CR3, JPEG is also OK;
- at least two consecutive frames, both kept;
- if possible, one mechanical and one electronic shutter frame;
- the order of the frames and which shutter mode was used;
- a note if the card was formatted or the file numbering was reset.

Do not edit, resize or convert the files. The tool needs the original
metadata block.

### Privacy

Camera files contain EXIF metadata, including the camera serial number
and possibly GPS or personal information. Only share files you are
comfortable making public.

If you do not want to attach files to a public issue, share a temporary
cloud link instead, or open the issue first and agree on a private
channel. Do not upload personal photos; test frames of a wall or desk are
enough.

Large CR3 files may exceed GitHub's attachment limit. In that case use a
temporary download link.

### What happens next

The files are compared offline: the CameraInfo block is extracted, fields
that change between consecutive frames are located, and the candidate
counter is checked for a stable +1 per frame. If the layout is confirmed,
the model is added to the documentation and, when possible, to the tool.

There is no guarantee that every model stores the counter in a file.
Some Canon models only expose it over USB. In that case the result will
be documented as "not available from files".

---

<a id="русский"></a>
## Русский

В GitHub нет личных сообщений. Предпочтительный способ связи — публичный
issue:

**[Открыть запрос на тестирование модели](../../issues/new?template=model-test.yml)**

Используйте его, если у вас есть Canon, для которого счётчик ещё не
проверен, например **EOS R7** или **EOS R100**. Менять инструмент или
писать код не нужно.

### Что приложить

- модель камеры и версию прошивки;
- **3–5 оригинальных файлов** с камеры, лучше CR3, JPEG тоже подойдёт;
- минимум два соседних кадра, оба сохранены;
- если возможно — один кадр механическим затвором и один электронным;
- порядок кадров и каким затвором они сняты;
- примечание, если карта форматировалась или нумерация файлов сбрасывалась.

Не редактируйте, не уменьшайте и не конвертируйте файлы. Инструменту
нужен оригинальный блок метаданных.

### Приватность

В файлах есть EXIF, включая серийный номер камеры, а иногда GPS и другие
личные данные. Публикуйте только те файлы, которые готовы сделать
публичными.

Если не хотите прикреплять файлы к публичному issue, дайте временную
ссылку на облако или сначала откройте issue и договоритесь о приватном
канале. Не загружайте личные фотографии: достаточно тестовых кадров
стены или стола.

Большие CR3 могут не пройти по лимиту вложений GitHub. В этом случае
используйте временную ссылку.

### Что будет дальше

Файлы сравниваются офлайн: извлекается блок CameraInfo, ищутся поля,
которые меняются между соседними кадрами, и проверяется, что кандидат
даёт стабильный +1 за кадр. Если раскладка подтвердится, модель будет
добавлена в документацию и, по возможности, в инструмент.

Гарантии, что любая модель хранит счётчик в файле, нет. Некоторые Canon
отдают его только по USB. В таком случае результат будет зафиксирован
как «из файлов недоступно».
