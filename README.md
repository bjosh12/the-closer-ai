<div align="center">
  <img src="public/icon.png" width="128" alt="Mocking Bird AI Logo" />
  
  # Mocking Bird AI

  **The Smartest AI Interview Assistant Ever Built**

  [![Release](https://img.shields.io/github/v/release/bjosh12/mocking-bird-ai?style=flat-square)](https://github.com/bjosh12/mocking-bird-ai/releases)
  [![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey?style=flat-square)](https://github.com/bjosh12/mocking-bird-ai/releases)
  
  <p align="center">
    Real-time AI suggestions that sync with your resume, knowledge base, and job description. Featuring Ghost Mode and Global Hotkeys for full discretion during live interviews.
  </p>
</div>

---

## 🚀 Features

- **Ghost Mode**: Set the copilot to 50% opacity and enable click-through. It stays visible as a guide but disappears from screen shares and remains unclickable during intense coding sessions.
- **Global Hotkeys**: Use `Alt + C` to instantly hide or show the widget at any time. Total control at your fingertips.
- **Cloud Intelligence Sync**: Upload your resume once on the web. It instantly syncs to the desktop app, ensuring the AI knows your entire career history.
- **Real-Time Transcription**: Captures interviewer questions with sub-second latency, even through system audio.
- **Answer Buffering**: Smart buffer prevents fragmented AI responses, giving you cohesive, well-structured answers every single time.
- **No Taskbar Presence**: The desktop app runs purely from the system tray. No icons in your active apps list during screen shares.

## 📥 Installation

You do not need to build the app from source to use it! 

1. Head over to the **[Releases](https://github.com/bjosh12/mocking-bird-ai/releases/latest)** page.
2. Download the installer for your operating system:
   * **Windows**: Download the `.exe` file.
   * **macOS**: Download the `.dmg` file.
3. Install and run. The app will automatically update in the background when a new version is released.

## 🛠️ Development Setup

If you want to contribute or build the app locally, follow these steps:

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Build Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/bjosh12/mocking-bird-ai.git
   cd mocking-bird-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server (hot-reloading enabled):
   ```bash
   npm run dev
   ```

4. Package the app for your local operating system:
   ```bash
   npm run build
   ```
   *The built installers will be located in the `release/` directory.*

## 💻 Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/) + [electron-builder](https://www.electron.build/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)

---
<div align="center">
  <i>Built for winners. Close the deal.</i>
</div>
