// Shown when a screen's data fails to load, so a failure never looks like "nothing here".
export default function LoadError({ message, onRetry }) {
  return (
    <div className="error-state" role="alert">
      <p>Couldn't load this screen.</p>
      {message && <p className="error-detail">{message}</p>}
      <button className="btn btn-primary btn-sm" onClick={onRetry}>Try again</button>
    </div>
  )
}
