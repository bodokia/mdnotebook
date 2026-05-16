# План реализации mdnotebook

## MVP — статус задач

- [x] Config файлы созданы (package.json, tsconfig, vite, tailwind, postcss, index.html)
- [x] `server.ts` — Express backend
- [x] `src/api.ts` — клиентские функции API
- [x] `src/App.tsx` — главный компонент
- [x] `src/components/Sidebar.tsx` — файловое дерево
- [x] `src/components/Editor.tsx` — редактор
- [x] `src/components/Preview.tsx` — рендеринг Markdown
- [x] `src/index.css` — глобальные стили
- [x] `npm install` + проверка запуска

---

## Порядок реализации

```
1. server.ts           — backend API
2. src/main.tsx        — entry point
3. src/index.css       — CSS variables + Tailwind (light + dark сразу)
4. src/api.ts          — fetch wrappers
5. src/App.tsx         — state + layout skeleton
6. src/components/Sidebar.tsx
7. src/components/Preview.tsx
8. src/components/Editor.tsx
9. npm install + запуск + тест на iPhone
```

---

## Фаза 1 — Backend: `server.ts`

Express сервер, порт 3001. Читает файлы из `NOTES_DIR` (env var, default = папка запуска).

- `GET /api/files` — рекурсивное дерево `.md` файлов из `NOTES_DIR`
  - Возвращает: `{ name, path, type: 'file'|'folder', children? }[]`
- `GET /api/file?path=...` — содержимое файла (строка)
- `POST /api/file?path=...` — сохранить содержимое (`body.content`)
- `POST /api/file/create` — создать новый `.md` файл (`body.path`)
- `DELETE /api/file?path=...` — удалить файл
- `PATCH /api/file/rename` — переименовать файл (`body.oldPath`, `body.newPath`)
- Безопасность: все пути проверять через `path.resolve` и `startsWith(NOTES_DIR)`

---

## Фаза 2 — Frontend Foundation

**`src/main.tsx`** — стандартный React entry, рендерит `<App />` в `#root`.

**`src/index.css`** — Tailwind directives + CSS-переменные для обеих тем сразу:

```css
:root {
  --bg: ...; --surface: ...; --border: ...;
  --text: ...; --text-muted: ...; --accent: ...;
}
.dark {
  --bg: ...; --surface: ...; /* переопределяем здесь же */
}
```

Тема закладывается здесь — не в Фазе 7. Переменные будут готовы для всех компонентов с самого начала.

**Шрифты:** загружаются через Google Fonts (Inter, Lora, JetBrains Mono). Необходим фолбэк на системные шрифты на случай отсутствия интернета — iPhone на локальной сети не гарантирует внешний доступ:

```css
font-family: 'Lora', Georgia, serif;
font-family: 'Inter', system-ui, sans-serif;
font-family: 'JetBrains Mono', 'Menlo', monospace;
```

**`src/api.ts`** — обёртки над fetch:
- `fetchFiles(): Promise<FileNode[]>`
- `fetchFileContent(path): Promise<string>`
- `saveFile(path, content): Promise<void>`
- `createFile(path): Promise<void>`
- `deleteFile(path): Promise<void>`
- `renameFile(oldPath, newPath): Promise<void>`

---

## Фаза 3 — App.tsx (состояние и layout)

**Состояние:**
```ts
fileTree: FileNode[]
selectedPath: string | null
content: string
savedContent: string   // для dirty-check
theme: 'light' | 'dark'
sidebarOpen: boolean   // mobile
viewMode: 'split' | 'editor' | 'preview'
```

**Layout (desktop):** sidebar (260px) | divider | main area (editor + preview)
**Layout (mobile):** main area fullscreen + sidebar как drawer поверх

---

## Фаза 4 — Sidebar.tsx

- Рекурсивный рендер дерева файлов/папок
- Папки: expand/collapse (локальный стейт `Set<path>`)
- Активный файл: выделение фоном
- Кнопка «+ New note» в шапке
- Контекстное меню или inline-кнопки: переименовать / удалить (показываются по hover/long-press)
- **Mobile:** `fixed inset-0 z-50` drawer с overlay, закрывается свайпом/тапом вне

---

## Фаза 5 — Editor.tsx

- `<textarea>` с авто-resize по контенту
- Шрифт: `font-mono` (JetBrains Mono) или `font-serif` (Lora) — переключатель в тулбаре
- **Сохранение:** auto-save с дебаунсом 2 сек — основной механизм. `Cmd/Ctrl+S` = принудительное немедленное сохранение (не отдельная логика, просто flush дебаунса).
- Dirty indicator: точка рядом с именем файла пока auto-save ещё не сработал

---

## Фаза 6 — Preview.tsx

- `react-markdown` + `remark-gfm` + `rehype-highlight`
- Класс `prose` от `@tailwindcss/typography` — базовая типографика
- Кастомизация prose через Tailwind config: Lora для текста, JetBrains Mono для кода
- Syntax highlighting: импортировать только нужные языки из `highlight.js/core` (не весь бандл ~1MB):

```ts
import hljs from 'highlight.js/lib/core'
import markdown from 'highlight.js/lib/languages/markdown'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
hljs.registerLanguage('markdown', markdown)
// и т.д.
```

- Темы: light → `github`, dark → `github-dark`

---

## Фаза 7 — Mobile polish

- Sidebar trigger: `☰` кнопка в левом верхнем углу (только mobile, `md:hidden`)
- Safe areas: `env(safe-area-inset-*)` для iOS notch/home indicator
- Touch targets: min 44×44px для всех интерактивных элементов
- View mode switch на mobile: editor / preview (split не нужен)
- Проверить на iPhone: отступы, шрифты, scroll, автосохранение при потере фокуса (`blur` event)
