# Gamepad Navigation in Overlay

## Problem Statement

Currently, gamepad support in Awakened PoE Trade only includes:
- Opening price-check widget with L3+R3
- Closing price-check widget with B button

There is **no navigation within the overlay** using the gamepad, making it impossible to:
- Select items in trade listings
- Navigate through filters
- Press buttons (Search, Save, Cancel)
- Scroll through listings
- Switch between tabs/presets

## Proposed Architecture

### Global Gamepad Manager Enhancement

The `GamepadManager` should handle navigation events when a widget is active. Navigation should be context-aware based on:
1. **Active widget type** (price-check, settings, item-check, etc.)
2. **Current focus element** (list, button, filter, etc.)
3. **Navigation direction** (up, down, left, right)

### Focus Management System

Create a global focus manager that:
- Tracks the currently focused element
- Provides methods to move focus (up, down, left, right)
- Highlights the focused element visually
- Handles focus boundaries

### Gamepad Button Mapping

| Button | Action | Context |
|---------|---------|----------|
| **D-Pad Up** | Navigate to previous item/option | Lists, menus, filters |
| **D-Pad Down** | Navigate to next item/option | Lists, menus, filters |
| **D-Pad Left** | Navigate left / previous tab | Tabs, presets, filter groups |
| **D-Pad Right** | Navigate right / next tab | Tabs, presets, filter groups |
| **A** | Activate / Select / Confirm | Buttons, links, items |
| **B** | Cancel / Back / Close | Modals, dialogs, widgets |
| **X** | Secondary action | Toggle filters, open details |
| **Y** | Tertiary action | Advanced options, settings |
| **LT** | Scroll up | Long lists, trade listings |
| **RT** | Scroll down | Long lists, trade listings |
| **LB** | Previous tab / preset | Tabs, filter presets |
| **RB** | Next tab / preset | Tabs, filter presets |
| **L3** | Focus previous widget | Multiple widgets |
| **R3** | Focus next widget | Multiple widgets |
| **START** | Open settings menu | Any widget |
| **SELECT** | Toggle gamepad navigation | On/Off |
| **L3+R3** | Open price-check | Already implemented |

## Implementation Plan

### Phase 1: Focus System Foundation (Priority: High)

**Files to modify:**
- `renderer/src/web/overlay/FocusManager.ts` (new)
- `renderer/src/web/overlay/OverlayWindow.vue`

**Tasks:**
1. Create `FocusManager` class
   - Track focused element (ref)
   - `focusNext(direction)` method
   - `focusPrevious(direction)` method
   - `getFocusableElements()` method
   - `highlightElement(element)` method

2. Integrate into `OverlayWindow.vue`
   - Inject `FocusManager` into widget context
   - Expose via `provide` to all widgets

3. Add CSS for focus highlight
   - Create `.gamepad-focused` class
   - Add outline/glow effect

**Estimated time:** 4-6 hours

### Phase 2: Gamepad Navigation Actions (Priority: High)

**Files to modify:**
- `renderer/src/web/gamepad/index.ts`

**Tasks:**
1. Add new action types to `GamepadAction`:
   ```typescript
   type: 'navigate-up' | 'navigate-down' | 'navigate-left' | 'navigate-right' |
         'activate' | 'cancel' | 'secondary' | 'tertiary' |
         'scroll-up' | 'scroll-down' | 'prev-tab' | 'next-tab' |
         'prev-widget' | 'next-widget'
   ```

2. Add button mappings to `DEFAULT_CONFIG`:
   ```typescript
   { button: 'UP', action: { type: 'navigate-up' } },
   { button: 'DOWN', action: { type: 'navigate-down' } },
   { button: 'LEFT', action: { type: 'navigate-left' } },
   { button: 'RIGHT', action: { type: 'navigate-right' } },
   { button: 'A', action: { type: 'activate' } },
   { button: 'B', action: { type: 'cancel' } },
   { button: 'X', action: { type: 'secondary' } },
   { button: 'Y', action: { type: 'tertiary' } },
   { button: 'LT', action: { type: 'scroll-up' } },
   { button: 'RT', action: { type: 'scroll-down' } },
   { button: 'LB', action: { type: 'prev-tab' } },
   { button: 'RB', action: { type: 'next-tab' } }
   ```

3. Update `emitAction()` to send navigation events to active widget

**Estimated time:** 2-3 hours

### Phase 3: Widget-Specific Navigation (Priority: High)

**Files to modify:**
- `renderer/src/web/price-check/PriceCheckWindow.vue`
- `renderer/src/web/price-check/CheckedItem.vue`
- `renderer/src/web/price-check/filters/FiltersBlock.vue`
- `renderer/src/web/settings/SettingsWindow.vue`

**Tasks:**

#### 3.1 Price-Check Widget

**PriceCheckWindow.vue:**
- Add event listeners for gamepad navigation
- Handle `activate` on search button
- Handle `cancel` to close widget (already implemented)
- Handle `secondary` to toggle advanced check
- Handle `tertiary` to open league selection

**CheckedItem.vue:**
- Add `tabindex` attributes to trade listing rows
- Handle `navigate-up`/`navigate-down` to move through listings
- Handle `activate` to click selected listing
- Add `.gamepad-focused` class styling to selected row

**FiltersBlock.vue:**
- Add `tabindex` to filter buttons
- Handle navigation through filters (left/right, up/down)
- Handle `activate` to toggle filter
- Handle `prev-tab`/`next-tab` to switch presets

#### 3.2 Settings Widget

**SettingsWindow.vue:**
- Add `tabindex` to menu items
- Handle navigation through menu (up/down)
- Handle `activate` to select menu item
- Handle `navigate-right` to move to content area

**Estimated time:** 8-12 hours

### Phase 4: Scroll and Tab Navigation (Priority: Medium)

**Files to modify:**
- `renderer/src/web/price-check/trade/TradeListing.vue`
- Various filter components

**Tasks:**
1. Implement scroll handlers (LT/RT):
   - `scroll-up`: Scroll element up by viewport height / 2
   - `scroll-down`: Scroll element down by viewport height / 2

2. Implement tab/preset handlers (LB/RB):
   - `prev-tab`: Switch to previous preset/tab
   - `next-tab`: Switch to next preset/tab

3. Add visual indicators:
   - Show active preset with border/color
   - Show active tab clearly

**Estimated time:** 4-6 hours

### Phase 5: Widget Focus Management (Priority: Low)

**Files to modify:**
- `renderer/src/web/overlay/OverlayWindow.vue`
- `main/src/main.ts`

**Tasks:**
1. Add widget-to-widget navigation (L3/R3):
   - Focus previous/next widget when visible
   - Cycle through visible widgets

2. Add START button to open settings:
   - Map START button to open settings widget

3. Add SELECT button to toggle gamepad navigation:
   - Enable/disable gamepad navigation
   - Save preference to config

**Estimated time:** 3-4 hours

### Phase 6: Testing and Polish (Priority: High)

**Files to modify:**
- All modified files

**Tasks:**
1. Test each navigation path:
   - Navigate through trade listings
   - Navigate through filters
   - Navigate through settings menu
   - Scroll long lists
   - Switch tabs/presets

2. Fix edge cases:
   - Focus boundaries (first/last element)
   - Hidden elements (skip disabled items)
   - Dynamic content (listings loaded async)

3. Add configuration options:
   - Gamepad navigation enable/disable
   - Navigation speed (hold duration)
   - Focus style (color, thickness)

4. Update documentation:
   - Add gamepad controls to user guide
   - Add visual indicators for gamepad users

**Estimated time:** 4-6 hours

## Technical Details

### Focus Element Selection

Focusable elements should be identified by:
```typescript
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[data-focusable="true"]'
  ].join(', ')

  return Array.from(container.querySelectorAll<HTMLElement>(selector))
}
```

### Visual Feedback

CSS for focused elements:
```css
.gamepad-focused {
  outline: 3px solid #fbbf24; /* amber-400 */
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.4);
  z-index: 10;
}

.gamepad-focused button {
  background: rgba(251, 191, 36, 0.2);
}

.gamepad-focused tr {
  background: rgba(251, 191, 36, 0.15);
}
```

### Event Flow

```
Gamepad Input
    ↓
GamepadManager::poll()
    ↓
emitAction(actionConfig)
    ↓
Host.sendEvent({ name: 'RENDERER->MAIN::gamepad-action' })
    ↓
Main Process (optional - if needed for global state)
    ↓
MainProcess.sendEvent({ name: 'MAIN->CLIENT::widget-action' })
    ↓
Active Widget Component
    ↓
FocusManager::navigate(direction)
    ↓
DOM Element Update (highlight, scroll, click)
```

## Potential Issues and Solutions

### Issue 1: Focus Lost on Dynamic Content

**Problem:** Listings are loaded asynchronously, focus can be lost.

**Solution:**
- Re-focus to first element when content changes
- Use `MutationObserver` to detect DOM changes
- Store focus path, restore after re-render

### Issue 2: Scrolling Conflicts

**Problem:** D-pad scroll vs. navigation in same list.

**Solution:**
- Use D-pad for navigation
- Use LT/RT for scrolling
- Add delay/debounce for scroll
- Allow D-pad to scroll when at focus boundary

### Issue 3: Multiple Interactive Layers

**Problem:** Overlays, modals, popovers need separate focus contexts.

**Solution:**
- Use focus stack to track nested contexts
- ESC/B closes top context
- Focus manager handles multiple layers

### Issue 4: Performance

**Problem:** Polling 60 times per second may impact performance.

**Solution:**
- Reduce poll frequency to 30ms (was 20ms)
- Only process when widget is active
- Use `requestAnimationFrame` for DOM updates
- Debounce focus highlights

## Configuration

Add to `GamepadConfig` interface:
```typescript
interface GamepadConfig {
  enabled: boolean;
  navigationEnabled: boolean; // New
  focusStyle: {
    color: string;
    width: string;
    blur: string;
  };
  scrollSpeed: number; // pixels per LT/RT press
  actions: GamepadActionConfig[];
}
```

## Migration Path

1. **Phase 1** - Implement focus system, no user-facing changes
2. **Phase 2** - Add navigation actions, still internal
3. **Phase 3** - Enable navigation in price-check widget (first usable feature)
4. **Phase 4** - Enhance price-check navigation
5. **Phase 5** - Add widget-level navigation
6. **Phase 6** - Polish and extend to other widgets

## Success Criteria

- [x] B button closes price-check widget (already implemented)
- [ ] D-pad navigates through trade listings
- [ ] A button clicks selected listing/item
- [ ] LT/RT scrolls through long listings
- [ ] LB/RB switches between filter presets
- [ ] Gamepad navigation works in settings
- [ ] Focus is clearly visible
- [ ] Performance is acceptable (no lag)
- [ ] Configuration options available
- [ ] Documentation updated

## Additional Considerations

### Accessibility

The focus system should also benefit keyboard-only users:
- Reuse gamepad focus for keyboard (Tab, arrows, Enter)
- Ensure proper ARIA labels
- Support standard keyboard shortcuts

### Internationalization

Add translation keys:
```typescript
'gamepad.navigation': 'Gamepad Navigation',
'gamepad.enable': 'Enable Gamepad Navigation',
'gamepad.focus_style': 'Focus Style',
'gamepad.scroll_speed': 'Scroll Speed'
```

### Future Enhancements

1. **Voice commands** - Add navigation via voice (optional)
2. **Gesture-based** - Use analog stick gestures
3. **Haptic feedback** - Vibrate on focus change (if supported)
4. **Custom button mappings** - Allow users to remap buttons
5. **Profiles** - Different button layouts for different contexts

## Summary

This plan provides a comprehensive approach to adding gamepad navigation to the Awakened PoE Trade overlay. The implementation is modular, allowing for incremental delivery of features while maintaining code quality and performance.

**Total estimated time:** 25-37 hours
**Total files to modify:** ~15 files
**Total new files:** 1 (FocusManager)

The focus on modularity and phased delivery ensures that users can start benefiting from the feature as soon as Phase 3 is complete, while maintaining a clear path for future enhancements.
