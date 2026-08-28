import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon, RotateCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Attrape les erreurs React (render, lifecycle) qui sortiraient du tree.
 * Sans ça, n'importe quelle exception → écran blanc + console muette pour l'utilisateur.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log pour le dev. En prod on enverrait à Sentry / un endpoint de télémétrie.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return <DefaultFallback error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--bg)",
      }}
    >
      <div className="card card-pad" style={{ maxWidth: 520, textAlign: "center" }}>
        <div
          style={{
            width: 64, height: 64, margin: "0 auto 20px",
            borderRadius: "50%", background: "var(--danger-50)",
            display: "grid", placeItems: "center",
            color: "var(--danger-500)",
          }}
        >
          <AlertOctagon size={28} />
        </div>
        <h1
          style={{
            fontSize: 22, fontWeight: 600, color: "var(--navy-900)",
            letterSpacing: "-0.02em", margin: 0,
          }}
        >
          Quelque chose s'est mal passé.
        </h1>
        <p
          className="muted"
          style={{ fontSize: 14, marginTop: 8, lineHeight: 1.55 }}
        >
          Une erreur inattendue a empêché l'affichage de cette page. Tu peux
          réessayer ou recharger la page.
        </p>
        <details
          style={{
            marginTop: 20, padding: 14,
            background: "var(--surface-2)", borderRadius: "var(--r-md)",
            textAlign: "left", fontSize: 12,
            fontFamily: "var(--font-mono)", color: "var(--ink-700)",
            border: "1px solid var(--border)",
          }}
        >
          <summary style={{ cursor: "pointer", color: "var(--ink-500)" }}>
            Détails techniques
          </summary>
          <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {error.name}: {error.message}
          </pre>
        </details>
        <div className="row gap-3" style={{ marginTop: 24, justifyContent: "center" }}>
          <button className="btn btn-outline" onClick={() => window.location.reload()}>
            Recharger la page
          </button>
          <button className="btn btn-primary" onClick={onReset}>
            <RotateCw size={16} /> Réessayer
          </button>
        </div>
      </div>
    </div>
  );
}
