import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

/**
 * Back that never leaves the app: steps through in-app history when there is
 * any, otherwise lands on the picker (deep link, shared link, cold open).
 */
export function useGoBack() {
  const navigate = useNavigate()
  const { key } = useLocation()

  return useCallback(() => {
    if (key === 'default') navigate('/', { replace: true })
    else navigate(-1)
  }, [key, navigate])
}
