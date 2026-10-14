import { ErrorPage } from '../components/ErrorPage'

export function NotFoundPage({ path }) {
  return <ErrorPage code={404} path={path} />
}
