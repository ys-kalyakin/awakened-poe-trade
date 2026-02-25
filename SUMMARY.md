# Обновление геймпад-price-check - Резюме

## Что было изменено

### 1. Добавлена функция копирования предмета через hotkeys

**Файл:** `main/src/main.ts`

Добавлена функция `pressKeysToCopyItemText()`:

```typescript
async function pressKeysToCopyItemText (): Promise<void> {
  const showModsKey = gameConfig.showModsKeyNullable || "Alt";
  const modifierKeys = mergeTwoHotkeys("Ctrl + C", showModsKey).split(" + ");
  const keys = modifierKeys.filter((key: string) => key !== "C");

  // Нажимает модификаторы (Ctrl+C + showModsKey)
  for (const key of keys) {
    uIOhook.keyToggle(Key[key as keyof typeof Key], "down");
  }

  // Нажимает C для копирования предмета
  uIOhook.keyTap(Key.C);

  // Отпускает клавиши
  keys.reverse();
  for (const key of keys) {
    uIOhook.keyToggle(Key[key as keyof typeof Key], "up");
  }
}
```

### 2. Обновлен price-check action

**Было:**
- Просто открывал виджет
- Ждал 100ms
- Читал пустой буфер обмена

**Стало:**
- Копирует предмет через hotkeys
- Ждет 100ms для открытия виджета
- Ждет 200ms для копирования предмета в буфер обмена
- Считывает предмет из буфера обмена
- Отправляет предмет в price-check виджет

### 3. Обновлен copy-item action

Теперь copy-item также копирует предмет через hotkeys перед чтением буфера обмена.

## Как это работает

```
L3 + R3 (геймпад)
    ↓
GamepadManager: Распознаёт комбинацию
    ↓
Main process:
    1. Открывает price-check виджет (widget-action)
    2. Копирует предмет (pressKeysToCopyItemText)
       - Ctrl+C + showModsKey → C
    3. Ждет 200ms, пока предмет скопируется в буфер
    4. Читает предмет из буфера обмена
    5. Отправляет item-text в price-check виджет
    ↓
PriceCheckWindow: Парсит предмет через parseClipboard()
    ↓
Предмет оценивается
```

## Конфигурация

**Show Mods Key** (по умолчанию: `Alt`)

В настройках Awakened PoE Trade:
- Откройте настройки
- Найдите "Show Mods Key"
- Установите клавишу, которая работает в POE для копирования предмета с модами

**Примеры:**
- `Alt` - по умолчанию
- `Shift` - альтернатива
- Любая другая клавиша, настроенная в POE

## Логирование

При нажатии L3+R3 вы увидите в консоли:

```
[Gamepad] Action received: {"type":"price-check","focusOverlay":true}
[Gamepad] Price-check action triggered
[Gamepad] Sending widget-action for price-check
[Gamepad] Copying item, hotkeys: Ctrl + C + Alt
[Gamepad] Pressing: Ctrl
[Gamepad] Pressing: C
[Gamepad] Pressing: Alt
[Gamepad] Pressing C to copy
[Gamepad] Releasing: C
[Gamepad] Releasing: Ctrl
[Gamepad] Releasing: Alt
[Gamepad] Item copy keys pressed
[Gamepad] Item copied, waiting 200ms for clipboard
[Gamepad] Got clipboard text: Item Class: Rare Sword
[Gamepad] Sending item-text
```

## Локализация

Файл документации: `gamepad-price-check-fix.md`

## Устранение проблем

### Если предмет не копируется:

1. Проверьте, что настроенный hotkey (`showModsKey`) работает в POE
2. Нажмите hotkey вручную в POE
3. Перезапустите Awakened PoE Trade
4. Проверьте логи в консоли

### Если предмет оценивается как неизвестный:

1. Проверьте, что текст предмета в логах выглядит правильно
2. Скопируйте предмет вручную через hotkey
3. Проверьте, что настройки showModsKey правильные

### Если комбинация не работает:

1. Проверьте логи GamepadManager
2. Убедитесь, что виден лог `[Gamepad] Combo triggered: L3+R3`
3. Проверьте маппинг кнопок в GamepadManager

## Структура проекта

```
main/
  src/
    main.ts - Основная логика gamepad actions
    shortcuts/
      Shortcuts.ts - Использует uIOhook для копирования предмета
    host-files/
      GameConfig.ts - Содержит showModsKey
    ipc/
      KeyToCode.ts - Функции для работы с хоткеями
```

## Важно помнить

1. **Hotkey должен работать в POE** - showModsKey должен копировать предмет с модами
2. **Delay 200ms** - это время, необходимое предмету, чтобы скопироваться в буфер обмена
3. **Мониторинг буфера обмена** - используется HostClipboard для надежного чтения предмета
4. **Steam Input** - если используете Steam Input, настроенный hotkey должен соответствовать showModsKey

## Тестирование

### Тест 1: Базовое копирование

1. Откройте Awakened PoE Trade
2. Откройте консоль (F12)
3. Нажмите L3+R3 на геймпаде
4. Проверьте логи

### Тест 2: Проверка предмета

1. В POE выберите предмет
2. Нажмите L3+R3
3. Убедитесь, что price-check виджет открывается
4. Убедитесь, что предмет оценивается
5. Проверьте, что в логах есть `[Gamepad] Got clipboard text:` с текстом предмета

### Тест 3: Проверка hotkey

1. В POE нажмите Ctrl+C + Alt (или ваш showModsKey)
2. Убедитесь, что предмет скопирован
3. Проверьте логи, чтобы увидеть `[Gamepad] Got clipboard text:`

## Следующие шаги

Могут быть полезны дополнительные улучшения:
- Настройка delay в конфигурации
- Повторные попытки при ошибке копирования
- Настройка задержки для разных типов предметов
- Мониторинг состояния копирования предмета

Но текущее решение уже должно работать! 🎮
