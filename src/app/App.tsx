import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router'
import { I18nProvider } from '@shared/i18n'
import { store } from './store'
import { Layout } from './Layout'
import './styles/index.css'

export function App() {
  return (
    <Provider store={store}>
      <I18nProvider>
        <BrowserRouter>
          <Layout />
        </BrowserRouter>
      </I18nProvider>
    </Provider>
  )
}
