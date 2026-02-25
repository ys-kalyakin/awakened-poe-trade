# AI Agents Configuration

## Project Overview

Awakened PoE Trade is an Electron desktop application that provides in-game trading overlays for Path of Exile.

**Tech Stack:**
- **Frontend:** Vue.js 3, TypeScript, TailwindCSS, Vite
- **Backend:** Electron, TypeScript, uiohook-napi
- **Build Tools:** esbuild, electron-builder, vue-tsc

## Architecture

The application consists of two main parts:

### 1. Main Process (`main/`)
Electron main process that handles:
- Window management (overlays, widgets)
- Keyboard shortcuts (via uiohook-napi)
- File system access (game logs, config)
- IPC communication
- App updates

**Key Files:**
- `main/src/main.ts` - Entry point
- `main/src/windowing/` - Window management
- `main/src/shortcuts/` - Hotkey handling
- `main/src/vision/` - OCR/computer vision
- `main/src/host-files/` - Game log and config watching

### 2. Renderer Process (`renderer/`)
Vue.js-based UI rendered within Electron container:
- Price check overlay
- Map check overlay
- Item search/check widgets
- Settings window
- Various utility widgets

**Key Directories:**
- `renderer/src/web/price-check/` - Price checking UI
- `renderer/src/web/map-check/` - Map analysis
- `renderer/src/web/item-check/` - Item information display
- `renderer/src/web/overlay/` - Overlay system
- `renderer/src/parser/` - Item text parsing

## Development Commands

### Initial Setup
```bash
cd renderer
yarn install
yarn make-index-files
yarn dev

cd ../main
yarn install
yarn dev
```

### Linting
```bash
cd renderer
yarn lint
```

### Type Checking
```bash
cd renderer
yarn build  # Runs vue-tsc --noEmit

cd ../main
yarn build  # Runs tsc --noEmit
```

### Building for Production
```bash
cd renderer
yarn install
yarn make-index-files
yarn build

cd ../main
yarn build
CSC_NAME="Certificate name in Keychain" yarn package
```

## Important Notes

1. **Both parts depend on each other** - cannot run independently
2. **Always run `make-index-files`** in renderer before dev/build
3. **TypeScript is strict** - check errors before committing
4. **Hot reload** works in both processes during development
5. **CI workflow** - See `.github/workflows/main.yml` for latest build steps

## Testing

No automated tests are configured in this project. Manual testing is required.

## Agent Behavior

When working on this project:

1. **Check file context** - Always read related files before making changes
2. **Follow existing patterns** - Mimic code style and structure
3. **Type safety** - Ensure TypeScript compiles without errors
4. **Cross-process changes** - Some features require changes in both `main/` and `renderer/`
5. **IPC communication** - Understand how main and renderer communicate via IPC
6. **No commits** - NEVER create git commits unless explicitly requested by the user
7. **Progress tracking** - Document all issues, bugs, and item data in progress.md
