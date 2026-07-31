import { createBrowserRouter } from 'react-router-dom'
import { routePaths } from '../constants/routePaths'
import { MainLayout } from '../../layouts/MainLayout'
import { DashboardPage } from '../../pages/DashboardPage'
import { ForgotPasswordPage } from '../../pages/ForgotPasswordPage'
import { HomePage } from '../../pages/HomePage'
import { LoginPage } from '../../pages/LoginPage'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { RegisterPage } from '../../pages/RegisterPage'
import { ReportPage } from '../../pages/ReportPage'
import { UploadPage } from '../../pages/UploadPage'

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      {
        path: routePaths.home,
        element: <HomePage />,
      },
      {
        path: routePaths.login,
        element: <LoginPage />,
      },
      {
        path: routePaths.register,
        element: <RegisterPage />,
      },
      {
        path: routePaths.forgotPassword,
        element: <ForgotPasswordPage />,
      },
      {
        path: routePaths.dashboard,
        element: <DashboardPage />,
      },
      {
        path: routePaths.upload,
        element: <UploadPage />,
      },
      {
        path: routePaths.report,
        element: <ReportPage />,
      },
      {
        path: routePaths.notFound,
        element: <NotFoundPage />,
      },
    ],
  },
])
