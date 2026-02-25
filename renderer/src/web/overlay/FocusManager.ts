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
      return
    }

    this.lastNavigateDirection = direction
    this.lastNavigateTime = now

    const context = this.getCurrentContext()
    if (!context) {
      console.log('[FocusManager] No context available')
      return
    }

    if (context.elements.length === 0) {
      console.log('[FocusManager] No elements in context, refreshing...')
      this.refreshContext()
      return
    }

    console.log('[FocusManager] Navigate:', direction, 'Current index:', context.currentIndex, 'Total elements:', context.elements.length)

    const currentElement = context.elements[context.currentIndex]
    const nextElement = this.findBestNextElement(currentElement, context.elements, direction)

    if (nextElement) {
      const newIndex = context.elements.indexOf(nextElement)
      if (newIndex !== -1 && newIndex !== context.currentIndex) {
        this.setFocus(newIndex, context)
      }
    } else {
      console.log('[FocusManager] No valid element found for direction:', direction)
    }
  }

  private findBestNextElement (
    currentElement: HTMLElement,
    elements: HTMLElement[],
    direction: Direction
  ): HTMLElement | null {
    const currentRect = currentElement.getBoundingClientRect()
    const centerX = currentRect.left + currentRect.width / 2
    const centerY = currentRect.top + currentRect.height / 2

    let candidates: { element: HTMLElement, score: number, primaryScore: number, secondaryScore: number }[] = []

    for (const element of elements) {
      if (element === currentElement) continue

      const rect = element.getBoundingClientRect()

      const computedStyle = window.getComputedStyle(element)
      const isVisible = (
        computedStyle.display !== 'none' &&
        computedStyle.visibility !== 'hidden' &&
        computedStyle.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0
      )

      if (!isVisible) continue

      const elCenterX = rect.left + rect.width / 2
      const elCenterY = rect.top + rect.height / 2

      const dx = elCenterX - centerX
      const dy = elCenterY - centerY

      let primaryScore = 0
      let secondaryScore = Math.abs(dx) + Math.abs(dy)
      let isValidCandidate = false

      switch (direction) {
        case 'up':
          if (dy < 0) {
            isValidCandidate = true
            primaryScore = -dy
          }
          break
        case 'down':
          if (dy > 0) {
            isValidCandidate = true
            primaryScore = dy
          }
          break
        case 'left':
          if (dx < 0) {
            isValidCandidate = true
            primaryScore = -dx
          }
          break
        case 'right':
          if (dx > 0) {
            isValidCandidate = true
            primaryScore = dx
          }
          break
      }

      if (isValidCandidate) {
        const score = primaryScore + secondaryScore * 0.1
        candidates.push({ element, score, primaryScore, secondaryScore })
      }
    }

    if (candidates.length === 0) {
      console.log('[FocusManager] No candidates found for direction:', direction)
      return null
    }

    candidates.sort((a, b) => a.primaryScore - b.primaryScore || a.secondaryScore - b.secondaryScore)
    console.log('[FocusManager] Best candidate:', candidates[0].element.tagName, 'primary:', candidates[0].primaryScore, 'secondary:', candidates[0].secondaryScore)
    return candidates[0].element
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

  refreshContext () {
    const context = this.getCurrentContext()
    if (!context || !context.container) return

    console.log('[FocusManager] Refresh context')

    const oldElements = context.elements
    const oldFocusedElement = context.elements[context.currentIndex]

    const newElements = this.getFocusableElements(context.container)

    console.log('[FocusManager] Old elements:', oldElements.length, 'New elements:', newElements.length)

    context.elements = newElements

    let newIndex = 0
    if (oldFocusedElement && newElements.includes(oldFocusedElement)) {
      newIndex = newElements.indexOf(oldFocusedElement)
      console.log('[FocusManager] Preserved focus on element at index:', newIndex)
    } else {
      console.log('[FocusManager] Old focused element not found, starting from index 0')
    }

    context.currentIndex = newIndex
    this.focusedElement.value = newElements[newIndex]

    this.highlightElement(newElements[newIndex])

    if (newElements[newIndex]) {
      newElements[newIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      })
    }
  }

  private getCurrentContext (): FocusContext | null {
    return this.contextStack[this.contextStack.length - 1] || null
  }

  private getFocusableElements (container: HTMLElement): HTMLElement[] {
    const selector = [
      'button:not([disabled]):not([tabindex="-1"])',
      'a[href]:not([tabindex="-1"])',
      'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
      'input[type="checkbox"]:not([disabled]):not([tabindex="-1"])',
      'select:not([disabled]):not([tabindex="-1"])',
      'textarea:not([disabled]):not([tabindex="-1"])',
      '[tabindex]:not([tabindex="-1"])',
      '[data-focusable="true"]'
    ].join(', ')

    const elements = Array.from(container.querySelectorAll<HTMLElement>(selector))

    console.log('[FocusManager] Found focusable elements:', elements.length)
    elements.forEach((el, idx) => {
      const rect = el.getBoundingClientRect()
      console.log(`[${idx}] ${el.tagName}${el.className ? '.' + el.className.split(' ').join('.') : ''} - visible: ${rect.width > 0 && rect.height > 0}, x:${rect.x}, y:${rect.y}, w:${rect.width}, h:${rect.height}`)
    })

    return elements
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

  focusElementBySelector (selector: string) {
    const context = this.getCurrentContext()
    if (!context || !context.container) return false

    const element = context.container.querySelector<HTMLElement>(selector)
    if (!element) return false

    const index = context.elements.indexOf(element)
    if (index === -1) return false

    this.setFocus(index, context)
    return true
  }

  focusElementByText (text: string) {
    const context = this.getCurrentContext()
    if (!context || !context.container) return false

    for (let i = 0; i < context.elements.length; i++) {
      const element = context.elements[i]
      if (element.textContent?.trim().toLowerCase().includes(text.toLowerCase())) {
        this.setFocus(i, context)
        return true
      }
    }
    return false
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
