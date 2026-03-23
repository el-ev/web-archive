import { createHashRouter } from 'react-router-dom'
import { routes } from '@generouted/react-router'

const router = createHashRouter(routes)

function isAuthenticated(): boolean {
  return localStorage.getItem('token') !== null
}

function logOut() {
  if (!isAuthenticated())
    return
  localStorage.removeItem('token')
  router.navigate('/login')
}

export {
  logOut,
  isAuthenticated,
}

export default router
