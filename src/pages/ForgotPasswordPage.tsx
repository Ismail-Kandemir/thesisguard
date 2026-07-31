import type { FormEvent } from 'react'
import { useState } from 'react'
import { validateForgotPasswordForm } from '../features/auth'
import type { ForgotPasswordFormValues, FormErrors } from '../features/auth'
import { Button, Card, Container, Input } from '../shared'
import './AuthPages.css'

const initialForgotPasswordValues: ForgotPasswordFormValues = {
  email: '',
}

export function ForgotPasswordPage() {
  const [values, setValues] = useState<ForgotPasswordFormValues>(initialForgotPasswordValues)
  const [errors, setErrors] = useState<FormErrors<ForgotPasswordFormValues>>({})

  function updateField(field: keyof ForgotPasswordFormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateForgotPasswordForm(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length === 0) {
      console.log('Forgot password form submitted:', values)
    }
  }

  return (
    <Container className="auth-page">
      <Card className="auth-card">
        <div className="auth-card__header">
          <h1 className="auth-card__title">Forgot Password Page</h1>
          <p className="auth-card__description">Şifre sıfırlama akışını başlatın.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <Input
            errorMessage={errors.email}
            id="forgot-password-email"
            label="E-posta"
            onChange={(event) => updateField('email', event.target.value)}
            type="email"
            value={values.email}
          />
          <div className="auth-form__actions">
            <Button type="submit">Şifre Sıfırla</Button>
          </div>
        </form>
      </Card>
    </Container>
  )
}
