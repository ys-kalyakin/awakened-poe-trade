// Gamepad support for Awakened PoE Trade
// This module provides gamepad input handling in the renderer process

import { Host } from '@/web/background/IPC'

export interface GamepadActionConfig {
  button: string
  action: GamepadAction
  target?: string
}

export interface GamepadAction {
  type: 'toggle-overlay' | 'copy-item' | 'trigger-event' | 'paste-in-chat' | 'stash-search' |
        'price-check' | 'close-price-check' |
        'navigate-up' | 'navigate-down' | 'navigate-left' | 'navigate-right' |
        'activate' | 'cancel' | 'secondary' | 'tertiary' |
        'scroll-up' | 'scroll-down' | 'prev-tab' | 'next-tab' |
        'prev-widget' | 'next-widget'
  target?: string
  focusOverlay?: boolean
  text?: string
  send?: boolean
}

export interface GamepadConfig {
  enabled: boolean
  actions: GamepadActionConfig[]
}

export const GamepadButtonNames: Record<string, string> = {
  A: 'A (Cross)',
  B: 'B (Circle)',
  X: 'X (Square)',
  Y: 'Y (Triangle)',
  LB: 'LB (L1)',
  RB: 'RB (R1)',
  LT: 'LT (L2)',
  RT: 'RT (R2)',
  BACK: 'Back',
  START: 'Start',
  LS: 'LS (Left Stick)',
  RS: 'RS (Right Stick)',
  L3: 'L3 (Left Stick)',
  R3: 'R3 (Right Stick)',
  DPAD_DOWN: 'D-Pad Down',
  DPAD_UP: 'D-Pad Up',
  DPAD_LEFT: 'D-Pad Left',
  DPAD_RIGHT: 'D-Pad Right',
  DOWN: 'D-Pad Down',
  UP: 'D-Pad Up',
  LEFT: 'D-Pad Left',
  RIGHT: 'D-Pad Right'
}

export const GamepadButtons = [
  { id: 'A', name: 'A (Cross)' },
  { id: 'B', name: 'B (Circle)' },
  { id: 'X', name: 'X (Square)' },
  { id: 'Y', name: 'Y (Triangle)' },
  { id: 'LB', name: 'LB (L1)' },
  { id: 'RB', name: 'RB (R1)' },
  { id: 'LT', name: 'LT (L2)' },
  { id: 'RT', name: 'RT (R2)' },
  { id: 'START', name: 'Start' },
  { id: 'BACK', name: 'Back' },
  { id: 'L3', name: 'L3 (Left Stick)' },
  { id: 'R3', name: 'R3 (Right Stick)' },
  { id: 'DPAD_DOWN', name: 'D-Pad Down' },
  { id: 'DPAD_UP', name: 'D-Pad Up' },
  { id: 'DPAD_LEFT', name: 'D-Pad Left' },
  { id: 'DPAD_RIGHT', name: 'D-Pad Right' },
  { id: 'DOWN', name: 'D-Pad Down' },
  { id: 'UP', name: 'D-Pad Up' },
  { id: 'LEFT', name: 'D-Pad Left' },
  { id: 'RIGHT', name: 'D-Pad Right' }
]

const DEFAULT_CONFIG: GamepadConfig = {
  enabled: true,
  actions: [
    { button: 'LT+RT', action: { type: 'copy-item', focusOverlay: true, target: 'item-check' } },
    { button: 'L3+R3', action: { type: 'price-check', focusOverlay: true } },
    { button: 'B', action: { type: 'close-price-check' } },
    // D-Pad Navigation
    { button: 'DPAD_UP', action: { type: 'navigate-up' } },
    { button: 'DPAD_DOWN', action: { type: 'navigate-down' } },
    { button: 'DPAD_LEFT', action: { type: 'navigate-left' } },
    { button: 'DPAD_RIGHT', action: { type: 'navigate-right' } },
    // Action Buttons
    { button: 'A', action: { type: 'activate' } },
    { button: 'B', action: { type: 'cancel' } },
    { button: 'X', action: { type: 'secondary' } },
    { button: 'Y', action: { type: 'tertiary' } },
    // Shoulder Buttons - Scroll
    { button: 'LT', action: { type: 'scroll-up' } },
    { button: 'RT', action: { type: 'scroll-down' } },
    // Shoulder Buttons - Tabs
    { button: 'LB', action: { type: 'prev-tab' } },
    { button: 'RB', action: { type: 'next-tab' } }
  ]
}

type GamepadEventCallback = (action: GamepadActionConfig) => void

export class GamepadManager {
  private config: GamepadConfig = DEFAULT_CONFIG
  private isListening = false
  private pollIntervalId: number | null = null
  private pressedButtons: Set<string> = new Set<string>()
  private comboCooldown: number = 0
  private priceCheckCooldown: number = 0
  private listeners: Set<GamepadEventCallback> = new Set<GamepadEventCallback>()
  private static instance: GamepadManager | null = null

  private comboTimeout: number = 0
  private comboStartTime: number = 0
  private comboButtons: string[] = []

  private constructor () {
    this.start()
  }

  static getInstance (): GamepadManager {
    if (!GamepadManager.instance) {
      GamepadManager.instance = new GamepadManager()
    }
    return GamepadManager.instance
  }

  start (): void {
    if (this.isListening) return

    console.log('[GamepadManager] Starting gamepad polling...')

    this.pollIntervalId = window.setInterval(() => {
      this.poll()
    }, 20)

    this.isListening = true

    this.detectGamepad()

    console.log('[GamepadManager] Gamepad polling started')
  }

  stop (): void {
    if (this.pollIntervalId !== null) {
      window.clearInterval(this.pollIntervalId)
      this.pollIntervalId = null
    }
    this.isListening = false
    this.pressedButtons.clear()
    this.comboCooldown = 0
    this.priceCheckCooldown = 0
    this.comboTimeout = 0
    this.comboStartTime = 0
    this.comboButtons = []
  }

  private detectGamepad (): void {
    const gamepads = navigator.getGamepads()
    if (!gamepads) {
      return
    }

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i]
      if (gp) {
        return
      }
    }
  }

  updateConfig (config: Partial<GamepadConfig>): void {
    const wasEnabled = this.config.enabled
    this.config = { ...this.config, ...config }

    if (this.config.enabled && !wasEnabled) {
      this.start()
    } else if (!this.config.enabled && wasEnabled) {
      this.stop()
    }
  }

  onAction (callback: GamepadEventCallback): () => void {
    const callbackRef: GamepadEventCallback = callback
    this.listeners.add(callbackRef)
    return () => this.listeners.delete(callbackRef)
  }

  private poll (): void {
    if (!this.config.enabled) return

    if (this.comboCooldown > 0) {
      this.comboCooldown--
      return
    }

    const gamepads = navigator.getGamepads()
    if (!gamepads) return

    let gamepad: Gamepad | null = null
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        gamepad = gamepads[i]
        break
      }
    }

    if (!gamepad) return

    const now = Date.now()

    const newlyPressed: string[] = []

    for (let i = 0; i < gamepad.buttons.length; i++) {
      const btn = gamepad.buttons[i]
      if (btn && btn.pressed) {
        const btnName = this.getButtonName(i)
        if (!this.pressedButtons.has(btnName)) {
          newlyPressed.push(btnName)
          this.pressedButtons.add(btnName)

          // Start combo timeout on first button press
          if (this.comboButtons.length === 0) {
            // Check if this button is part of any configured combo
            for (const ac of this.config.actions) {
              if (ac.button.includes('+') && ac.button.split('+').map(b => b.trim()).includes(btnName)) {
                this.comboStartTime = now
                this.comboButtons = [btnName]
                break
              }
            }
          }
        }
      }
    }

    for (const btnName of this.pressedButtons) {
      const btnIndex = this.getButtonIndex(btnName)
      if (btnIndex !== null) {
        const btn = gamepad.buttons[btnIndex]
        if (!btn || !btn.pressed) {
          this.pressedButtons.delete(btnName)

          // Remove button from combo buttons
          this.comboButtons = this.comboButtons.filter(b => b !== btnName)

          // Reset combo if the button that caused the timeout is released
          if (this.comboButtons.length > 0 && btnName === this.comboButtons[0]) {
            this.comboButtons = []
            this.comboStartTime = 0
          }
        }
      }
    }

    // Check if combo timeout has expired
    if (this.comboButtons.length > 0 && (now - this.comboStartTime) > 800) {
      this.comboButtons = []
      this.comboStartTime = 0
    }

    for (const actionConfig of this.config.actions) {
      if (actionConfig.button.includes('+')) {
        const comboButtons = actionConfig.button.split('+').map(b => b.trim())

        // Only check combo if we're in the timeout window and we're pressing the right buttons
        if (this.comboButtons.length > 0 && this.comboButtons[0] === comboButtons[0] && (now - this.comboStartTime) <= 800) {
          const allPressed = comboButtons.every(btn => this.pressedButtons.has(btn))

          if (allPressed) {
            this.emitAction(actionConfig)
            this.comboCooldown = 10
            this.comboButtons = []
            this.comboStartTime = 0
            break
          }
        }
      }
    }

    for (const btnName of newlyPressed) {
      const actionConfig = this.config.actions.find(a =>
        !a.button.includes('+') && a.button === btnName
      )

      if (actionConfig) {
        this.emitAction(actionConfig)
      }
    }

    if (this.comboCooldown > 0) {
      this.comboCooldown--
    }

    if (this.priceCheckCooldown > 0) {
      this.priceCheckCooldown--
    }
  }

  private getButtonName (index: number): string {
    // Custom mapping for non-standard gamepads (PS4/PS5, etc.)
    // Standard Xbox mapping: 12=DOWN, 13=RIGHT, 14=LEFT, 15=UP
    // This gamepad: 12=UP, 13=DOWN, 14=LEFT, 15=RIGHT
    const names: Record<number, string> = {
      0: 'A',
      1: 'B',
      2: 'X',
      3: 'Y',
      4: 'LB',
      5: 'RB',
      6: 'LT',
      7: 'RT',
      8: 'BACK',
      9: 'START',
      10: 'L3',
      11: 'R3',
      12: 'DPAD_UP',      // Standard: DPAD_DOWN
      13: 'DPAD_DOWN',    // Standard: DPAD_RIGHT
      14: 'DPAD_LEFT',
      15: 'DPAD_RIGHT'    // Standard: DPAD_UP
    }
    return names[index] || `BTN${index}`
  }

  private getButtonIndex (buttonName: string): number | null {
    const normalized = buttonName.toUpperCase().replace(/\s+/g, '_')
    const buttonMap: Record<string, number> = {
      A: 0,
      B: 1,
      X: 2,
      Y: 3,
      LB: 4,
      RB: 5,
      LT: 6,
      RT: 7,
      BACK: 8,
      START: 9,
      LS: 10,
      RS: 11,
      L3: 10,
      R3: 11,
      // Custom mapping for non-standard gamepads
      DPAD_UP: 12,       // Standard: 15
      DPAD_DOWN: 13,     // Standard: 12
      DPAD_LEFT: 14,
      DPAD_RIGHT: 15,    // Standard: 13
      // Aliases
      UP: 12,
      DOWN: 13,
      LEFT: 14,
      RIGHT: 15
    }
    return buttonMap[normalized] ?? null
  }

  private emitAction (actionConfig: GamepadActionConfig): void {
    const action = actionConfig.action

    if (action.type === 'price-check') {
      if (this.priceCheckCooldown > 0) {
        return
      }
      this.priceCheckCooldown = 50
    }

    if (Host) {
      Host.sendEvent({
        name: 'RENDERER->MAIN::gamepad-action',
        payload: {
          type: action.type as any,
          target: actionConfig.target ?? action.target,
          focusOverlay: action.focusOverlay
        }
      })
    }

    for (const listener of this.listeners) {
      listener(actionConfig)
    }
  }

  static getAvailableButtons (): string[] {
    return ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'START', 'BACK', 'L3', 'R3', 'DOWN', 'LEFT', 'RIGHT']
  }

  static destroy (): void {
    if (GamepadManager.instance) {
      GamepadManager.instance.stop()
      GamepadManager.instance = null
    }
  }
}
