import { Fragment, type ReactNode } from 'react'

const TOKEN = /\*([^*]+)\*|\{(\w+)\}/g

interface Props {
  text: string
  slots?: Record<string, ReactNode>
}

export function Rich({ text, slots }: Props) {
  const parts: ReactNode[] = []
  let last = 0
  let key = 0

  TOKEN.lastIndex = 0
  for (let match = TOKEN.exec(text); match; match = TOKEN.exec(text)) {
    if (match.index > last) parts.push(text.slice(last, match.index))

    if (match[1] !== undefined) {
      parts.push(<b key={key++}>{match[1]}</b>)
    } else {
      const slot = slots?.[match[2]!]
      parts.push(slot === undefined ? match[0] : <Fragment key={key++}>{slot}</Fragment>)
    }

    last = match.index + match[0].length
  }

  if (last < text.length) parts.push(text.slice(last))

  return <>{parts}</>
}
