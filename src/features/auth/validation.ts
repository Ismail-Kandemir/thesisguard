import type {
  ForgotPasswordFormValues,
  FormErrors,
  LoginFormValues,
  RegisterFormValues,
} from './types'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateRequired(value: string, fieldName: string) {
  return value.trim() ? '' : `${fieldName} zorunludur.`
}

function validateEmail(value: string) {
  if (!value.trim()) {
    return 'E-posta zorunludur.'
  }

  return emailPattern.test(value) ? '' : 'Geçerli bir e-posta adresi girin.'
}

export function validateLoginForm(values: LoginFormValues) {
  const errors: FormErrors<LoginFormValues> = {}

  const emailError = validateEmail(values.email)
  const passwordError = validateRequired(values.password, 'Şifre')

  if (emailError) {
    errors.email = emailError
  }

  if (passwordError) {
    errors.password = passwordError
  }

  return errors
}

export function validateRegisterForm(values: RegisterFormValues) {
  const errors: FormErrors<RegisterFormValues> = {}

  const fullNameError = validateRequired(values.fullName, 'Ad Soyad')
  const emailError = validateEmail(values.email)
  const passwordError = validateRequired(values.password, 'Şifre')
  const confirmPasswordError = validateRequired(values.confirmPassword, 'Şifre Tekrar')

  if (fullNameError) {
    errors.fullName = fullNameError
  }

  if (emailError) {
    errors.email = emailError
  }

  if (passwordError) {
    errors.password = passwordError
  }

  if (confirmPasswordError) {
    errors.confirmPassword = confirmPasswordError
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Şifreler eşleşmelidir.'
  }

  return errors
}

export function validateForgotPasswordForm(values: ForgotPasswordFormValues) {
  const errors: FormErrors<ForgotPasswordFormValues> = {}
  const emailError = validateEmail(values.email)

  if (emailError) {
    errors.email = emailError
  }

  return errors
}
