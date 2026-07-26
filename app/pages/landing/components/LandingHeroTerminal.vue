<script setup lang="ts">
import { Motion } from 'motion-v'
import type { TerminalSegment } from '../content/types'

defineProps<{
  title: string
  lines: Array<{ segments: TerminalSegment[] }>
}>()

const segmentStyles: Record<string, string> = {
  prompt: 'text-muted',
  cmd: 'text-highlighted',
  flag: 'text-primary',
  dim: 'text-muted',
  success: 'text-success',
  url: 'text-info'
}

function lineMotion(index: number) {
  return {
    initial: { opacity: 0, x: -4 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.4, delay: 1.4 + index * 0.4 }
  }
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-default bg-elevated/50 backdrop-blur ring-1 ring-white/2">
    <div class="flex items-center justify-between border-b border-default p-4 sm:px-6">
      <div class="flex items-center gap-1.5">
        <span v-for="index in 3" :key="index" class="size-2.5 rounded-full border border-default bg-muted" />
      </div>
      <span class="font-mono text-[11px] uppercase text-muted">{{ title }}</span>
    </div>

    <div class="min-h-[200px] p-5 font-mono text-[13px] leading-[1.8] sm:p-6">
      <Motion v-for="(line, lineIndex) in lines" :key="lineIndex" v-bind="lineMotion(lineIndex)">
        <span
          v-for="(segment, segmentIndex) in line.segments"
          :key="segmentIndex"
          :class="segmentStyles[segment.style]"
        >
          {{ segment.text }}
        </span>
      </Motion>
    </div>
  </div>
</template>
