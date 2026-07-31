import type { ButtonHTMLAttributes } from 'react'
import type { ComponentSize } from '../../types'
import './Button.css'

type ButtonVariant = 'primary' | 'secondary'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ComponentSize
}

export function Button({
  children,
  className = '',
  size = 'md',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const buttonClassName = ['button', `button--${variant}`, `button--${size}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={buttonClassName} type={type} {...props}>
      {children}
    </button>
  )
}
