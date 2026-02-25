<template>
  <div v-if="show">
    <div v-show="itemFilters" class="p-4 layout-column min-h-0">
    <filter-name
      :filters="itemFilters"
      :item="item" />
    <price-prediction v-if="showPredictedPrice" class="mb-4"
      :item="item" />
    <price-trend v-else
      :item="item"
      :filters="itemFilters" />
    <filters-block
      ref="filtersComponent"
      :filters="itemFilters"
      :stats="itemStats"
      :item="item"
      :presets="presets"
      @preset="selectPreset"
      @submit="doSearch = true"
      @filter-toggled="handleFilterToggledEvent" />
    <trade-listing
      v-if="tradeAPI === 'trade' && doSearch"
      ref="tradeService"
      :filters="itemFilters"
      :stats="itemStats"
      :item="item" />
    <trade-bulk
      v-if="tradeAPI === 'bulk' && doSearch"
      ref="tradeService"
      :filters="itemFilters"
      :item="item" />
    <div v-if="!doSearch && shouldShowSearchButton" class="flex justify-between items-center">
      <div class="flex w-40" @mouseenter="handleSearchMouseenter">
         <button id="price-check-search-btn" class="btn" @click="doSearch = true" style="min-width: 5rem;" tabindex="0">{{ t('Search') }}</button>
      </div>
      <trade-links v-if="tradeAPI === 'trade'"
        :get-link="makeTradeLink" />
    </div>
    <div v-else-if="doSearch && !tradeService" class="flex justify-between items-center">
      <div class="flex w-40">
         <div class="text-gray-500 px-2 py-1">Loading...</div>
      </div>
    </div>
    <stack-value :filters="itemFilters" :item="item"/>
    <div v-if="showSupportLinks" class="mt-auto border border-dashed p-2">
      <div class="mb-1">{{ t('Support development on') }} <a href="https://patreon.com/awakened_poe_trade" class="inline-flex align-middle animate__animated animate__fadeInRight" target="_blank"><img class="inline h-5" src="/images/Patreon.svg"></a></div>
      <i18n-t keypath="app.thanks_3rd_party" tag="div">
        <a href="https://poeprices.info" target="_blank" class="bg-gray-900 px-1 rounded">poeprices.info</a>
        <a href="https://poe.ninja/support" target="_blank" class="bg-gray-900 px-1 rounded">poe.ninja</a>
      </i18n-t>
    </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, watch, ref, nextTick, computed, ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { ItemRarity, ItemCategory, ParsedItem } from '@/parser'
import TradeListing from './trade/TradeListing.vue'
import TradeBulk from './trade/TradeBulk.vue'
import TradeLinks from './trade/TradeLinks.vue'
import { apiToSatisfySearch, getTradeEndpoint } from './trade/common'
import PriceTrend from './trends/PriceTrend.vue'
import FiltersBlock from './filters/FiltersBlock.vue'
import { createPresets } from './filters/create-presets'
import PricePrediction from './price-prediction/PricePrediction.vue'
import StackValue from './stack-value/StackValue.vue'
import FilterName from './filters/FilterName.vue'
import { CATEGORY_TO_TRADE_ID, createTradeRequest } from './trade/pathofexile-trade'
import { AppConfig } from '@/web/Config'
import { FilterPreset } from './filters/interfaces'
import { PriceCheckWidget } from '../overlay/interfaces'
import type { FocusManager } from '../overlay/FocusManager'
import { MainProcess } from '@/web/background/IPC'
import { useLeagues } from '@/web/background/Leagues'
import { inject, onMounted } from 'vue'

let _showSupportLinksCounter = 0

export default defineComponent({
  name: 'CheckedItem',
  components: {
    PricePrediction,
    TradeListing,
    TradeBulk,
    TradeLinks,
    PriceTrend,
    FiltersBlock,
    FilterName,
    StackValue
  },
  props: {
    item: {
      type: Object as PropType<ParsedItem>,
      required: true
    },
    advancedCheck: {
      type: Boolean,
      required: true
    }
  },
  setup (props) {
    const widget = computed(() => AppConfig<PriceCheckWidget>('price-check')!)
    const leagues = useLeagues()

    const presets = ref<{ active: string, presets: FilterPreset[] }>(null!)
    const itemFilters = computed(() => {
      const result = presets.value.presets.find(preset => preset.id === presets.value.active)!.filters
      return result
    })
    const itemStats = computed(() => presets.value.presets.find(preset => preset.id === presets.value.active)!.stats)
    const doSearch = ref(false)
    const tradeAPI = ref<'trade' | 'bulk'>('bulk')

    const shouldShowSearchButton = computed(() => {
      return !doSearch.value
    })

    // TradeListing.vue OR TradeBulk.vue
    const tradeService = ref<{ execSearch(): void } | null>(null)
    // FiltersBlock.vue
    const filtersComponent = ref<ComponentPublicInstance>(null!)
    const focusManager = inject<FocusManager>('focusManager')

    if (focusManager) {
      onMounted(() => {
        const findContainer = () => {
          const el = document.querySelector('.p-4.layout-column.min-h-0') as HTMLElement
          return el
        }

        const initFocusManager = () => {
          nextTick(() => {
            const container = findContainer()
            if (container && container instanceof HTMLElement) {
              focusManager.setupFocus(container)
              setTimeout(() => {
                focusManager.refreshContext()
                if (!doSearch.value) {
                  focusManager.focusElementBySelector('#price-check-search-btn')
                }
              }, 50)
            }
          })
        }

        initFocusManager()
      })

      MainProcess.onEvent('MAIN->CLIENT::gamepad-navigation', (e) => {
        if (!focusManager) return

        switch (e.type) {
          case 'navigate-up':
          case 'navigate-down':
          case 'navigate-left':
          case 'navigate-right':
            const direction = e.type.split('-')[1] as 'up' | 'down' | 'left' | 'right'
            focusManager.navigate(direction)
            break
          case 'activate':
            focusManager.activateFocused()
            break
          case 'scroll-up':
            focusManager.scrollTo('up')
            break
          case 'scroll-down':
            focusManager.scrollTo('down')
            break
          case 'prev-tab':
            if (props.presets.length > 1) {
              const activePresetIndex = props.presets.findIndex(p => p.active)
              const currentPresetIndex = activePresetIndex >= 0 ? activePresetIndex : 0
              const newIndex = (currentPresetIndex - 1 + props.presets.length) % props.presets.length
              ctx.emit('preset', props.presets[newIndex].id)
            }
            break
          case 'next-tab':
            if (props.presets.length > 1) {
              const activePresetIndex = props.presets.findIndex(p => p.active)
              const currentPresetIndex = activePresetIndex >= 0 ? activePresetIndex : 0
              const newIndex = (currentPresetIndex + 1) % props.presets.length
              ctx.emit('preset', props.presets[newIndex].id)
            }
            break
        }
      })
    }

    watch(() => props.item, (item, prevItem) => {
      const prevCurrency = (presets.value != null) ? itemFilters.value.trade.currency : undefined

      presets.value = createPresets(item, {
        league: leagues.selectedId.value!,
        collapseListings: widget.value.collapseListings,
        activateStockFilter: widget.value.activateStockFilter,
        searchStatRange: widget.value.searchStatRange,
        useEn: AppConfig().useIntlSite,
        currency: (prevItem &&
          item.info.namespace === prevItem.info.namespace &&
          item.info.refName === prevItem.info.refName
        ) ? prevCurrency : undefined
      })

      if ((!props.advancedCheck && !widget.value.smartInitialSearch) ||
          (props.advancedCheck && !widget.value.lockedInitialSearch)) {
        doSearch.value = false
      } else {
        doSearch.value = Boolean(
          (item.rarity === ItemRarity.Unique) ||
          (item.category === ItemCategory.Map) ||
          (item.category === ItemCategory.HeistBlueprint) ||
          (item.category === ItemCategory.SanctumRelic) ||
          (item.category === ItemCategory.Charm) ||
          (item.category === ItemCategory.Idol) ||
          (!CATEGORY_TO_TRADE_ID.has(item.category!)) ||
          (item.isUnidentified) ||
          (item.isVeiled)
        )
      }

      tradeAPI.value = apiToSatisfySearch(props.item, itemStats.value, itemFilters.value)

      if (focusManager) {
        nextTick(() => {
          setTimeout(() => {
            focusManager.refreshContext()
            if (!doSearch.value) {
              focusManager.focusElementBySelector('#price-check-search-btn')
            }
          }, 50)
        })
      }
    }, { immediate: true })

    watch(() => [props.item, doSearch.value], () => {
      if (doSearch.value === false) return

      tradeAPI.value = apiToSatisfySearch(props.item, itemStats.value, itemFilters.value)

      // NOTE: child `trade-xxx` component renders/receives props on nextTick
      nextTick(() => {
        if (tradeService.value) {
          tradeService.value.execSearch()
        }
        if (focusManager) {
          setTimeout(() => {
            focusManager.refreshContext()
          }, 50)
        }
      })
    }, { deep: false, immediate: true })

    watch(() => [props.item, doSearch.value, itemStats.value, itemFilters.value], (curr, prev) => {
      const cItem = curr[0]; const pItem = prev[0]
      const cIntaracted = curr[1]; const pIntaracted = prev[1]

      // Don't hide search button when filters change - let user search manually
      // Only hide if search was already triggered (doSearch was true, now false)
      // if (cItem === pItem && cIntaracted === true && pIntaracted === true) {
      //   doSearch.value = false
      // }
    }, { deep: true })

    watch(() => [props.item, JSON.stringify(itemFilters.value.trade)], (curr, prev) => {
      const cItem = curr[0]; const pItem = prev[0]
      const cTrade = curr[1]; const pTrade = prev[1]

      if (cItem === pItem && cTrade !== pTrade) {
        nextTick(() => {
          doSearch.value = true
          if (focusManager) {
            setTimeout(() => {
              focusManager.refreshContext()
            }, 50)
          }
        })
      }
    }, { deep: false })

    watch(() => [props.item, JSON.stringify(itemFilters.value)], (curr, prev) => {
      const cItem = curr[0]; const pItem = prev[0]
      const cFilters = curr[1]; const pFilters = prev[1]

      if (cItem === pItem && cFilters !== pFilters) {
        doSearch.value = false
        if (focusManager) {
          setTimeout(() => {
            focusManager.refreshContext()
            focusManager.focusElementBySelector('#price-check-search-btn')
          }, 100)
        }
      }
    }, { deep: true })

    // Watch for changes in filters (including stats)
    watch(() => props.item && itemFilters.value ? JSON.stringify(itemFilters.value.stats) : null, (newStats, oldStats) => {
      if (props.item && newStats !== oldStats) {
        doSearch.value = false
        if (focusManager) {
          setTimeout(() => {
            focusManager.refreshContext()
            focusManager.focusElementBySelector('#price-check-search-btn')
          }, 100)
        }
      }
    }, { deep: true })

    const showPredictedPrice = computed(() => {
      if (!widget.value.requestPricePrediction ||
          AppConfig().language !== 'en' ||
          !leagues.selected.value!.isPopular) return false

      if (presets.value.active === 'filters.preset_base_item') return false

      return props.item.rarity === ItemRarity.Rare &&
        props.item.category !== ItemCategory.Map &&
        props.item.category !== ItemCategory.CapturedBeast &&
        props.item.category !== ItemCategory.HeistContract &&
        props.item.category !== ItemCategory.HeistBlueprint &&
        props.item.category !== ItemCategory.Invitation &&
        props.item.info.refName !== 'Expedition Logbook' &&
        !props.item.isUnidentified
    })

    const show = computed(() => {
      return !(props.item.rarity === ItemRarity.Unique &&
        props.item.isUnidentified &&
        props.item.info.unique == null)
    })

    function handleSearchMouseenter (e: MouseEvent) {
      if ((filtersComponent.value.$el as HTMLElement).contains(e.relatedTarget as HTMLElement)) {
        doSearch.value = true

        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
      }
    }

    function handleFilterToggledEvent () {
      doSearch.value = false
      if (focusManager) {
        setTimeout(() => {
          focusManager.refreshContext()
          focusManager.focusElementBySelector('#price-check-search-btn')
        }, 100)
      }
    }

    const showSupportLinks = ref(false)
    watch(() => [props.item, doSearch.value], ([cItem, cInteracted], [pItem]) => {
      if (_showSupportLinksCounter >= 13 && (!cInteracted || tradeAPI.value === 'bulk')) {
        showSupportLinks.value = true
        _showSupportLinksCounter = 0
      } else {
        showSupportLinks.value = false
        if (cItem !== pItem) {
          _showSupportLinksCounter += 1
        }
      }
    })

    const { t } = useI18n()

    return {
      t,
      itemFilters,
      itemStats,
      doSearch,
      tradeAPI,
      tradeService,
      filtersComponent,
      showPredictedPrice,
      show,
      shouldShowSearchButton,
      handleSearchMouseenter,
      handleFilterToggledEvent,
      showSupportLinks,
      presets: computed(() => presets.value.presets.map(preset =>
        ({ id: preset.id, active: (preset.id === presets.value.active) }))),
      selectPreset (id: string) {
        presets.value.active = id
        if (focusManager) {
          nextTick(() => {
            focusManager.refreshContext()
          })
        }
      },
      makeTradeLink () {
        return `https://${getTradeEndpoint()}/trade/search/${itemFilters.value.trade.league}?q=${JSON.stringify(createTradeRequest(itemFilters.value, itemStats.value, props.item))}`
      }
    }
  }
})
</script>
