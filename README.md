# Canon EOS R10 Shutter Count (offline)

[English](#english) | [Русский](#русский)

---

<a id="english"></a>
## English

Read the total frame/shutter counter from a Canon EOS R10 **CR3 or JPEG**
file. The camera does not need to be connected.

> **Narrow tool.** It is tested only on the **EOS R10, firmware 1.5.0**.
> Do not trust the output for other camera models without verifying the
> field yourself.

### What it reads

The R10 stores a 16-bit little-endian lifetime frame counter inside the
`CanonCameraInfo` metadata block at byte offset **`0x0c93`**.

The value:

- increases by **1 for every frame**;
- increases for **electronic-shutter** frames too;
- still counts frames that were later deleted;
- is independent of file numbering;
- is a **total** counter, not a mechanical-only counter.

Current ExifTool versions do not have a tag table for this R10 block, so
the tool asks ExifTool where the block is and reads the field directly.

### Requirements

- Python 3.8+
- [ExifTool](https://exiftool.org/) available as `exiftool` in `PATH`

The Python script itself uses only the standard library. It does not use
the camera, USB, gphoto2 or libgphoto2.

#### Install ExifTool

Debian/Ubuntu:

```bash
sudo apt install libimage-exiftool-perl
```

macOS (Homebrew):

```bash
brew install exiftool
```

Windows: install ExifTool and make sure `exiftool.exe` is in `PATH`, or
pass its path with `--exiftool`.

### Usage

```bash
python3 read_shutter_cr3.py IMG_7641.CR3
```

Output:

```text
IMG_7641: 19140
```

Several files:

```bash
python3 read_shutter_cr3.py *.CR3 *.JPG
```

JSON:

```bash
python3 read_shutter_cr3.py --json IMG_7641.CR3
```

```json
[
  {
    "file": "IMG_7641.CR3",
    "file_number": 7641,
    "shutter_count": 19140
  }
]
```

Custom ExifTool path:

```bash
python3 read_shutter_cr3.py \
  --exiftool /opt/exiftool/exiftool \
  IMG_7641.CR3
```

### How it works

ExifTool finds the R10 metadata block and reports its size and absolute
offset in verbose mode:

```text
| | | | 2)  CanonCameraInfoUnknown (SubDirectory) -->
| | | |     - Tag 0x000d (4608 bytes, undef[4608]):
| | | |      1dcdd28: bb cc 00 00 ...
```

The script:

1. runs `exiftool -lang en -v3 FILE`;
2. finds the `CanonCameraInfoUnknown` subdirectory;
3. reads the block size and file offset from the next two lines;
4. loads the 4608-byte block;
5. reads a `u16` little-endian value at `0x0c93`.

Example bytes inside the block:

```text
0x0c90: 00 00 00 c4 4a 00 00 00
                ^^ ^^
                |  |
                |  +-- 0x0c94
                +----- 0x0c93
```

`c4 4a` little-endian = `0x4ac4` = **19140**.

See [docs/FORMAT.md](docs/FORMAT.md) for the full format notes, manual
extraction commands and the verification data.

### Evidence

The field was checked on consecutive frames: it advanced by exactly one
per frame, including after deleting frames and after switching from
mechanical to electronic shutter.

| File | Count |
|---|---:|
| `IMG_6744.CR3` | 18249 |
| `IMG_7019.CR3` | 18496 |
| `IMG_7641.CR3` | 19140 |
| `IMG_7667.CR3` | 19161 |
| `IMG_7668.CR3` (mechanical) | 19163 |
| `IMG_7669.CR3` (electronic) | 19164 |

A controlled capture also advanced the counter by exactly **+1**.

### Other Canon R-series models

The offset is **model-specific**. This tool is only for the R10.

| Model | File-based count | Notes |
|---|---|---|
| EOS R5, R6 | yes | ExifTool `CameraInfoR6`, offset `0x0af1` |
| EOS R6 Mark II, R8, R50 | yes | ExifTool `CameraInfoR6m2`, offset `0x0d29` |
| EOS R10 | yes | this tool, offset `0x0c93` |
| EOS R6 Mark III | partial | ExifTool exposes `ImageCount`, not a lifetime shutter count |
| EOS R7, R100 | unknown | not verified |
| EOS R3, R5 Mark II, R1 | unknown | no known table at the time of writing |

For an unknown model, verify the field on at least two consecutive
frames, preferably one mechanical and one electronic exposure, before
trusting it.

### Limitations

- **R10 firmware 1.5.0 only.** A firmware update may change the layout.
- The field is 16-bit. Behaviour after 65535 is not verified.
- The value is the count **at the moment the frame was taken**. To get
  the current count, read the newest file or take a new frame.
- It is a total frame count. A separate mechanical-only count was not
  found in the file.
- Only original, unmodified CR3/JPEG files from the camera are supported.
  Converted images may not contain the block.
- Video files are not used by this tool.
- The script depends on ExifTool's verbose output format.

### Tests

```bash
python3 -m unittest discover -s tests -v
```

The tests cover the field offset, little-endian decoding, file-number
parsing, and block extraction from ExifTool-style verbose output.

### Privacy

Everything runs locally. The script reads files and prints the result; it
does not upload anything.

### License

MIT. See [LICENSE](LICENSE).

Not affiliated with Canon.

---

<a id="русский"></a>
## Русский

Читает общий счётчик кадров/затвора из файла Canon EOS R10 **CR3 или
JPEG**. Камеру подключать не нужно.

> **Узкий инструмент.** Проверен только на **EOS R10, прошивка 1.5.0**.
> Не доверяйте результату для других моделей без самостоятельной
> проверки поля.

### Что читается

R10 хранит 16-битный little-endian счётчик кадров за всё время в блоке
метаданных `CanonCameraInfo` по смещению **`0x0c93`**.

Значение:

- увеличивается на **1 за каждый кадр**;
- увеличивается и для кадров с **электронным затвором**;
- учитывает кадры, удалённые позже;
- не зависит от нумерации файлов;
- это **общий** счётчик, а не только механический.

Текущие версии ExifTool не имеют таблицы тегов для этого блока R10,
поэтому инструмент спрашивает у ExifTool, где находится блок, и читает
поле напрямую.

### Требования

- Python 3.8+
- [ExifTool](https://exiftool.org/), доступный как `exiftool` в `PATH`

Сам скрипт использует только стандартную библиотеку Python. Камера,
USB, gphoto2 и libgphoto2 не нужны.

#### Установка ExifTool

Debian/Ubuntu:

```bash
sudo apt install libimage-exiftool-perl
```

macOS (Homebrew):

```bash
brew install exiftool
```

Windows: установите ExifTool и добавьте `exiftool.exe` в `PATH` либо
укажите путь через `--exiftool`.

### Использование

```bash
python3 read_shutter_cr3.py IMG_7641.CR3
```

Вывод:

```text
IMG_7641: 19140
```

Несколько файлов:

```bash
python3 read_shutter_cr3.py *.CR3 *.JPG
```

JSON:

```bash
python3 read_shutter_cr3.py --json IMG_7641.CR3
```

```json
[
  {
    "file": "IMG_7641.CR3",
    "file_number": 7641,
    "shutter_count": 19140
  }
]
```

Свой путь к ExifTool:

```bash
python3 read_shutter_cr3.py \
  --exiftool /opt/exiftool/exiftool \
  IMG_7641.CR3
```

### Как это работает

ExifTool находит блок метаданных R10 и в подробном режиме сообщает его
размер и абсолютное смещение в файле:

```text
| | | | 2)  CanonCameraInfoUnknown (SubDirectory) -->
| | | |     - Tag 0x000d (4608 bytes, undef[4608]):
| | | |      1dcdd28: bb cc 00 00 ...
```

Скрипт:

1. запускает `exiftool -lang en -v3 FILE`;
2. находит подкаталог `CanonCameraInfoUnknown`;
3. берёт размер блока и смещение из следующих двух строк;
4. читает блок размером 4608 байт;
5. читает `u16` little-endian по смещению `0x0c93`.

Пример байтов внутри блока:

```text
0x0c90: 00 00 00 c4 4a 00 00 00
                ^^ ^^
                |  |
                |  +-- 0x0c94
                +----- 0x0c93
```

`c4 4a` little-endian = `0x4ac4` = **19140**.

Подробные заметки о формате, команды ручного извлечения и данные
проверки: [docs/FORMAT.md](docs/FORMAT.md) (на английском).

### Доказательства

Поле проверено на соседних кадрах: оно увеличивалось ровно на единицу
за кадр, в том числе после удаления кадров и после переключения с
механического затвора на электронный.

| Файл | Значение |
|---|---:|
| `IMG_6744.CR3` | 18249 |
| `IMG_7019.CR3` | 18496 |
| `IMG_7641.CR3` | 19140 |
| `IMG_7667.CR3` | 19161 |
| `IMG_7668.CR3` (механический) | 19163 |
| `IMG_7669.CR3` (электронный) | 19164 |

Контрольный кадр также увеличил счётчик ровно на **+1**.

### Другие камеры Canon R-серии

Смещение **зависит от модели**. Этот инструмент предназначен только
для R10.

| Модель | Счётчик в файле | Примечания |
|---|---|---|
| EOS R5, R6 | да | ExifTool `CameraInfoR6`, смещение `0x0af1` |
| EOS R6 Mark II, R8, R50 | да | ExifTool `CameraInfoR6m2`, смещение `0x0d29` |
| EOS R10 | да | этот инструмент, смещение `0x0c93` |
| EOS R6 Mark III | частично | ExifTool показывает `ImageCount`, а не счётчик затвора за всё время |
| EOS R7, R100 | неизвестно | не проверено |
| EOS R3, R5 Mark II, R1 | неизвестно | известной таблицы на момент написания нет |

Для неизвестной модели проверяйте поле как минимум на двух соседних
кадрах, желательно один механический и один электронный, прежде чем
доверять результату.

### Ограничения

- **Только R10, прошивка 1.5.0.** Обновление прошивки может изменить
  раскладку.
- Поле 16-битное. Поведение после 65535 не проверено.
- Значение — счётчик **на момент съёмки кадра**. Чтобы узнать текущее
  значение, читайте самый свежий файл или снимайте новый кадр.
- Это общий счётчик кадров. Отдельный счётчик только механических
  срабатываний в файле не найден.
- Поддерживаются только оригинальные, неизменённые CR3/JPEG с камеры.
  В конвертированных изображениях блока может не быть.
- Видеофайлы этим инструментом не используются.
- Скрипт зависит от формата подробного вывода ExifTool.

### Тесты

```bash
python3 -m unittest discover -s tests -v
```

Тесты проверяют смещение поля, little-endian-декодирование, разбор
номера файла и извлечение блока из подробного вывода ExifTool.

### Приватность

Всё работает локально. Скрипт читает файлы и печатает результат, ничего
никуда не отправляя.

### Лицензия

MIT. См. [LICENSE](LICENSE).

Не связан с Canon.
