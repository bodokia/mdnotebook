# Дизайн-принципы mdnotebook

Вдохновение — [Minimal app](https://minimal.app) для iOS.

## Принципы

- **Минимализм** — никаких лишних элементов интерфейса
- **Типографика** — приоритет читаемости, красивые шрифты
- **Темы** — тёмная и светлая, автодетект из системы
- **Mobile-first** — на телефоне sidebar — выдвижная панель
- **Шрифты** — Lora (serif) для контента заметок, Inter (sans) для UI

## Шрифты

| Контекст | Шрифт |
|----------|-------|
| UI-элементы, заголовки панелей | Inter (sans-serif) |
| Текст заметок, Preview | Lora (serif) |
| Код в редакторе и preview | JetBrains Mono (monospace) |

Все шрифты загружаются через Google Fonts.

## Цветовые переменные (CSS)

```css
/* Light (:root) и Dark (.dark) */
--bg           /* фон приложения */
--surface      /* фон карточек, sidebar */
--border       /* разделители */
--text         /* основной текст */
--text-muted   /* вторичный текст */
--accent       /* активные элементы, ссылки */
```

## Layout

**Desktop:** sidebar (260px фиксированная) | divider | main area

**Mobile:** main area fullscreen, sidebar — drawer поверх (`fixed inset-0 z-50`) с overlay

**View modes:**
- `split` — редактор слева + preview справа (только desktop)
- `editor` — только редактор
- `preview` — только preview

## Mobile-специфика

- Touch targets: минимум 44×44px
- Safe areas: `env(safe-area-inset-*)` для iOS notch/home indicator
- Sidebar: закрывается тапом вне панели или свайпом
- View mode: только editor / preview (split не нужен на маленьком экране)
