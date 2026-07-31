import type { InputHTMLAttributes } from 'react'
import './Input.css'

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  errorMessage?: string
}

export function Input({ className = '', errorMessage, id, label, ...props }: InputProps) {
  const inputClassName = ['input', errorMessage ? 'input--error' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <label className="input-field" htmlFor={id}>
      {label ? <span className="input-field__label">{label}</span> : null}
      <input className={inputClassName} id={id} {...props} />
      {errorMessage ? <span className="input-field__error">{errorMessage}</span> : null}
    </label>
  )
}
