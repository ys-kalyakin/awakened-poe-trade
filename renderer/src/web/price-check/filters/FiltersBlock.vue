<template>
  <div ref="filtersBlockEl">
    <div class="flex flex-wrap items-center pb-3 gap-2">
      <filter-btn-numeric v-if="filters.linkedSockets"
        :filter="filters.linkedSockets" :name="t('item.linked_sockets')" tabindex="0" />
      <filter-btn-numeric v-if="filters.mapTier"
        :filter="filters.mapTier" :name="t('item.map_tier')" tabindex="0" />
      <filter-btn-logical v-if="filters.mapCompletionReward" readonly
        :filter="{ disabled: false }" :text="t('item.map_foil_reward', [filters.mapCompletionReward.name])" tabindex="0" />
      <filter-btn-numeric v-if="filters.areaLevel"
        :filter="filters.areaLevel" :name="t('item.area_level')" tabindex="0" />
      <filter-btn-numeric v-if="filters.heistWingsRevealed"
        :filter="filters.heistWingsRevealed" :name="t('item.heist_wings_revealed')" tabindex="0" />
      <filter-btn-numeric v-if="filters.sentinelCharge"
        :filter="filters.sentinelCharge" :name="t('item.sentinel_charge')" tabindex="0" />
      <filter-btn-logical v-if="filters.mapBlighted" readonly
        :filter="{ disabled: false }" :text="filters.mapBlighted.value" tabindex="0" />
      <filter-btn-logical v-if="filters.discriminator?.value" readonly
        :filter="{ disabled: false }" :text="filters.discriminator.value" tabindex="0" />
      <filter-btn-numeric v-if="filters.itemLevel"
        :filter="filters.itemLevel" :name="t('item.item_level')" tabindex="0" />
      <filter-btn-numeric v-if="filters.stackSize"
        :filter="filters.stackSize" :name="t('item.stock')" tabindex="0" />
      <filter-btn-numeric v-if="filters.whiteSockets"
        :filter="filters.whiteSockets" :name="t('item.white_sockets')" tabindex="0" />
      <filter-btn-numeric v-if="filters.gemLevel"
        :filter="filters.gemLevel" :name="t('item.gem_level')" tabindex="0" />
      <filter-btn-numeric v-if="filters.quality"
        :filter="filters.quality" :name="t('item.quality')" tabindex="0" />
      <template v-if="filters.influences">
        <filter-btn-logical v-for="influence of filters.influences" :key="influence.value"
          :filter="influence" :text="influence.value" :img="`/images/influence-${influence.value}.png`" tabindex="0" />
      </template>
      <filter-btn-logical v-if="filters.rarity?.value === 'magic'"
        :filter="filters.rarity" text="Magic" tabindex="0" />
      <filter-btn-logical v-if="filters.unidentified"
        :filter="filters.unidentified" :text="t('item.unidentified')" tabindex="0" />
      <filter-btn-logical v-if="filters.veiled"
        :filter="filters.veiled" :text="t('item.veiled')" tabindex="0" />
      <filter-btn-logical v-if="filters.foil"
        :filter="filters.foil" :text="t('item.foil_unique')" tabindex="0" />
      <filter-btn-logical v-if="filters.mirrored && !filters.mirrored.hidden" active
        :filter="filters.mirrored" :text="t(filters.mirrored.disabled ? 'item.not_mirrored' : 'item.mirrored')" tabindex="0" />
      <filter-btn-logical v-if="filters.split && !filters.split.hidden" active
        :filter="filters.split" :text="t(filters.split.disabled ? 'item.not_split' : 'item.split')" tabindex="0" />
      <filter-btn-logical v-if="hasStats"
        :collapse="statsVisibility.disabled"
        :filter="statsVisibility"
        :active="totalSelectedMods > 0"
        :text="(totalSelectedMods > 0)
          ? t('filters.selected_some', [totalSelectedMods, stats.length])
          : t('filters.selected_none')"
      />
    </div>
    <div v-if="!statsVisibility.disabled && hasStats" class="mb-4" :class="(presets.length > 1) ? 'mt-1' : 'mt-4'">
        <div class="flex" v-if="presets.length > 1">
          <div class="w-5 border-b border-gray-700" />
          <div class="flex divide-x border-gray-700 border-t border-l border-r rounded-t overflow-hidden">
            <button v-for="preset in presets"
              :class="[$style.presetBtn, { [$style.active]: preset.active }]"
              @click="selectPreset(preset.id)"
              tabindex="0"
            >{{ t(preset.id) }}</button>
          </div>
          <div class="flex-1 border-b border-gray-700" />
        </div>
        <filter-modifier v-for="(filter, idx) of filteredStats" :key="idx"
          :filter="filter"
          :item="item"
          :show-sources="showFilterSources"
          @filter-toggled="$emit('filter-toggled')" />
        <div v-if="!filteredStats.length && !showUnknownMods"
          class="border-b border-gray-700 py-2">{{ t('filters.empty') }}</div>
        <template v-if="showUnknownMods">
          <unknown-modifier v-for="stat of item.unknownModifiers" :key="stat.type + '/' + stat.text"
            :stat="stat" />
        </template>
       <div class="flex gap-x-4">
        <button tabindex="0" @click="statsVisibility.disabled = !statsVisibility.disabled" class="bg-gray-700 px-2 py-1 text-gray-400 leading-none rounded-b w-40"
          data-skip-focus="true"
          >{{ t('filters.collapse') }} <i class="fas fa-chevron-up pl-1 text-xs text-gray-600"></i></button>
        <ui-toggle v-if="filteredStats.length != stats.length"
          v-model="showHidden" class="text-gray-400 pt-2" :tabindex="0">{{ t('filters.hidden_toggle') }}</ui-toggle>
        <ui-toggle
          v-model="showFilterSources" class="ml-auto text-gray-400 pt-2" :tabindex="0">{{ t('filters.mods_toggle') }}</ui-toggle>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, watch, shallowRef, shallowReactive, computed, PropType, onMounted, onUnmounted, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import UiToggle from '@/web/ui/UiToggle.vue'
import FilterModifier from './FilterModifier.vue'
import FilterBtnNumeric from './FilterBtnNumeric.vue'
import FilterBtnLogical from './FilterBtnLogical.vue'
import UnknownModifier from './UnknownModifier.vue'
import { ItemFilters, StatFilter } from './interfaces'
import { ParsedItem, ItemRarity, ItemCategory } from '@/parser'
import { MainProcess, Host } from '@/web/background/IPC'
import type { FocusManager } from '@/web/overlay/FocusManager'
import { inject } from 'vue'

export default defineComponent({
  name: 'FiltersBlock',
  emits: ['preset', 'filter-toggled'],
  components: {
    FilterModifier,
    FilterBtnNumeric,
    FilterBtnLogical,
    UnknownModifier,
    UiToggle
  },
  props: {
    presets: {
      type: Array as PropType<Array<{ id: string, active: boolean }>>,
      required: true
    },
    filters: {
      type: Object as PropType<ItemFilters>,
      required: true
    },
    stats: {
      type: Array as PropType<StatFilter[]>,
      required: true
    },
    item: {
      type: Object as PropType<ParsedItem>,
      required: true
    }
  },
  setup (props, ctx) {
    const statsVisibility = shallowReactive({ disabled: false })
    const showHidden = shallowRef(false)
    const filtersBlockEl = ref<HTMLElement | null>(null)
    const focusManager = inject<FocusManager>('focusManager')

    function navigatePreset (direction: 'left' | 'right') {
      const activePresetIndex = props.presets.findIndex(p => p.active)
      const currentPresetIndex = activePresetIndex >= 0 ? activePresetIndex : 0

      if (direction === 'left' && props.presets.length > 1) {
        const newIndex = (currentPresetIndex - 1 + props.presets.length) % props.presets.length
        ctx.emit('preset', props.presets[newIndex].id)
      } else if (direction === 'right' && props.presets.length > 1) {
        const newIndex = (currentPresetIndex + 1) % props.presets.length
        ctx.emit('preset', props.presets[newIndex].id)
      }
    }

    if (focusManager) {
      MainProcess.onEvent('MAIN->CLIENT::gamepad-navigation', (e) => {
        if (!focusManager) return

        const activePresetIndex = props.presets.findIndex(p => p.active)
        const currentPresetIndex = activePresetIndex >= 0 ? activePresetIndex : 0

        switch (e.type) {
          case 'navigate-left':
          case 'prev-tab':
            if (props.presets.length > 1) {
              navigatePreset('left')
            }
            break
          case 'navigate-right':
          case 'next-tab':
            if (props.presets.length > 1) {
              navigatePreset('right')
            }
            break
          case 'activate':
            // Don't call activateFocused again - it's already handled by click
            break
        }
      })

      onUnmounted(() => {
        if (focusManager) {
          focusManager.popContext()
        }
      })
    }
    const showFilterSources = shallowRef(false)

    watch(() => props.item, () => {
      showHidden.value = false
      statsVisibility.disabled = false
    })

    const showUnknownMods = computed(() =>
      props.item.unknownModifiers.length &&
      props.item.category !== ItemCategory.Sentinel &&
      props.item.category !== ItemCategory.Map
    )

    const { t } = useI18n()

    return {
      filtersBlockEl,
      t,
      statsVisibility,
      showHidden,
       showFilterSources,
       totalSelectedMods: computed(() => {
         return props.stats.filter(stat => !stat.disabled).length
       }),
       filteredStats: computed(() => {
         if (showHidden.value) {
           return props.stats.filter(s => s.hidden)
         } else {
           return props.stats.filter(s => !s.hidden)
         }
       }),
       showUnknownMods,
        hasStats: computed(() =>
          props.stats.length ||
          (showUnknownMods.value && props.item.rarity === ItemRarity.Unique) ||
          props.presets.length > 1),
         selectPreset (id: string) {
           ctx.emit('preset', id)
         }
    }
  }
})
</script>

<style lang="postcss" module>
.presetBtn {
  @apply border-gray-700 bg-gray-800;
  @apply px-2;
  min-width: 3rem;

  &:hover {
    @apply bg-gray-700;
  }

  &.active {
    background: linear-gradient(to bottom, theme('colors.gray.900'), theme('colors.gray.800'));
  }
}
</style>
