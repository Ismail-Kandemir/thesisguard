export const routePaths = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  dashboard: '/dashboard',
  upload: '/upload',
  report: '/report',
  notFound: '*',
} as const

export type RoutePath = (typeof routePaths)[keyof typeof routePaths]
