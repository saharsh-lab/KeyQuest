import { useCallback } from 'react'
import { useStore } from '@/game/store'
import { playError, playHit, playKey, playSuccess } from '@/lib/sound'

export function useSound() {
  const { settings } = useStore()
  const { sound, volume, soundProfile, errorSound } = settings
  return {
    key: useCallback((correct: boolean) => {
      if (!sound) return
      if (!correct && errorSound) playError(volume)
      else playKey(soundProfile, volume)
    }, [sound, volume, soundProfile, errorSound]),
    success: useCallback(() => sound && playSuccess(volume), [sound, volume]),
    hit: useCallback(() => sound && playHit(volume), [sound, volume]),
  }
}
