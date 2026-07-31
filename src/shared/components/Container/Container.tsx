import type { HTMLAttributes } from 'react'
import './Container.css'

export type ContainerProps = HTMLAttributes<HTMLDivElement>

export function Container({ children, className = '', ...props }: ContainerProps) {
  const containerClassName = ['container', className].filter(Boolean).join(' ')

  return (
    <div className={containerClassName} {...props}>
      {children}
    </div>
  )
}
