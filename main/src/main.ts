"use strict";

import { app, screen } from "electron";
import { uIOhook, UiohookKey as Key } from "uiohook-napi";
import os from "node:os";
import { startServer, eventPipe, server } from "./server";
import { Logger } from "./RemoteLogger";
import { GameWindow } from "./windowing/GameWindow";
import { OverlayWindow } from "./windowing/OverlayWindow";
import { GameConfig } from "./host-files/GameConfig";
import { Shortcuts } from "./shortcuts/Shortcuts";
import { AppUpdater } from "./AppUpdater";
import { AppTray } from "./AppTray";
import { OverlayVisibility } from "./windowing/OverlayVisibility";
import { GameLogWatcher } from "./host-files/GameLogWatcher";
import { HttpProxy } from "./proxy";
import { HostClipboard } from "./shortcuts/HostClipboard";
import { hotkeyToString, mergeTwoHotkeys } from "../../ipc/KeyToCode";

if (!app.requestSingleInstanceLock()) {
  app.exit();
}

if (process.platform !== "darwin") {
  app.disableHardwareAcceleration();
}
app.enableSandbox();

let tray: AppTray;
let isProcessingPriceCheck = false;
let priceCheckProcessingTimer: NodeJS.Timeout | null = null;

app.on("ready", async () => {
  tray = new AppTray(eventPipe);
  const logger = new Logger(eventPipe);
  const gameLogWatcher = new GameLogWatcher(eventPipe, logger);
  const gameConfig = new GameConfig(eventPipe, logger);
  const poeWindow = new GameWindow();
  const appUpdater = new AppUpdater(eventPipe);
  const _httpProxy = new HttpProxy(server, logger);
  const clipboard = new HostClipboard(logger);

  setTimeout(
    async () => {
      const overlay = new OverlayWindow(eventPipe, logger, poeWindow);
      new OverlayVisibility(eventPipe, overlay, gameConfig);
      const shortcuts = await Shortcuts.create(
        logger,
        overlay,
        poeWindow,
        gameConfig,
        eventPipe,
      );
      eventPipe.onEventAnyClient("CLIENT->MAIN::update-host-config", (cfg) => {
        overlay.updateOpts(cfg.overlayKey, cfg.windowTitle);
        shortcuts.updateActions(
          cfg.shortcuts,
          cfg.stashScroll,
          cfg.logKeys,
          cfg.restoreClipboard,
          cfg.language,
        );
        gameLogWatcher.restart(cfg.clientLog ?? "");
        gameConfig.readConfig(cfg.gameConfig ?? "");
        appUpdater.checkAtStartup();
        tray.overlayKey = cfg.overlayKey;
      });

      // Function to copy item text using hotkeys
      async function pressKeysToCopyItemText (): Promise<void> {
        try {
          const showModsKey = gameConfig.showModsKeyNullable || "Alt";

          console.log('[Gamepad] ===== START COPYING ITEM =====')
          console.log('[Gamepad] showModsKey:', showModsKey)
          console.log('[Gamepad] Step 1: Pressing Ctrl')
          uIOhook.keyToggle(Key.Ctrl, "down");
          await new Promise(resolve => setTimeout(resolve, 50));

          console.log('[Gamepad] Step 2: Pressing C (open mods menu)')
          uIOhook.keyTap(Key.C);
          await new Promise(resolve => setTimeout(resolve, 150));

          console.log('[Gamepad] Step 3: Pressing showModsKey to copy item:', showModsKey)
          uIOhook.keyToggle(Key[showModsKey as keyof typeof Key], "down");
          await new Promise(resolve => setTimeout(resolve, 150));

          console.log('[Gamepad] Step 4: Releasing showModsKey')
          uIOhook.keyToggle(Key[showModsKey as keyof typeof Key], "up");
          await new Promise(resolve => setTimeout(resolve, 50));

          console.log('[Gamepad] Step 5: Releasing Ctrl')
          uIOhook.keyToggle(Key.Ctrl, "up");

          console.log('[Gamepad] ===== ITEM COPY KEYS PRESSED =====')
        } catch (err) {
          console.log('[Gamepad] Error in pressKeysToCopyItemText:', err);
        }
      }

      // Handle gamepad actions from renderer
      eventPipe.onEventAnyClient(
        "RENDERER->MAIN::gamepad-action",
        async (action) => {
          console.log(`[Gamepad] Action received:`, JSON.stringify(action))

          if (action.type === "toggle-overlay") {
            console.log('[Gamepad] Toggling overlay')
            overlay.toggleActiveState();
           } else if (action.type === "copy-item") {
            // Mark price-check as not processing when copy-item is triggered
            isProcessingPriceCheck = false
            console.log('[Gamepad] Cleanup: copy-item triggered, price-check processing cancelled')

            // Make sure overlay is active
            if (!overlay.isInteractable) {
              overlay.toggleActiveState();
            }

            // Copy item using hotkeys first
            pressKeysToCopyItemText().then(() => {
              console.log('[Gamepad] Item copied, waiting 200ms for clipboard')

              // Wait for clipboard to be ready
              setTimeout(() => {
                // Read clipboard for gamepad copy-item action
                clipboard
                  .readItemText()
                  .then((clipboardText) => {
                    console.log('[Gamepad] Got clipboard text:', clipboardText.substring(0, 50))
                    eventPipe.sendEventTo("last-active", {
                      name: "MAIN->CLIENT::item-text",
                      payload: {
                        target: action.target || "item-check",
                        clipboard: clipboardText,
                        position: { x: 0, y: 0 },
                        focusOverlay: true,
                      },
                    });
                  })
                  .catch(() => {
                    // If clipboard read fails, send empty
                    console.log('[Gamepad] Error reading clipboard, sending empty')
                    eventPipe.sendEventTo("last-active", {
                      name: "MAIN->CLIENT::item-text",
                      payload: {
                        target: action.target || "item-check",
                        clipboard: "",
                        position: { x: 0, y: 0 },
                        focusOverlay: action.focusOverlay ?? false,
                      },
                    });
                  });
              }, 200)
            }).catch((err) => {
              console.log('[Gamepad] Error copying item:', err)
            });
          } else if (action.type === "price-check") {
            // Prevent multiple price-check actions
            if (isProcessingPriceCheck) {
              console.log('[Gamepad] Price-check already processing, ignoring duplicate')
              return
            }

            console.log('[Gamepad] Price-check action triggered')

            // Get cursor position BEFORE we start pressing keys
            const cursorPosition = screen.getCursorScreenPoint()
            console.log('[Gamepad] Cursor position BEFORE hotkeys:', cursorPosition)

            // Mark as processing
            isProcessingPriceCheck = true
            console.log('[Gamepad] Marked as processing price-check')

            // Focus price-check widget
            console.log('[Gamepad] Sending widget-action for price-check')
            eventPipe.sendEventTo("broadcast", {
              name: "MAIN->CLIENT::widget-action",
              payload: { target: "price-check" },
            });

            // Wait for widget to open
            setTimeout(() => {
              console.log('[Gamepad] Waiting for item to be copied')

              // Copy item using hotkeys
              pressKeysToCopyItemText().then(() => {
                console.log('[Gamepad] Item copied, waiting 2000ms for clipboard')

                // Wait for clipboard to be ready
                setTimeout(async () => {
                  console.log('[Gamepad] Reading clipboard')

                  // Use direct clipboard read instead of HostClipboard
                  try {
                    const { clipboard } = require('electron')
                    const directText = clipboard.readText()
                    console.log('[Gamepad] Direct clipboard read result:', directText.substring(0, 100))
                    console.log('[Gamepad] Direct clipboard length:', directText.length)

                    if (directText.length === 0) {
                      console.log('[Gamepad] ERROR: Clipboard is empty!')
                      console.log('[Gamepad] Sending empty item-text')
                      eventPipe.sendEventTo("last-active", {
                        name: "MAIN->CLIENT::item-text",
                        payload: {
                          target: "price-check",
                          clipboard: "",
                          position: cursorPosition,
                          focusOverlay: true,
                        },
                      });
                      return
                    }

                    // Verify it's an item
                    if (!directText.startsWith('Item Class:')) {
                      console.log('[Gamepad] ERROR: Clipboard doesn\'t contain an item!')
                      console.log('[Gamepad] First 50 chars:', directText.substring(0, 50))
                      eventPipe.sendEventTo("last-active", {
                        name: "MAIN->CLIENT::item-text",
                        payload: {
                          target: "price-check",
                          clipboard: directText,
                          position: cursorPosition,
                          focusOverlay: true,
                        },
                      });
                      return
                    }

                    console.log('[Gamepad] Got clipboard text successfully!')
                    console.log('[Gamepad] Sending item-text with cursor position:', cursorPosition)
                    eventPipe.sendEventTo("last-active", {
                      name: "MAIN->CLIENT::item-text",
                      payload: {
                        target: "price-check",
                        clipboard: directText,
                        position: cursorPosition,
                        focusOverlay: true,
                      },
                    });
                  } catch (e) {
                    console.log('[Gamepad] Error reading clipboard directly:', e)
                    console.log('[Gamepad] Sending empty item-text')
                    eventPipe.sendEventTo("last-active", {
                      name: "MAIN->CLIENT::item-text",
                      payload: {
                        target: "price-check",
                        clipboard: "",
                        position: cursorPosition,
                        focusOverlay: true,
                      },
                    });
                  }

                  // Cleanup: mark price-check as not processing
                  isProcessingPriceCheck = false
                  console.log('[Gamepad] Cleanup: price-check processing finished')
                }, 150)
               }).catch((err) => {
                 console.log('[Gamepad] Error copying item:', err)

                 // Cleanup on error
                 isProcessingPriceCheck = false
                 console.log('[Gamepad] Cleanup: price-check processing failed')
               })
             }, 100)
           } else if (action.type === "trigger-event") {
             // Mark price-check as not processing when trigger-event is triggered
             isProcessingPriceCheck = false
             console.log('[Gamepad] Cleanup: trigger-event triggered, price-check processing cancelled')
             eventPipe.sendEventTo("broadcast", {
               name: "MAIN->CLIENT::widget-action",
               payload: { target: action.target || "" },
             });
          } else if (action.type === "close-price-check") {
            console.log('[Gamepad] Closing price-check widget')
            isProcessingPriceCheck = false
            console.log('[Gamepad] Cleanup: close-price-check triggered, price-check processing cancelled')
            eventPipe.sendEventTo("broadcast", {
              name: "MAIN->CLIENT::widget-action",
              payload: { target: "price-check", action: "hide" },
            });
          } else if (action.type === "navigate-up" || action.type === "navigate-down" ||
                     action.type === "navigate-left" || action.type === "navigate-right" ||
                     action.type === "activate" || action.type === "cancel" ||
                     action.type === "secondary" || action.type === "tertiary" ||
                     action.type === "scroll-up" || action.type === "scroll-down" ||
                     action.type === "prev-tab" || action.type === "next-tab") {
            console.log(`[Gamepad] Navigation action: ${action.type}`)
            eventPipe.sendEventTo("broadcast", {
              name: "MAIN->CLIENT::gamepad-navigation",
              payload: { type: action.type },
            });
          } else if (action.type === "prev-widget") {
            console.log('[Gamepad] Previous widget')
            eventPipe.sendEventTo("broadcast", {
              name: "MAIN->CLIENT::widget-action",
              payload: { target: "", action: "prev-widget" },
            });
          } else if (action.type === "next-widget") {
            console.log('[Gamepad] Next widget')
            eventPipe.sendEventTo("broadcast", {
              name: "MAIN->CLIENT::widget-action",
              payload: { target: "", action: "next-widget" },
            });
          }
        }
      );

      uIOhook.start();
      const port = await startServer(appUpdater, logger);
      // TODO: move up (currently crashes)
      logger.write(`info ${os.type()} ${os.release} / v${app.getVersion()}`);
      overlay.loadAppPage(port);
      tray.serverPort = port;
    },
    // fixes(linux): window is black instead of transparent
    process.platform === "linux" ? 1000 : 0,
  );
});
