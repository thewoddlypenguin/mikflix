import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppShell } from './components/layout'
import { Home } from './screens/Home'
import { Library } from './screens/Library'
import { Inventory } from './screens/Inventory'
import { TitleDetail } from './screens/TitleDetail'
import { Wishlist } from './screens/Wishlist'
import { Admin } from './screens/Admin'
import { NotFound } from './screens/NotFound'

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/library', element: <Library /> },
      { path: '/inventory', element: <Inventory /> },
      { path: '/title/:titleId', element: <TitleDetail /> },
      { path: '/wishlist', element: <Wishlist /> },
      { path: '/admin', element: <Admin /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}