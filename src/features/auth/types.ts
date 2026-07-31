export type LoginFormValues = {
  email: string
  password: string
}

export type RegisterFormValues = {
  fullName: string
  email: string
  password: string
  confirmPassword: string
}

export type ForgotPasswordFormValues = {
  email: string
}

export type FormErrors<TFormValues extends Record<string, string>> = Partial<
  Record<keyof TFormValues, string>
>
