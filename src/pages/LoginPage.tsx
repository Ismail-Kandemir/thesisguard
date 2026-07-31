import type { FormEvent } from 'react'
import { useState } from 'react'
import { validateLoginForm } from '../features/auth'
import type { FormErrors, LoginFormValues } from '../features/auth'
import { Button, Card, Container, Input } from '../shared'
import './AuthPages.css'

const initialLoginValues: LoginFormValues = {
  email: '',
  password: '',
}

export function LoginPage() {
  const [values, setValues] = useState<LoginFormValues>(initialLoginValues)
  const [errors, setErrors] = useState<FormErrors<LoginFormValues>>({})

  function updateField(field: keyof LoginFormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateLoginForm(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length === 0) {
      console.log('Login form submitted:', values)
    }
  }

  return (
    <Container className="auth-page">
      <Card className="auth-card">
        <div className="auth-card__header">
          <h1 className="auth-card__title">Login Page</h1>
          <p className="auth-card__description">ThesisGuard hesabınıza giriş yapın.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <Input
            errorMessage={errors.email}
            id="login-email"
            label="E-posta"
            onChange={(event) => updateField('email', event.target.value)}
            type="email"
            value={values.email}
          />
          <Input
            errorMessage={errors.password}
            id="login-password"
            label="Şifre"
            onChange={(event) => updateField('password', event.target.value)}
            type="password"
            value={values.password}
          />
          <div className="auth-form__actions">
            <Button type="submit">Giriş Yap</Button>
          </div>
        </form>
      </Card>
    </Container>
  )
}
