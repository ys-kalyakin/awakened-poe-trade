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
      return
    }

    if (context.elements.length === 0) {
      this.refreshContext()
      return
    }

    const currentElement = context.elements[context.currentIndex]
    const nextElement = this.findBestNextElement(currentElement, context.elements, direction)

    if (nextElement) {
      const newIndex = context.elements.indexOf(nextElement)
      if (newIndex !== -1 && newIndex !== context.currentIndex) {
        this.setFocus(newIndex, context)
      }
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

    let candidates: { element: HTMLElement, score: number }[] = []

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
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Check if element is in the correct direction with deadzone
      let isValidCandidate = false
      let directionScore = 0

      switch (direction) {
        case 'up':
          // Element must be above current (smaller Y)
          // Use top edge comparison for more reliable detection
          if (rect.top < currentRect.top - 5) {
            isValidCandidate = true
            // Prefer elements that are more above and aligned horizontally
            const verticalDist = centerY - elCenterY
            const horizontalAlign = Math.abs(dx)
            // Bonus for horizontal alignment
            const alignmentBonus = horizontalAlign < 20 ? 50 : 0
            directionScore = verticalDist * 3 + alignmentBonus - horizontalAlign
          }
          break
        case 'down':
          // Element must be below current (larger Y)
          // Use top edge comparison for more reliable detection
          if (rect.top > currentRect.bottom + 5) {
            isValidCandidate = true
            // Prefer elements that are more below and aligned horizontally
            const verticalDist = elCenterY - centerY
            const horizontalAlign = Math.abs(dx)
            // Bonus for horizontal alignment
            const alignmentBonus = horizontalAlign < 20 ? 50 : 0
            directionScore = verticalDist * 3 + alignmentBonus - horizontalAlign
          }
          break
        case 'left':
          // Element must be to the left (smaller X)
          if (rect.left < currentRect.left - 5) {
            isValidCandidate = true
            // Prefer elements that are more to the left and aligned vertically
            const horizontalDist = centerX - elCenterX
            const verticalAlign = Math.abs(dy)
            // Bonus for vertical alignment
            const alignmentBonus = verticalAlign < 20 ? 50 : 0
            directionScore = horizontalDist * 3 + alignmentBonus - verticalAlign
          }
          break
        case 'right':
          // Element must be to the right (larger X)
          if (rect.left > currentRect.right + 5) {
            isValidCandidate = true
            // Prefer elements that are more to the right and aligned vertically
            const horizontalDist = elCenterX - centerX
            const verticalAlign = Math.abs(dy)
            // Bonus for vertical alignment
            const alignmentBonus = verticalAlign < 20 ? 50 : 0
            directionScore = horizontalDist * 3 + alignmentBonus - verticalAlign
          }
          break
      }

      if (isValidCandidate) {
        // Lower score is better (closer and better aligned)
        const score = distance - directionScore
        candidates.push({ element, score })
      }
    }

    if (candidates.length === 0) {
      return this.findCircularNextElement(currentElement, elements, direction)
    }

    // Sort by score (ascending - lower is better)
    candidates.sort((a, b) => a.score - b.score)
    return candidates[0].element
  }

  private findCircularNextElement (
    currentElement: HTMLElement,
    elements: HTMLElement[],
    direction: Direction
  ): HTMLElement | null {
    const currentIndex = elements.indexOf(currentElement)

    let visibleElements: HTMLElement[] = []
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

      if (isVisible) {
        visibleElements.push(element)
      }
    }

    if (visibleElements.length === 0) {
      return null
    }

    if (visibleElements.length === 1) {
      return visibleElements[0]
    }

    let nextIndex: number

    switch (direction) {
      case 'up':
      case 'down':
      case 'left':
      case 'right':
        nextIndex = this.findNextInOrder(currentIndex, visibleElements, direction)
        break
      default:
        return visibleElements[0]
    }

    if (nextIndex >= 0 && nextIndex < visibleElements.length) {
      return visibleElements[nextIndex]
    }

    return null
  }

  private findNextInOrder (
    currentIndex: number,
    elements: HTMLElement[],
    direction: Direction
  ): number {
    const lastIndex = elements.length - 1

    switch (direction) {
      case 'up':
        return currentIndex === 0 ? lastIndex : currentIndex - 1
      case 'down':
        return currentIndex === lastIndex ? 0 : currentIndex + 1
      case 'left':
        return currentIndex === 0 ? lastIndex : currentIndex - 1
      case 'right':
        return currentIndex === lastIndex ? 0 : currentIndex + 1
    }

    return 0
  }
  private setFocus (index: number, context: FocusContext) {
    context.currentIndex = index
    this.focusedElement.value = context.elements[index]

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

    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      element.checked = !element.checked
      element.dispatchEvent(new Event('change', { bubbles: true }))
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.focus()
      return
    }

    if (element instanceof HTMLInputElement && element.type === 'radio') {
      element.checked = true
      element.dispatchEvent(new Event('change', { bubbles: true }))
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.focus()
      return
    }

    if (element.tagName === 'BUTTON') {
      const gamepadActivation = this.focusedElement.value?.classList.contains('gamepad-focused')
      if (gamepadActivation) {
        element.setAttribute('data-gamepad-activation', 'true')
      }

      element.focus()
      element.click()
      return
    }

    element.click()
    element.focus()
  }

  handleEscape () {
    const context = this.getCurrentContext()
    if (!context) return

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

    this.contextStack.length = 0
    this.updateContext(context.container)
  }

  refreshContext () {
    const context = this.getCurrentContext()
    if (!context || !context.container) return

    const oldElements = context.elements
    const oldFocusedElement = context.elements[context.currentIndex]

    const newElements = this.getFocusableElements(context.container)

    context.elements = newElements

    let newIndex = 0
    if (oldFocusedElement && newElements.includes(oldFocusedElement)) {
      newIndex = newElements.indexOf(oldFocusedElement)
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

    // Filter out elements with data-skip-focus attribute
    const filteredElements = elements.filter(el => {
      return el.getAttribute('data-skip-focus') !== 'true'
    })

    return filteredElements
  }

  getFocusedElement (): ComputedRef<HTMLElement | null> {
    return computed(() => this.focusedElement.value)
  }

  getNavigationEnabled (): ComputedRef<boolean> {
    return computed(() => this.navigationEnabled.value)
  }

  setNavigationEnabled (enabled: boolean) {
    this.navigationEnabled.value = enabled

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
