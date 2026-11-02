# Canon EOS R7 / R10 / R100 Shutter Counter (offline)

[English](#english) | [Русский](#русский)

---

<a id="english"></a>
## English

Read the total frame/shutter counter from original Canon camera files without
connecting the camera. The tool uses ExifTool only to locate Canon's CameraInfo
metadata block, then validates and reads the model-specific field directly.

### Supported models and evidence

| Camera | Firmware | Verified files | Counter field | Status |
|---|---|---|---|---|
| EOS R7 | 1.8.0 | CR3 | `bb cc` block + `0x0c93` | verified |
| EOS R7 | 1.6.0 | JPEG | `bb cc` block + `0x0c93` | unverified; composite sentinel observed |
| EOS R10 | 1.5.0 | CR3, JPEG | `bb cc` block + `0x0c93` | verified |
| EOS R10 | 1.7.0 | CR3 | `bb cc` block + `0x0c93` | verified |
| EOS R10 | 1.8.0 | JPEG | `bb cc` block + `0x0c93` | verified (community report) |
| EOS R100 | 1.0.0 | JPEG, CR3 | `bb bb` block + `0x0acf` | preliminary |

The table lists combinations tested on real files. Firmware versions outside
the table are **not blocked**. If a supported model/file type still has the
verified block size and prefix, the counter is returned with status
`unverified`. A changed layout is rejected instead of reading a wrong offset.

Result statuses:

- `verified`: this exact model/firmware/file-type combination was tested;
- `preliminary`: R100 1.0.0 JPEG behavior is strongly supported, but lifetime
  persistence across formatting/resets is still unknown;
- `unverified`: the model and binary layout match, but this firmware or exact
  format combination has not been tested on real files.

R100 support is marked **preliminary**. Its candidate counts electronic and
EFCS exposures, including files deleted later and tethered exposures not stored
on the card. Persistence across card formatting or file-number resets has not
yet been demonstrated.

### What the value means

For the verified R7/R10 layouts, the field:

- advances by **1 for every frame**;
- includes mechanical, electronic first-curtain and fully electronic frames;
- keeps counting frames that are later deleted;
- is independent of filename numbering and numbering resets;
- is a total frame counter, not a mechanical-only shutter count.

The observed field occupies four bytes and is read as little-endian `u32`.
Every available real sample is still below 65536, so the upper two bytes have
not yet been observed with a non-zero value.

### Requirements

- Python 3.8+
- [ExifTool](https://exiftool.org/) available as `exiftool` in `PATH`

The Python code uses only the standard library. It does not require USB,
gphoto2, libgphoto2 or a camera connection.

#### Install ExifTool

Debian/Ubuntu:

```bash
sudo apt install libimage-exiftool-perl
```

macOS (Homebrew):

```bash
brew install exiftool
```

Windows: install ExifTool and add `exiftool.exe` to `PATH`, or pass its path
with `--exiftool`.

### Usage

```bash
python3 canon_r_shutter_count.py IMG_7641.CR3
```

Examples:

```text
_MG_0002 (Canon EOS R7): 18693
IMG_7641 (Canon EOS R10): 19140
IMG_5225 (Canon EOS R100): 5021 [preliminary]
IMG_9000 (Canon EOS R10): 32000 [unverified firmware/format]
```

Several files:

```bash
python3 canon_r_shutter_count.py *.CR3 *.JPG
```

JSON:

```bash
python3 canon_r_shutter_count.py --json IMG_5225.JPG
```

```json
[
  {
    "file": "IMG_5225.JPG",
    "model": "Canon EOS R100",
    "firmware": "1.0.0",
    "format": "JPEG",
    "file_number": 5225,
    "shutter_count": 5021,
    "status": "preliminary"
  }
]
```

Custom ExifTool path:

```bash
python3 canon_r_shutter_count.py \
  --exiftool /opt/exiftool/exiftool \
  IMG_7641.CR3
```

Version:

```bash
python3 canon_r_shutter_count.py -v
# canon_r_shutter_count.py 2.0
```

The former `read_shutter_cr3.py` name remains as a compatibility wrapper for
existing commands, but `canon_r_shutter_count.py` is the primary CLI.

### How it works

ExifTool does **not** provide the counter value used here. It is used as a
container parser that reveals where Canon stored the raw CameraInfo block.

The complete process is:

1. Run `exiftool -lang en -v3 FILE`.
2. Read `Model`, `CanonFirmwareVersion` and the final `FileType`. CR3 may first
   appear internally as `CRX`; the later ExifTool override to `CR3` is used.
3. Select the model layout: R7/R10 use prefix `bb cc` and relative offset
   `0x0c93`; R100 uses prefix `bb bb` and offset `0x0acf`.
4. Find Canon tag `0x000d`, currently printed as
   `CanonCameraInfoUnknown (SubDirectory)`, and parse its size and absolute
   file offset from verbose output.
5. Seek to that absolute offset and read exactly 4608 bytes. The absolute
   position differs in every file; `0x0c93`/`0x0acf` are offsets inside this
   extracted block, not offsets from the beginning of the image.
6. Verify the 4608-byte size and model-specific prefix before reading any
   count. A supported model with an unfamiliar layout is rejected.
7. Read four bytes at the relative counter offset as unsigned little-endian
   (`struct.unpack_from("<I", ...)`). For example, `04 49 00 00` becomes
   `0x00004904` = 18692.
8. Reject known special-mode sentinel values `0`, `65535` and `0xffffffff`.
   They mean that this output file does not carry a usable frame counter.
9. If ExifTool exposes more than one matching CameraInfo block, require all
   copies to contain the same counter. Conflicting values are rejected.
10. Assign `verified`, `preliminary` or `unverified` status from the evidence
   table. Firmware changes the status, not whether a matching layout can be
   read.

The offsets were found by byte-comparing controlled file sequences. A valid
candidate had to follow every known frame gap, increment through shutter-mode
changes, account for deleted files and remain independent of filename resets.
This is why a value that merely resembles `IMG_####` is not accepted as a
lifetime-counter field.

Current ExifTool releases expose these layouts as `CanonCameraInfoUnknown`;
they do not provide public R7/R10/R100 shutter-count tags for these fields.

See [docs/FORMAT.md](docs/FORMAT.md) for detailed layouts, evidence and manual
extraction commands.

### Verification evidence

#### EOS R7

A controlled firmware 1.8.0 sequence continued across a filename reset and
both shutter modes:

| File | Shutter mode | Counter |
|---|---|---:|
| `_MG_1300.CR3` | mechanical | 18691 |
| `_MG_0001.CR3` | mechanical | 18692 |
| `_MG_0002.CR3` | electronic | 18693 |
| `_MG_0003.CR3` | mechanical | 18694 |

The filename reset from 1300 to 0001 while the metadata counter continued by
one. Electronic and mechanical frames incremented the same field.

An in-camera focus-stacking composite JPEG from firmware 1.6.0 retained the
normal 4608-byte `bb cc` block but stored `0` at `0x0c93`. Panorama composites
were also reported with `65535`. These are treated as unavailable sentinels,
not as real shutter counts. Use a nearby ordinary frame for the current value.

#### EOS R10

Consecutive CR3/JPEG files and a controlled capture confirmed `+1` per frame.
Switching from mechanical to electronic shutter also produced `+1`, and deleted
frames remained included. Verified values span multiple sessions and firmwares,
including 1.5.0 and 1.7.0.

Firmware 1.8.0 JPEG support was community-confirmed by
[@kurmudgen](https://github.com/kurmudgen): `IMG_1267` contained 1200 and
`IMG_1277` contained 1210 after ten EFCS frames. Medium Fine in-camera JPEG and
email-as-attachment preserved CameraInfo; a phone-sharing route stripped EXIF
and was correctly rejected.

#### EOS R100

Four original firmware 1.0.0 JPEG files identify a different candidate:

| File | Shutter mode | Counter |
|---|---|---:|
| `IMG_5220.JPG` | electronic | 5016 |
| `IMG_5221.JPG` | electronic | 5017 |
| `IMG_5224.JPG` | electronic first curtain | 5020 |
| `IMG_5225.JPG` | electronic first curtain | 5021 |

The contributor confirmed that `IMG_5222` and `IMG_5223` were taken and then
deleted. They exactly explain missing values 5018 and 5019. A separate public
R100 metadata sample contains 64 at the same offset while nearby file/session
fields contain unrelated values.

A second directly consecutive sequence confirmed both mode transitions:

| File | Shutter mode | Counter |
|---|---|---:|
| `IMG_5234.JPG` | electronic | 5030 |
| `IMG_5235.JPG` | electronic first curtain | 5031 |
| `IMG_5236.JPG` | electronic | 5032 |
| `IMG_5237.JPG` | electronic | 5033 |

From `IMG_5225` to `IMG_5234`, both the filename and counter advanced by 9.
Across all eight supplied files the counter remains 204 below the filename.

A tethered-shooting test then separated the metadata counter from file
numbering directly:

| Saved file | Counter |
|---|---:|
| `IMG_5242.JPG` | 5041 |
| two tethered exposures, not stored on the card | 5042, 5043 |
| `IMG_5243.JPG` | 5044 |

The filename advanced by only 1 while the field advanced by 3. This proves
that `0x0acf` counts captured exposures rather than files written to the SD
card, and provides a plausible explanation for the accumulated 204-frame gap.

Three consecutive original CR3 files confirmed that RAW uses the same block,
prefix and offset as JPEG:

| File | Shutter mode | Counter |
|---|---|---:|
| `IMG_5248.CR3` | electronic first curtain | 5055 |
| `IMG_5249.CR3` | electronic | 5056 |
| `IMG_5250.CR3` | electronic first curtain | 5057 |

`0x0acf` was the only little-endian 32-bit field advancing by +1 across all
three RAW files.

### Limitations

- Only listed camera models and model-supported file types are accepted.
- Firmware is not blocked. Untested firmware/format pairs are accepted only
  when the verified binary layout still matches and are marked `unverified`.
- Matching R7 JPEG layouts are accepted as `unverified`, but in-camera
  composites may contain no usable counter. R10 1.7.0 JPEG remains unverified;
  other unlisted R10 JPEG firmware versions are accepted as `unverified` when
  their layout matches.
- Values `0`, `65535` and `0xffffffff` are rejected as known/defensive
  special-mode sentinels. A genuine counter exactly at one of these values
  cannot be distinguished from a sentinel in the available metadata.
- R100 lifetime persistence across formatting or numbering resets remains
  unverified; its result is visibly marked `preliminary`.
- No real sample above 65535 is available to exercise the upper two bytes.
- The value belongs to the moment the file was captured. Use the newest file
  or take a new frame for the current value.
- Only original, unmodified files from the camera are supported.
- Video files and multi-frame RAW bursts are outside this CLI's scope.
- Parsing depends on ExifTool's verbose output format.

### Tests

```bash
python3 -m unittest discover -s tests -v
```

Tests cover model-specific offsets and layouts, unknown-firmware acceptance,
status assignment, values above 16-bit range, conflicting blocks, ExifTool
failures, special-mode sentinels and rejection of unsupported
models/formats/layouts.

### Privacy

Everything runs locally. The script reads files and prints results; it does
not upload anything.

### Acknowledgements

Special thanks to:

- [@ralvarezz](https://github.com/ralvarezz) for the EOS R7 CR3 sets,
  including the mechanical/electronic sequence and filename-reset test;
- [@ofnuts](https://github.com/ofnuts) for extensive cross-model testing,
  original R100 JPEG/CR3 and R7 composite samples, deleted/tethered-frame and
  special-mode edge cases, and detailed CLI usability feedback;
- [@kurmudgen](https://github.com/kurmudgen) for confirming R10 firmware 1.8.0
  with a ten-frame Medium Fine JPEG sequence.

Their original sample files made independent verification possible.

### License

MIT. See [LICENSE](LICENSE).

Not affiliated with Canon.

---

<a id="русский"></a>
## Русский

Читает общий счётчик кадров/затвора из оригинальных файлов Canon без
подключения камеры. ExifTool используется только для поиска блока метаданных
CameraInfo; затем скрипт проверяет структуру и читает поле конкретной модели.

### Поддерживаемые модели и доказательства

| Камера | Прошивка | Проверенные файлы | Поле счётчика | Статус |
|---|---|---|---|---|
| EOS R7 | 1.8.0 | CR3 | блок `bb cc` + `0x0c93` | проверено |
| EOS R7 | 1.6.0 | JPEG | блок `bb cc` + `0x0c93` | не проверено; найден composite-маркер |
| EOS R10 | 1.5.0 | CR3, JPEG | блок `bb cc` + `0x0c93` | проверено |
| EOS R10 | 1.7.0 | CR3 | блок `bb cc` + `0x0c93` | проверено |
| EOS R10 | 1.8.0 | JPEG | блок `bb cc` + `0x0c93` | проверено (отчёт пользователя) |
| EOS R100 | 1.0.0 | JPEG, CR3 | блок `bb bb` + `0x0acf` | предварительно |

В таблице перечислены сочетания, проверенные на реальных файлах. Другие версии
прошивки **не блокируются**. Если у поддерживаемой модели/формата сохраняются
проверенные размер и префикс блока, скрипт возвращает значение со статусом
`unverified`. Изменившаяся раскладка отклоняется.

Статусы результата:

- `verified`: это точное сочетание модели, прошивки и формата проверено;
- `preliminary`: поведение JPEG с R100 1.0.0 подтверждено, но сохранение за всё
  время после форматирования/сбросов пока неизвестно;
- `unverified`: модель и бинарная раскладка совпали, но эта прошивка или точное
  сочетание формата ещё не проверялись на реальных файлах.

Поддержка R100 отмечена как **предварительная**. Кандидат учитывает электронные
и EFCS-кадры, включая удалённые позже и tethered-кадры, не записанные на карту.
Сохранение значения после форматирования карты или сброса нумерации пока не
доказано.

### Что означает значение

Для проверенных раскладок R7/R10 поле:

- увеличивается на **1 за каждый кадр**;
- учитывает механический, электронную первую шторку и полностью электронный
  затвор;
- сохраняет в счётчике удалённые позже кадры;
- не зависит от нумерации имён файлов и её сброса;
- является общим счётчиком кадров, а не только механическим пробегом.

Наблюдаемое поле занимает четыре байта и читается как little-endian `u32`.
Все реальные образцы пока имеют значения ниже 65536, поэтому старшие два
байта ещё не наблюдались ненулевыми.

### Требования

- Python 3.8+
- [ExifTool](https://exiftool.org/), доступный как `exiftool` в `PATH`

Код Python использует только стандартную библиотеку. USB, gphoto2,
libgphoto2 и подключение камеры не нужны.

#### Установка ExifTool

Debian/Ubuntu:

```bash
sudo apt install libimage-exiftool-perl
```

macOS (Homebrew):

```bash
brew install exiftool
```

Windows: установите ExifTool и добавьте `exiftool.exe` в `PATH` либо передайте
путь через `--exiftool`.

### Использование

```bash
python3 canon_r_shutter_count.py IMG_7641.CR3
```

Примеры:

```text
_MG_0002 (Canon EOS R7): 18693
IMG_7641 (Canon EOS R10): 19140
IMG_5225 (Canon EOS R100): 5021 [preliminary]
IMG_9000 (Canon EOS R10): 32000 [unverified firmware/format]
```

Несколько файлов:

```bash
python3 canon_r_shutter_count.py *.CR3 *.JPG
```

JSON:

```bash
python3 canon_r_shutter_count.py --json IMG_5225.JPG
```

```json
[
  {
    "file": "IMG_5225.JPG",
    "model": "Canon EOS R100",
    "firmware": "1.0.0",
    "format": "JPEG",
    "file_number": 5225,
    "shutter_count": 5021,
    "status": "preliminary"
  }
]
```

Свой путь к ExifTool:

```bash
python3 canon_r_shutter_count.py \
  --exiftool /opt/exiftool/exiftool \
  IMG_7641.CR3
```

Версия:

```bash
python3 canon_r_shutter_count.py -v
# canon_r_shutter_count.py 2.0
```

Старое имя `read_shutter_cr3.py` сохранено как совместимая обёртка для уже
существующих команд, но основным CLI является `canon_r_shutter_count.py`.

### Как это работает

ExifTool **не выдаёт используемое здесь значение счётчика**. Он выступает
парсером контейнера и показывает расположение сырого блока CameraInfo.

Полная последовательность:

1. Запускается `exiftool -lang en -v3 FILE`.
2. Читаются `Model`, `CanonFirmwareVersion` и итоговый `FileType`. CR3 сначала
   может называться внутренним типом `CRX`; используется более позднее
   переопределение ExifTool в `CR3`.
3. Выбирается раскладка модели: R7/R10 используют префикс `bb cc` и смещение
   `0x0c93`, R100 использует `bb bb` и `0x0acf`.
4. Находится Canon-тег `0x000d`, который сейчас отображается как
   `CanonCameraInfoUnknown (SubDirectory)`, и из подробного вывода берутся
   размер и абсолютное смещение в файле.
5. Скрипт переходит по абсолютному смещению и читает ровно 4608 байт. Позиция
   блока в каждом файле разная; `0x0c93`/`0x0acf` отсчитываются внутри блока,
   а не от начала изображения.
6. До чтения значения проверяются размер 4608 байт и префикс модели. Знакомая
   модель с неизвестной раскладкой отклоняется.
7. Четыре байта по относительному смещению читаются как беззнаковое
   little-endian-число (`struct.unpack_from("<I", ...)`). Например,
   `04 49 00 00` = `0x00004904` = 18692.
8. Служебные значения `0`, `65535` и `0xffffffff` отклоняются. Они означают,
   что итоговый файл не содержит пригодного счётчика.
9. Если ExifTool показывает несколько подходящих CameraInfo-блоков, значения
   во всех копиях должны совпадать. Конфликт приводит к ошибке.
10. По таблице доказательств назначается статус `verified`, `preliminary` или
   `unverified`. Прошивка влияет на статус, но не запрещает чтение совпавшей
   раскладки.

Смещения найдены побайтовым сравнением контрольных последовательностей. Поле
должно было повторить все известные пропуски кадров, увеличиваться при смене
режима затвора, учитывать удалённые файлы и не зависеть от сброса имён. Поэтому
значение, которое просто похоже на `IMG_####`, не считается достаточным.

Текущие версии ExifTool показывают эти раскладки как
`CanonCameraInfoUnknown` и не предоставляют публичных тегов счётчика для этих
полей R7/R10/R100.

Подробные раскладки, доказательства и команды ручного извлечения находятся в
[docs/FORMAT.md](docs/FORMAT.md).

### Доказательства

#### EOS R7

Контрольная последовательность на прошивке 1.8.0 продолжилась после сброса
имён файлов и включала оба режима затвора:

| Файл | Режим затвора | Счётчик |
|---|---|---:|
| `_MG_1300.CR3` | механический | 18691 |
| `_MG_0001.CR3` | механический | 18692 |
| `_MG_0002.CR3` | электронный | 18693 |
| `_MG_0003.CR3` | механический | 18694 |

Имя сбросилось с 1300 на 0001, а счётчик продолжился на единицу. Электронные
и механические кадры увеличили одно и то же поле.

Составной JPEG после focus stacking на прошивке 1.6.0 сохранил обычный блок
`bb cc` размером 4608 байт, но записал `0` по `0x0c93`. Для панорам также
сообщалось значение `65535`. Это служебные маркеры отсутствующего счётчика,
а не пробег камеры. Текущее значение следует брать из соседнего обычного кадра.

#### EOS R10

Соседние CR3/JPEG и контрольная съёмка подтвердили +1 за кадр. Переключение
с механического затвора на электронный также дало +1, а удалённые кадры
остались учтены. Проверены разные сессии и прошивки 1.5.0/1.7.0.

JPEG на прошивке 1.8.0 подтверждены пользователем
[@kurmudgen](https://github.com/kurmudgen): `IMG_1267` содержал 1200, а
`IMG_1277` содержал 1210 после десяти EFCS-кадров. Medium Fine JPEG с камеры и
пересылка email-вложением сохранили CameraInfo; отправка через телефон удалила
EXIF и была корректно отклонена.

#### EOS R100

Четыре оригинальных JPEG с прошивки 1.0.0 дали отдельный кандидат:

| Файл | Режим затвора | Счётчик |
|---|---|---:|
| `IMG_5220.JPG` | электронный | 5016 |
| `IMG_5221.JPG` | электронный | 5017 |
| `IMG_5224.JPG` | электронная первая шторка | 5020 |
| `IMG_5225.JPG` | электронная первая шторка | 5021 |

Пользователь подтвердил, что `IMG_5222` и `IMG_5223` были сняты и затем
удалены. Они точно соответствуют отсутствующим значениям 5018 и 5019.
Независимый публичный образец R100 содержит 64 по тому же смещению, тогда как
соседние поля номера файла/сессии имеют другие значения.

Вторая непосредственно последовательная серия подтвердила оба перехода:

| Файл | Режим затвора | Счётчик |
|---|---|---:|
| `IMG_5234.JPG` | электронный | 5030 |
| `IMG_5235.JPG` | электронная первая шторка | 5031 |
| `IMG_5236.JPG` | электронный | 5032 |
| `IMG_5237.JPG` | электронный | 5033 |

От `IMG_5225` до `IMG_5234` и имя, и счётчик выросли на 9. Во всех восьми
полученных файлах счётчик остаётся на 204 меньше номера файла.

Проверка tethered-съёмкой напрямую отделила поле от нумерации файлов:

| Сохранённый файл | Счётчик |
|---|---:|
| `IMG_5242.JPG` | 5041 |
| два tethered-кадра без записи на карту | 5042, 5043 |
| `IMG_5243.JPG` | 5044 |

Имя увеличилось только на 1, а поле на 3. Значит, `0x0acf` считает сделанные
экспозиции, а не файлы на SD-карте. Это также правдоподобно объясняет
накопившуюся разницу в 204 кадра.

Три последовательных оригинальных CR3 подтвердили, что RAW использует тот же
блок, префикс и смещение, что и JPEG:

| Файл | Режим затвора | Счётчик |
|---|---|---:|
| `IMG_5248.CR3` | электронная первая шторка | 5055 |
| `IMG_5249.CR3` | электронный | 5056 |
| `IMG_5250.CR3` | электронная первая шторка | 5057 |

`0x0acf` оказалось единственным 32-битным little-endian-полем, которое росло
на +1 во всех трёх RAW.

### Ограничения

- Принимаются только перечисленные модели и разрешённые для них типы файлов.
- Версия прошивки не блокируется. Непроверенная пара прошивка/формат принимается
  только при совпадении бинарной раскладки и помечается `unverified`.
- JPEG с R7 при совпавшей раскладке принимается как `unverified`, но составные
  файлы камеры могут не содержать пригодного счётчика. JPEG с R10 1.7.0
  остаётся непроверенным; другие неуказанные прошивки R10 JPEG принимаются как
  `unverified`, если раскладка совпала.
- Значения `0`, `65535` и `0xffffffff` отклоняются как известные/защитные
  маркеры специальных режимов. Настоящее значение счётчика, точно совпавшее с
  одним из них, нельзя отличить от маркера по доступным метаданным.
- Для R100 не подтверждено сохранение значения после форматирования или сброса
  нумерации; результат явно помечается как `preliminary`.
- Нет реального образца выше 65535 для проверки старших двух байтов.
- Значение относится к моменту съёмки файла. Для текущего значения используйте
  самый свежий файл или снимите новый кадр.
- Поддерживаются только оригинальные, неизменённые файлы с камеры.
- Видеофайлы и многокадровые RAW burst не входят в область этого CLI.
- Разбор зависит от формата подробного вывода ExifTool.

### Тесты

```bash
python3 -m unittest discover -s tests -v
```

Тесты проверяют модельные смещения и раскладки, принятие неизвестной прошивки,
назначение статусов, значения выше диапазона u16, конфликтующие блоки, ошибки
ExifTool, маркеры специальных режимов и отклонение неподдерживаемых
моделей/форматов/раскладок.

### Приватность

Всё выполняется локально. Скрипт читает файлы и выводит результат, ничего не
загружая в сеть.

### Благодарности

Особая благодарность:

- [@ralvarezz](https://github.com/ralvarezz) за наборы CR3 с EOS R7, включая
  последовательность механического/электронного затвора и проверку сброса имён;
- [@ofnuts](https://github.com/ofnuts) за обширное тестирование разных случаев,
  оригинальные JPEG/CR3 с R100 и composite-файлы R7, проверки удалённых,
  tethered-кадров и специальных режимов, а также подробные предложения по CLI;
- [@kurmudgen](https://github.com/kurmudgen) за подтверждение R10 1.8.0
  последовательностью из десяти Medium Fine JPEG.

Их оригинальные файлы позволили провести независимую проверку.

### Лицензия

MIT. См. [LICENSE](LICENSE).

Не связан с Canon.
