import {useEffect, useRef, useState} from 'react'

export function useCopy(value: string, resetAfter = 1800) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    const plain = value.replace(/\s+/g, '')
    try {
      await navigator.clipboard.writeText(plain)
    } catch {
      const field = document.createElement('textarea')
      field.value = plain
      field.style.position = 'fixed'
      field.style.opacity = '0'
      document.body.append(field)
      field.select()
      document.execCommand('copy')
      field.remove()
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), resetAfter)
  }

  return { copied, copy }
}
