# ATLAS v0.1.2

Patch release for **ATLAS** on Windows.

This update fixes the packaged desktop build so sessions started from the downloaded ZIP can launch the bundled ATLAS runtime correctly after extraction.

---

## What is ATLAS? 

ATLAS is a desktop app that lets an **AI team build software for you**.

You point ATLAS at a project (an idea, a website, a small app — whatever you want made or improved) and the AI takes over. Behind the scenes, a group of specialised AI agents plan the work, write the code, run the tests, fix their own mistakes, and ship the result. You watch all of this happen on a clean, friendly dashboard — no command line, no setup files, nothing technical to learn.

Think of it as hiring a tireless team of software engineers that lives inside a single window on your computer. You tell it *what* you want; it figures out *how* and just does it.

ATLAS is for:
- People who have an idea but don't know how to code.
- Developers who want to delegate boring or repetitive work.
- Teams who want to see software being built, step by step, in real time.

---

## How to open ATLAS (step by step)

1. **Download** the file `ATLAS-v0.1.2-win-x64.zip` from this release page (it's attached below).
2. Find the downloaded ZIP file (usually in your **Downloads** folder).
3. **Right-click** the ZIP file → choose **"Extract All…"** → pick a folder you can find again (for example, your Desktop) → click **Extract**.
4. Open the new **ATLAS** folder that just appeared.
5. **Double-click `ATLAS.exe`** to launch the app.

6. The ATLAS window will open. If it asks you to sign in to GitHub, follow the prompts — that's how ATLAS connects to your code projects.
7. Pick a repository (or describe what you want to build) and let ATLAS get to work.

That's it. No installer, no admin rights, no extra setup.

---

## System requirements

- Windows 10 or Windows 11 (64-bit)

- Internet connection (for GitHub sign-in and AI calls)

---

## Notes for developers

- Source code: see the repository on GitHub.
- This build was packaged with `electron-builder`. The `ATLAS.exe` is unsigned, hence the SmartScreen prompt on first launch.
- This patch fixes the packaged runtime launcher so it loads the bundled CLI from `resources/app.asar` with the bundled `tsx` loader.
