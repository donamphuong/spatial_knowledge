# Scholar Vault - Local First Scholar Map

Scholar Vault is a local-first application designed for deep research and spatial thinking. This guide helps you run the application on your local machine and connect it to your local filesystem for native "Obsidian-style" data ownership.

## 🚀 Running Locally

1. **Prerequisites**: Ensure you have [Node.js](https://nodejs.org/) (v18+) and `npm` installed.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
4. **Access the App**: Open your browser and go to `http://localhost:3000`.

## 📂 Native File System Support

Scholar Vault uses the **Web File System Access API** to sync directly with your computer's folders.

### How to use it:
1. Click **"Connect Root Folder"** in the sidebar.
2. Choose a folder on your computer (e.g., `~/Documents/Vaults/MyResearch`).
3. Grant **"Edit" permissions** when prompted by your browser.
4. **Auto-Sync**: Every change you make (creating maps, drawing, extracting PDF snippets) is automatically saved to that folder.

### Folder Structure Created:
- `/maps/*.scholar`: Your research maps and spatial nodes (JSON format).
- `/attachments/*.pdf`: Your uploaded source documents.
- `vault-metadata.json`: The folder hierarchy and index.

## 🛠 Features
- **Spatial Mapping**: Organize ideas on an infinite canvas.
- **Deep PDF Clipping**: Extract both images and text layer content from PDFs.
- **Local Ownership**: Your data stays on your disk. No proprietary cloud locking.
- **Offline Ready**: Works entirely in the browser using IndexedDB for cache and FileSystem API for durability.
