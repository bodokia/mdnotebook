# Дизайн-принципы mdnotebook

→ [ARCHITECTURE.md](ARCHITECTURE.md) · [PLAN.md](PLAN.md)

Вдохновение — [Minimal app](https://minimal.app) для iOS.

---

## Принципы

- **Минимализм** — никаких лишних элементов интерфейса
- **Типографика** — приоритет читаемости, красивые шрифты
- **Темы** — тёмная и светлая, автодетект из системы
- **Mobile-first** — на телефоне sidebar — выдвижная панель
- **Мгновенный отклик** — optimistic UI (удаление с undo, автосохранение)

---

## Шрифты

| Контекст | Шрифт |
|----------|-------|
| UI-элементы, заголовки панелей | Inter (sans-serif) |
| Заголовки экрана входа, имя приложения | Lora (serif) |
| Текст заметок, Preview | Lora (serif) |
| Код в редакторе и preview | JetBrains Mono (monospace) |

Все шрифты загружаются через Google Fonts с системными фолбэками:

```css
font-family: 'Lora', Georgia, serif;
font-family: 'Inter', system-ui, sans-serif;
font-family: 'JetBrains Mono', 'Menlo', monospace;
```

---

## Цветовые переменные (CSS)

```css
/* :root = light, .dark = dark */
--bg           /* фон приложения */
--surface      /* фон карточек, sidebar, toolbar */
--border       /* разделители */
--text         /* основной текст */
--text-muted   /* вторичный текст, иконки */
--accent       /* активные элементы, кнопки, ссылки */
```

Тема сохраняется в `localStorage`. При первом запуске — `prefers-color-scheme`.

---

## Layout

**Desktop:** sidebar (260px фиксированная) | divider | main area

**Mobile:** main area fullscreen, sidebar — drawer поверх (`fixed inset-0 z-50`) с overlay

**View modes:**
- `split` — редактор слева + preview справа (только desktop)
- `editor` — только редактор
- `preview` — только preview

---

## Экран входа (AuthScreen)

- Центрированная карточка, `max-w-sm`, скруглённая (`rounded-xl`)
- Заголовок «mdnotebook» шрифтом Lora
- Поля: email + пароль, минимум 6 символов
- Переключение login ↔ register без перезагрузки
- Ошибки — красная плашка, успех регистрации — зелёная
- Цвета берутся из CSS-переменных (`--bg`, `--surface`, `--accent`)

---

## Toast (undo-удаление)

- Появляется снизу при удалении файла
- Показывает имя файла + кнопку «Отмена» (5 секунд)
- Если нажать «Отмена» — файл восстанавливается (сервер не удаляет)
- Если не нажать — файл удаляется через 5 сек автоматически

---

## Статусы сохранения (toolbar)

| Статус | Отображение |
|--------|-------------|
| `idle` + unsaved | синяя точка `●` рядом с именем файла |
| `saving` | ничего (мгновенно) |
| `saved` | `✓ Сохранено` (2 секунды, затем исчезает) |
| `error` | `⚠ Ошибка сохранения` красным |

---

## Mobile-специфика

- Touch targets: минимум 44×44px для всех кнопок
- Safe areas: `env(safe-area-inset-*)` для iOS notch/home indicator
- Sidebar: закрывается тапом по overlay или кнопкой
- View mode на mobile: только editor / preview (без split)
- Hamburger `☰` в левом верхнем углу, `md:hidden`
