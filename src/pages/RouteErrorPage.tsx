import { useNavigate } from 'react-router-dom'
import { routePaths } from '../app/constants/routePaths'
import { Button, Card, Container } from '../shared'
import './RouteErrorPage.css'

export function RouteErrorPage() {
  const navigate = useNavigate()

  return (
    <Container className="route-error-page">
      <Card className="route-error-page__card" role="alert">
        <h1>Bir şeyler ters gitti</h1>
        <p>
          Sayfa beklenmedik bir hatayla karşılaştı. Tez yükleme ekranına dönüp
          işlemi yeniden başlatabilirsiniz.
        </p>
        <Button onClick={() => navigate(routePaths.upload)}>
          Tez Yükleme Ekranına Dön
        </Button>
      </Card>
    </Container>
  )
}
