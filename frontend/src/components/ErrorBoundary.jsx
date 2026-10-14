import { Component } from 'react'
import { ErrorPage } from './ErrorPage'

export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorPage
          code={500}
          onHome={() => {
            window.location.href = '/'
          }}
          onRetry={() => window.location.reload()}
        />
      )
    }
    return this.props.children
  }
}
