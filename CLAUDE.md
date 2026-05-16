# mdnotebook — CLAUDE.md

Этот файл читается автоматически при каждом запуске Claude Code.

**mdnotebook** — персональный Markdown-блокнот, аналог iOS-приложения [Minimal](https://minimal.app).
Web App (React), запускается на Mac, доступен с iPhone по `http://[IP-Mac]:5173`.

---

## Документация проекта

| Файл | Содержание |
|------|-----------|
| [docs/PLAN.md](docs/PLAN.md) | План реализации по фазам, MVP-чеклист, порядок работ |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Стек, структура файлов, API backend, источники данных |
| [docs/DESIGN.md](docs/DESIGN.md) | Дизайн-принципы, шрифты, цвета, layout, mobile |

---

## Быстрый старт

```bash
cd /Users/name/Yandex.Disk.localized/mdnotebook
npm install          # первый раз
npm run dev          # сервер (3001) + Vite (5173)

# Показывать весь Yandex Disk:
NOTES_DIR=/Users/name/Yandex.Disk.localized npm run dev
```

Открыть на iPhone: System Settings → Wi-Fi → Details → IP, затем `http://[IP]:5173` в Safari.

---

## Ключевые факты

- **Backend:** Express.js, порт `3001`, читает `.md` файлы из `NOTES_DIR`
- **Frontend:** React 18 + Vite, порт `5173`, `/api` проксируется на `3001`
- **Заметки лежат в:** `/Users/name/Yandex.Disk.localized/` (корень файловой системы заметок)
- **Безопасность:** все пути проверяются через `path.resolve` + `startsWith(NOTES_DIR)`

## Стек (кратко)

React 18 + Vite + TypeScript · Tailwind CSS v3 + @tailwindcss/typography · react-markdown + remark-gfm + rehype-highlight · Express.js (tsx) · Шрифты: Inter / Lora / JetBrains Mono
