import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import type { AISettingsV2, AIModelPreset } from '@common/types'
import { isOk } from '@common/result'
import { logger } from '@renderer/lib/logger'

interface PresetSelectorProps {
  selectedPresetId: string | null
  onPresetChange: (presetId: string | null) => void
}

export function PresetSelector({
  selectedPresetId,
  onPresetChange
}: PresetSelectorProps): React.JSX.Element {
  const [settings, setSettings] = useState<AISettingsV2 | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async (): Promise<void> => {
    try {
      await window.connectBackend()
      const result = await window.backend.getAISettingsV2()
      if (isOk(result)) {
        setSettings(result.value)

        // If no preset is selected, use default or first available
        if (!selectedPresetId) {
          const defaultId = result.value.defaultPresetId || result.value.presets[0]?.id
          if (defaultId) {
            onPresetChange(defaultId)
          }
        }
      } else {
        logger.error('Failed to load AI settings v2:', result.error)
      }
    } catch (error) {
      logger.error('Failed to load AI settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getPresetLabel = (preset: AIModelPreset): string => {
    // Check if provider has API key configured
    const providerConfig = settings?.providers[preset.provider]
    const hasApiKey = providerConfig?.apiKey && providerConfig.apiKey.length > 0

    return hasApiKey ? preset.name : `${preset.name} (not configured)`
  }

  const isPresetDisabled = (preset: AIModelPreset): boolean => {
    const providerConfig = settings?.providers[preset.provider]
    return !providerConfig?.apiKey || providerConfig.apiKey.length === 0
  }

  if (isLoading || !settings) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Loading..." />
        </SelectTrigger>
      </Select>
    )
  }

  if (settings.presets.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="No presets configured" />
        </SelectTrigger>
      </Select>
    )
  }

  return (
    <Select value={selectedPresetId || undefined} onValueChange={onPresetChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select preset" />
      </SelectTrigger>
      <SelectContent>
        {settings.presets.map((preset) => (
          <SelectItem
            key={preset.id}
            value={preset.id}
            disabled={isPresetDisabled(preset)}
          >
            {getPresetLabel(preset)}
            {settings.defaultPresetId === preset.id && ' ⭐'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
