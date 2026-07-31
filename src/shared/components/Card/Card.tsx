import type { HTMLAttributes } from 'react'
import './Card.css'

export type CardProps = HTMLAttributes<HTMLDivElement>

export function Card({ children, className = '', ...props }: CardProps) {
  const cardClassName = ['card', className].filter(Boolean).join(' ')

  return (
    <div className={cardClassName} {...props}>
      {children}
    </div>
  )
}
