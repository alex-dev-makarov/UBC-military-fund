import { BrowserRouter } from 'react-router'
import { I18nProvider } from '@shared/i18n'
import { Layout } from './Layout'
import './styles/index.css'

export function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </I18nProvider>
  )
}
