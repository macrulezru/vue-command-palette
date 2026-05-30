<script setup lang="ts" generic="T">
import { computed, nextTick, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  items: T[]
  itemHeight: number
  containerHeight: number
  overscan?: number
  /** Index (into `items`) that should always be kept in view. */
  activeIndex?: number
}>(), {
  overscan: 3,
  activeIndex: -1,
})

const containerEl = ref<HTMLElement>()
const scrollTop = ref(0)

function scrollIndexIntoView(index: number) {
  if (index < 0) return
  const el = containerEl.value
  if (!el) return
  const top = index * props.itemHeight
  const bottom = top + props.itemHeight
  if (top < el.scrollTop) {
    el.scrollTop = top
  } else if (bottom > el.scrollTop + props.containerHeight) {
    el.scrollTop = bottom - props.containerHeight
  }
}

watch(() => props.activeIndex, (i) => {
  nextTick(() => scrollIndexIntoView(i))
})

const totalHeight = computed(() => props.items.length * props.itemHeight)

const firstIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.overscan)
)

const lastIndex = computed(() => {
  const visible = Math.ceil(props.containerHeight / props.itemHeight)
  return Math.min(props.items.length - 1, firstIndex.value + visible + props.overscan * 2)
})

const offsetY = computed(() => firstIndex.value * props.itemHeight)

const visibleItems = computed(() =>
  props.items.slice(firstIndex.value, lastIndex.value + 1).map((data, i) => ({
    data,
    index: firstIndex.value + i,
  }))
)

function onScroll(e: Event) {
  scrollTop.value = (e.target as HTMLElement).scrollTop
}

// Reset scroll on items change
watch(() => props.items, () => {
  scrollTop.value = 0
  if (containerEl.value) containerEl.value.scrollTop = 0
})

defineExpose({ containerEl })
</script>

<template>
  <div ref="containerEl" class="vcp-virtual" :style="{ height: containerHeight + 'px', overflowY: 'auto' }" @scroll.passive="onScroll">
    <div :style="{ height: totalHeight + 'px', position: 'relative' }">
      <div :style="{ transform: `translateY(${offsetY}px)` }">
        <slot v-for="item in visibleItems" :key="item.index" :item="item.data" :index="item.index" />
      </div>
    </div>
  </div>
</template>
