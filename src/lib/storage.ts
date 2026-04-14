import { useEffect, useState } from "react"

const KEY_PREFIX = "offprint:"

export function useChromeBoolean(
  key: string,
  defaultValue = false
): [boolean, (v: boolean) => void] {
  const fullKey = KEY_PREFIX + key
  const [value, setValue] = useState<boolean>(defaultValue)

  useEffect(() => {
    try {
      chrome?.storage?.local?.get([fullKey], (res) => {
        if (res && typeof res[fullKey] === "boolean") {
          setValue(res[fullKey])
        }
      })
    } catch {
      // ignore — chrome.storage not available
    }

    const onChanged = (
      changes: { [k: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area !== "local") return
      if (fullKey in changes && typeof changes[fullKey].newValue === "boolean") {
        setValue(changes[fullKey].newValue)
      }
    }

    try {
      chrome?.storage?.onChanged?.addListener(onChanged)
    } catch {
      /* noop */
    }
    return () => {
      try {
        chrome?.storage?.onChanged?.removeListener(onChanged)
      } catch {
        /* noop */
      }
    }
  }, [fullKey])

  const update = (v: boolean) => {
    setValue(v)
    try {
      chrome?.storage?.local?.set({ [fullKey]: v })
    } catch {
      /* noop */
    }
  }

  return [value, update]
}
