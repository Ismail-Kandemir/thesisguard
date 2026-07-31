import type { FormEvent } from 'react'
import { useState } from 'react'
import { validateRegisterForm } from '../features/auth'
import type { FormErrors, RegisterFormValues } from '../features/auth'
import { Button, Card, Container, Input } from '../shared'
import './AuthPages.css'

const initialRegisterValues: RegisterFormValues = {
  confirmPassword: '',
  email: '',
  fullName: '',
  password: '',
}

export function RegisterPage() {
  const [values, setValues] = useState<RegisterFormValues>(initialRegisterValues)
  const [errors, setErrors] = useState<FormErrors<RegisterFormValues>>({})

  function updateField(field: keyof RegisterFormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateRegisterForm(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length === 0) {
      console.log('Register form submitted:', values)
    }
  }

  return (
    <Container className="auth-page">
      <Card className="auth-card">
        <div className="auth-card__header">
          <h1 className="auth-card__title">Register Page</h1>
          <p className="auth-card__description">Yeni ThesisGuard hesabı oluşturun.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <Input
            errorMessage={errors.fullName}
            id="register-full-name"
            label="Ad Soyad"
            onChange={(event) => updateField('fullName', event.target.value)}
            value={values.fullName}
          />
          <Input
            errorMessage={errors.email}
            id="register-email"
            label="E-posta"
            onChange={(event) => updateField('email', event.target.value)}
            type="email"
            value={values.email}
          />
          <Input
            errorMessage={errors.password}
            id="register-password"
            label="Şifre"
            onChange={(event) => updateField('password', event.target.value)}
            type="password"
            value={values.password}
          />
          <Input
            errorMessage={errors.confirmPassword}
            id="register-confirm-password"
            label="Şifre Tekrar"
            onChange={(event) => updateField('confirmPassword', event.target.value)}
            type="password"
            value={values.confirmPassword}
          />
          <div className="auth-form__actions">
            <Button type="submit">Kayıt Ol</Button>
          </div>
        </form>
      </Card>
    </Container>
  )
}
