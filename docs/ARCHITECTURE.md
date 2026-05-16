# Архитектура mdnotebook

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Стили | Tailwind CSS v3 + @tailwindcss/typography |
| Markdown рендеринг | react-markdown + remark-gfm + rehype-highlight |
| Backend | Express.js (Node, TypeScript, tsx) — порт **3001** |
| Vite dev server | порт **5173**, proxy `/api` → `localhost:3001` |
| Шрифты | Inter (UI), Lora (контент), JetBrains Mono (код) — Google Fonts |

---

## Структура файлов

```
mdnotebook/
├── server.ts          # Express API — чтение/запись .md файлов
├── src/
│   ├── main.tsx       # React entry point
│   ├── App.tsx        # Главный компонент (состояние приложения)
│   ├── api.ts         # Функции для обращения к Express API
│   ├── index.css      # Глобальные стили + Tailwind
│   └── components/
│       ├── Sidebar.tsx   # Дерево файлов/папок (слева)
│       ├── Editor.tsx    # Редактор (textarea)
│       └── Preview.tsx   # Рендеринг Markdown
├── docs/
│   ├── PLAN.md        # План реализации по фазам
│   ├── ARCHITECTURE.md
│   └── DESIGN.md      # Дизайн-принципы
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── tsconfig.json
```

---

## API Backend (`server.ts`)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/files` | Дерево .md файлов из `NOTES_DIR` (рекурсивно) |
| GET | `/api/file?path=...` | Содержимое файла |
| POST | `/api/file?path=...` | Сохранить содержимое файла |
| POST | `/api/file/create` | Создать новый .md файл |
| DELETE | `/api/file?path=...` | Удалить файл |
| PATCH | `/api/file/rename` | Переименовать файл (`body: { oldPath, newPath }`) |

Безопасность: все пути проверяются через `path.resolve` и `startsWith(NOTES_DIR)`.

---

## Источники данных

| Что | Где лежит |
|-----|-----------|
| Заметки пользователя (.md файлы) | `/Users/name/Yandex.Disk.localized/` и подпапки — **корень файловой системы заметок** |
| Рабочая директория проекта | `/Users/name/Yandex.Disk.localized/mdnotebook/` |
| Память проекта (Claude) | `~/.claude/projects/-Users-name-Yandex-Disk-localized-mdnotebook/memory/` |

Backend читает файлы из директории `NOTES_DIR` (env var).
По умолчанию = папка запуска. Чтобы показывать весь Yandex Disk:

```bash
NOTES_DIR=/Users/name/Yandex.Disk.localized npm run dev
```
