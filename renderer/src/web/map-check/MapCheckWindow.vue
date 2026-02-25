<template>
  <div
    style="top: 0; left: 0; height: 100%; width: 100%; position: absolute;"
    class="flex grow h-full pointer-events-none" :class="{
    'flex-row': clickPosition === 'stash',
    'flex-row-reverse': clickPosition === 'inventory',
  }">
    <div class="layout-column shrink-0"
      style="width: var(--game-panel);">
    </div>
    <div class="layout-column shrink-0 pointer-events-auto" style="min-width: 20rem; max-width: min(100vw - var(--game-panel), 30rem);">
      <AppTitleBar @close="closeMapCheck" :title="title">
        <div class="w-8" />
      </AppTitleBar>
      <div class="grow layout-column min-h-0 bg-gray-800">
        <template v-if="item?.isOk()">
          <MapCheck
            :item="item.value"
            :config="config.maps" />
        </template>
        <template v-else-if="item?.isErr()">
          <ui-error-box class="m-4">
            <template #name>{{ t(item.error.name) }}</template>
            <p>{{ t(item.error.message) }}</p>
          </ui-error-box>
          <pre class="bg-gray-900 rounded m-4 overflow-x-hidden p-2">{{ item.error.rawText }}</pre>
        </template>
      </div>
    </div>
    <div class="layout-column flex-1 min-w-0">
      <div class="flex" :class="{
        'flex-row': clickPosition === 'stash',
        'flex-row-reverse': clickPosition === 'inventory'
      }">
        <rate-limiter-state class="pointer-events-auto" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, inject, PropType, shallowRef, watch, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Result, ok, err } from 'neverthrow'
import UiErrorBox from '@/web/ui/UiErrorBox.vue'
import { MainProcess } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { ItemCategory, ItemRarity, parseClipboard, ParsedItem } from '@/parser'
import AppTitleBar from '@/web/ui/AppTitlebar.vue'
import MapCheck from './MapCheck.vue'
import RateLimiterState from '@/web/price-check/trade/RateLimiterState.vue'
import { MapCheckWidget, WidgetManager, WidgetSpec } from '../overlay/interfaces'
import type { FocusManager } from '../overlay/FocusManager'

type ParseError = { name: string; message: string; rawText: ParsedItem['rawText'] }

export default defineComponent({
  widget: {
    type: 'map-check',
    instances: 'single',
    initInstance: (): MapCheckWidget => {
      return {
        wmId: 0,
        wmType: 'map-check',
        wmTitle: '',
        wmWants: 'hide',
        wmZorder: 'exclusive',
        wmFlags: ['hide-on-blur', 'menu::skip'],
        hotkey: null,
        maps: {
          profile: 1,
          showNewStats: false,
          selectedStats: [
            { matcher: '#% maximum Player Resistances', decision: 'w--' },
            { matcher: 'Monsters reflect #% of Physical Damage', decision: 'd--' },
            { matcher: 'Monsters reflect #% of Elemental Damage', decision: 'd--' },
            { matcher: 'Area contains two Unique Bosses', decision: 'g--' }
          ]
        }
      }
    }
  } satisfies WidgetSpec,
  components: {
    AppTitleBar,
    MapCheck,
    RateLimiterState,
    UiErrorBox
  },
  props: {
    config: {
      type: Object as PropType<MapCheckWidget>,
      required: true
    }
  },
  setup (props) {
    const wm = inject<WidgetManager>('wm')!
    const focusManager = inject<FocusManager>('focusManager')

    if (!focusManager) {
      console.warn('[MapCheckWindow] FocusManager not available')
    }

    nextTick(() => {
      props.config.wmWants = 'hide'
      props.config.wmFlags = ['hide-on-blur', 'menu::skip']
    })

    const item = shallowRef<null | Result<ParsedItem, ParseError>>(null)
    const clickPosition = shallowRef<'stash' | 'inventory'>('stash')

    const title = computed(() => {
      if (item.value?.isOk()) {
        return item.value.value.info.name || 'Map Check'
      }
      return 'Map Check'
    })

    MainProcess.onEvent('MAIN->CLIENT::item-text', (e) => {
      if (e.target !== 'map-check') return

      closeMapCheck()

      clickPosition.value = e.position.x > (window.screenX + window.innerWidth / 2)
        ? 'inventory'
        : 'stash'

      item.value = (e.item ? ok(e.item as ParsedItem) : parseClipboard(e.clipboard))
        .andThen(item => (
          (item.category === ItemCategory.Map && item.rarity !== ItemRarity.Unique) ||
          item.category === ItemCategory.HeistContract ||
          item.category === ItemCategory.HeistBlueprint ||
          item.category === ItemCategory.Invitation ||
          item.info.refName === 'Expedition Logbook')
          ? ok(item)
          : err('item.unknown'))
        .mapErr(err => ({
          name: `${err}`,
          message: `${err}_help`,
          rawText: e.clipboard
        }))

      if (focusManager && item.value?.isOk()) {
        nextTick(() => {
          // Focus manager will handle navigation
        })
      }
    })

    function closeMapCheck () {
      item.value = null
      wm.hide(props.config.wmId)
    }

    return {
      t: useI18n().t,
      item,
      title,
      clickPosition,
      closeMapCheck
    }
  }
})
</script>

<style scoped>
.layout-column {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
