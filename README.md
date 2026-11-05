# 📚 BookShelf — Personal Book Reader

A privacy-first book reader web app deployed on **Cloudflare Pages**.  
Supports **PDF, EPUB, TXT, Markdown, and HTML** — all rendered 100% in your browser.  
No files are ever uploaded to any server.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- A Cloudflare account (free tier works)

### Local Development
```bash
npm install
npm run dev
# → Open http://localhost:5173
```

### Production Build
```bash
npm run build
# → Output in ./dist/
```

### Deploy to Cloudflare Pages

#### Option A: Wrangler CLI
```bash
# Login to Cloudflare
npx wrangler login

# Deploy
npm run deploy
```

#### Option B: GitHub Actions (Automatic)
1. Push this repo to GitHub
2. Go to Cloudflare Dashboard → Pages → Connect to GitHub
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Add secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`

---

## 📖 Features

| Feature | Detail |
|---------|--------|
| **PDF viewer** | Full PDF.js rendering with page navigation & zoom |
| **EPUB reader** | epub.js with TOC, paginated layout |
| **TXT / MD** | Markdown rendering with marked.js |
| **HTML** | Sandboxed HTML rendering |
| **Dark / Sepia / Light** | Reader-friendly themes |
| **Font & line height** | Adjustable reading preferences |
| **Library** | Grid/list view, sort, filter by format |
| **Progress tracking** | Auto-saved per book (IndexedDB) |
| **Drag & Drop** | Drop multiple books at once |
| **Fully offline** | Works without internet after first load |
| **Privacy** | Zero uploads — files never leave your device |

---

## 🏗️ Tech Stack

- **React 18** + TypeScript + Vite
- **Tailwind CSS** — dark-first design
- **PDF.js** — Mozilla's PDF renderer
- **epub.js** — EPUB reader engine
- **marked.js** — Markdown parser
- **Zustand** — state management
- **IndexedDB** — local persistence
- **Cloudflare Pages** — hosting on workers.dev

---

## 📁 Project Structure

```
src/
├── components/
│   ├── Library/        # Book grid, cards, drop zone
│   ├── Viewer/         # Reader shell with toolbar
│   ├── renderers/      # PDF, EPUB, TXT renderers
│   └── UI/             # Navbar, settings panel
├── store/              # Zustand state slices
├── utils/              # File format detection
└── App.tsx             # Router + layout
```

---

## 🔐 Privacy

This app uses the **browser File API** to read files directly from your device.  
Files are stored in memory during the session and **never sent to any server**.  
Book metadata and reading progress are saved to **IndexedDB** (local only).

