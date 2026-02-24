import { ref, computed, Ref, onUnmounted, inject, type ComputedRef } from 'vue'

type Direction = 'up' | 'down' | 'left' | 'right'

interface FocusContext {
  container?: HTMLElement
  currentIndex: number
  elements: HTMLElement[]
}

export class FocusManager {
  private contextStack: FocusContext[] = []
  private rootContainer: HTMLElement | null = null
  private focusedElement: Ref<HTMLElement | null> = ref(null)
  private navigationEnabled: Ref<boolean> = ref(true)

  constructor () {
    this.setupGlobalListeners()
  }

  setupFocus (rootContainer: HTMLElement) {
    this.rootContainer = rootContainer
    this.updateContext(rootContainer)
  }

  private setupGlobalListeners () {
    const handleKeydown = (e: KeyboardEvent) => {
      if (!this.navigationEnabled.value) return

      const direction = this.getKeyDirection(e)
      if (direction) {
        this.navigate(direction)
        e.preventDefault()
      } else if (e.key === 'Enter') {
        this.activateFocused()
        e.preventDefault()
      } else if (e.key === 'Escape') {
        this.handleEscape()
        e.preventDefault()
      }
    }

    document.addEventListener('keydown', handleKeydown)
    onUnmounted(() => {
      document.removeEventListener('keydown', handleKeydown)
    })
  }

  private getKeyDirection (e: KeyboardEvent): Direction | null {
    if (e.key === 'ArrowUp') return 'up'
    if (e.key === 'ArrowDown') return 'down'
    if (e.key === 'ArrowLeft') return 'left'
    if (e.key === 'ArrowRight') return 'right'
    return null
  }

  private lastNavigateDirection: string | null = null
  private lastNavigateTime: number = 0
  private readonly NAVIGATE_DEBOUNCE_TIME = 150

  navigate (direction: Direction) {
    const now = Date.now()
    const elapsed = now - this.lastNavigateTime
    const isSameDirection = this.lastNavigateDirection === direction

    if (elapsed < this.NAVIGATE_DEBOUNCE_TIME && isSameDirection && this.lastNavigateDirection) {
      console.log('[FocusManager] Navigation debounced:', direction, 'elapsed:', elapsed, 'time:', this.NAVIGATE_DEBOUNCE_TIME)
      return
    }

    this.lastNavigateDirection = direction
    this.lastNavigateTime = now

    const context = this.getCurrentContext()
    if (!context || context.elements.length === 0) return

    console.log('[FocusManager] Navigate:', direction, 'Current index:', context.currentIndex, 'Total elements:', context.elements.length)

    let newIndex = context.currentIndex

    switch (direction) {
      case 'up':
        newIndex--
        break
      case 'down':
        newIndex++
        break
      case 'left':
        newIndex--
        break
      case 'right':
        newIndex++
        break
    }

    if (newIndex < 0) {
      newIndex = 0
    } else if (newIndex >= context.elements.length) {
      newIndex = context.elements.length - 1
    }

    if (newIndex !== context.currentIndex) {
      this.setFocus(newIndex, context)
    }
  }
  private setFocus (index: number, context: FocusContext) {
    context.currentIndex = index
    this.focusedElement.value = context.elements[index]

    console.log('[FocusManager] Focus set to element at index:', index)

    this.highlightElement(context.elements[index])

    context.elements[index].scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest'
    })
  }
  private highlightElement (element: HTMLElement) {
    document.querySelectorAll('.gamepad-focused').forEach(el => {
      el.classList.remove('gamepad-focused')
    })

    element.classList.add('gamepad-focused')
  }

  activateFocused () {
    const element = this.focusedElement.value
    if (!element) return

    console.log('[FocusManager] Activating focused element:', element.tagName)

    element.click()
    element.focus()
  }

  handleEscape () {
    const context = this.getCurrentContext()
    if (!context) return

    console.log('[FocusManager] Escape pressed, closing current context')

    const element = context.elements[context.currentIndex]
    if (element) {
      element.click()
    }
  }

  scrollTo (direction: 'up' | 'down', amount: number = 200) {
    const context = this.getCurrentContext()
    if (!context || !context.container) return

    const scrollContainer = this.findScrollContainer(context.container)
    if (!scrollContainer) return

    console.log('[FocusManager] Scroll:', direction, 'Amount:', amount)

    if (direction === 'up') {
      scrollContainer.scrollBy({ top: -amount, behavior: 'smooth' })
    } else {
      scrollContainer.scrollBy({ top: amount, behavior: 'smooth' })
    }
  }

  private findScrollContainer (element: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = element
    while (current) {
      const overflow = window.getComputedStyle(current).overflow
      const overflowY = window.getComputedStyle(current).overflowY

      if ((overflow === 'auto' || overflow === 'scroll') ||
          (overflowY === 'auto' || overflowY === 'scroll')) {
        return current
      }
      current = current.parentElement
    }
    return null
  }

  private updateContext (container: HTMLElement) {
    const focusableElements = this.getFocusableElements(container)

    console.log('[FocusManager] Context updated:', focusableElements.length, 'focusable elements')

    this.contextStack.push({
      container,
      currentIndex: 0,
      elements: focusableElements
    })

    if (focusableElements.length > 0) {
      this.setFocus(0, this.contextStack[this.contextStack.length - 1])
    }
  }

  pushContext (container: HTMLElement) {
    const focusableElements = this.getFocusableElements(container)

    console.log('[FocusManager] Push context:', focusableElements.length, 'elements')

    this.contextStack.push({
      container,
      currentIndex: 0,
      elements: focusableElements
    })

    if (focusableElements.length > 0) {
      this.setFocus(0, this.contextStack[this.contextStack.length - 1])
    }
  }

  popContext () {
    if (this.contextStack.length > 1) {
      console.log('[FocusManager] Pop context')

      this.contextStack.pop()

      const context = this.getCurrentContext()
      if (context && context.elements.length > 0) {
        this.setFocus(context.currentIndex, context)
      }
    }
  }

  resetContext () {
    const context = this.getCurrentContext()
    if (!context || !context.container) return

    console.log('[FocusManager] Reset context')

    this.contextStack.length = 0
    this.updateContext(context.container)
  }

  private getCurrentContext (): FocusContext | null {
    return this.contextStack[this.contextStack.length - 1] || null
  }

  private getFocusableElements (container: HTMLElement): HTMLElement[] {
    const selector = [
      'button:not([disabled]):not([tabindex="-1"])',
      'a[href]:not([tabindex="-1"])',
      'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
      'select:not([disabled]):not([tabindex="-1"])',
      'textarea:not([disabled]):not([tabindex="-1"])',
      '[tabindex]:not([tabindex="-1"]):not([tabindex="0"])',
      '[data-focusable="true"]'
    ].join(', ')

    return Array.from(container.querySelectorAll<HTMLElement>(selector))
  }

  getFocusedElement (): ComputedRef<HTMLElement | null> {
    return computed(() => this.focusedElement.value)
  }

  getNavigationEnabled (): ComputedRef<boolean> {
    return computed(() => this.navigationEnabled.value)
  }

  setNavigationEnabled (enabled: boolean) {
    this.navigationEnabled.value = enabled
    console.log('[FocusManager] Navigation enabled:', enabled)

    if (!enabled) {
      document.querySelectorAll('.gamepad-focused').forEach(el => {
        el.classList.remove('gamepad-focused')
      })
    }
  }

  toggleNavigation () {
    this.setNavigationEnabled(!this.navigationEnabled.value)
  }
}

let instance: FocusManager | null = null

export function useFocusManager (): FocusManager {
  if (!instance) {
    instance = new FocusManager()
  }
  return instance
}

export function resetFocusManager () {
  if (instance) {
    instance = null
  }
}
