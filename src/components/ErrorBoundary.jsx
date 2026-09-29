import { Component } from 'react'

/** If a screen crashes, show a friendly message with the error (to report it) instead of a blank page. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Puly se rompió:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="status-screen">
        <div className="status-box">
          <h1 className="screen-title">Uy, algo salió mal</h1>
          <p className="muted-sm">Probá de nuevo. Si vuelve a pasar, mandale una captura de esta pantalla a quien te pasó la app.</p>
          <code className="error-code">{String(this.state.error?.message ?? this.state.error)}</code>
          <div className="detail-actions">
            <button type="button" className="btn btn-glass btn-lg" onClick={() => this.setState({ error: null })}>Reintentar</button>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => window.location.reload()}>Recargar</button>
          </div>
        </div>
      </main>
    )
  }
}
