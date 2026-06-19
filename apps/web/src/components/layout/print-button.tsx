'use client'

import type { ReactNode } from 'react'

type PrintButtonProps = {
  children: ReactNode
  className?: string
}

export default function PrintButton({ children, className }: PrintButtonProps) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {children}
    </button>
  )
}
