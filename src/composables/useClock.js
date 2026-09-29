import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ZONE_LABEL, formatClockDate, formatClockTime } from '../lib/datetime.js'

/**
 * A live clock, shared by the side rail and the chat panel.
 *
 * Deliberately **not** the visitor's local time. A clock with no timezone on it
 * is ambiguous — two people looking at the same page would read two different
 * times and neither would know whose it was. For a portfolio the useful
 * question is "what time is it for the person I am trying to reach", so this is
 * pinned to the owner's timezone and labelled with it. Recruiters in another
 * country can work out their own offset from that.
 *
 * Ticks once a second because a `setInterval` that has to resynchronise with the
 * minute boundary is more code than it saves. The cost is contained anyway: both
 * formatted strings are computed values, so nothing re-renders until the
 * displayed minute actually changes.
 *
 * The formatting lives in `lib/datetime.js`, shared with the assistant's answer,
 * so the panel and the reply cannot disagree about the timezone.
 */
export function useClock() {
  const now = ref(Date.now())

  let timer = 0

  onMounted(() => {
    timer = window.setInterval(() => {
      now.value = Date.now()
    }, 1000)
  })

  onBeforeUnmount(() => {
    window.clearInterval(timer)
  })

  const time = computed(() => formatClockTime(now.value))
  const date = computed(() => formatClockDate(now.value))

  return { time, date, zone: ZONE_LABEL }
}
