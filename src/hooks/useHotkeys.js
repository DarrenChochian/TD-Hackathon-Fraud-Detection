import { useState, useEffect } from 'react'

export function useHotkeys() {
  const [hotkey, setHotkey] = useState('Alt+K')
  const [mainPanelHotkey, setMainPanelHotkey] = useState('Alt+L')
  const [mainPanelHotkeyFailed, setMainPanelHotkeyFailed] = useState(false)
  const [settingsHotkeyFailed, setSettingsHotkeyFailed] = useState(false)

  useEffect(() => {
    window.electronAPI?.getHotkey?.().then((res) => {
      if (res?.accelerator) setHotkey(res.accelerator)
    })
    window.electronAPI?.getMainPanelHotkey?.().then((res) => {
      if (res?.accelerator) setMainPanelHotkey(res.accelerator)
    })
  }, [])

  useEffect(() => {
    const unsubRegistration = window.electronAPI?.onHotkeyRegistrationResult?.((result) => {
      console.log('[renderer] hotkey:registration-result', result)
      if (result?.settings) {
        setHotkey(result.settings.accelerator)
        setSettingsHotkeyFailed(!result.settings.ok)
      }
      if (result?.mainPanel) {
        setMainPanelHotkey(result.mainPanel.accelerator)
        setMainPanelHotkeyFailed(!result.mainPanel.ok)
      }
    })
    return () => {
      unsubRegistration?.()
    }
  }, [])

  return {
    hotkey,
    setHotkey,
    mainPanelHotkey,
    setMainPanelHotkey,
    mainPanelHotkeyFailed,
    settingsHotkeyFailed,
  }
}
