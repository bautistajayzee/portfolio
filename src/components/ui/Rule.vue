<script setup>
/** A hairline that dissolves at both ends, instead of stopping abruptly. */
defineProps({
  ink: { type: Boolean, default: false },
})
</script>

<template>
  <div class="w-full" aria-hidden="true">
    <div class="rule" :class="ink ? 'rule--ink' : ''" />
  </div>
</template>
