import type { RouteObject } from 'react-router-dom';
import Layout from './components/Layout';
import { Home } from './pages/Home';

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      {
        index: true,
        path: '/',
        Component: Home,
      },
      {
        path: 'about',
        element: <h1>About</h1>,
      },
    ],
  },
];
