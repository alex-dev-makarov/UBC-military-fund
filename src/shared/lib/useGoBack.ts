import { useLocation, useNavigate } from 'react-router'

export function useGoBack() {
  const navigate = useNavigate()
  const { key } = useLocation()

  return () => {
    if (key === 'default') navigate('/', { replace: true })
    else navigate(-1)
  }
}
