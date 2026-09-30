import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught React rendering error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--surface, #F8FAFC)",
            padding: 24,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: "100%",
              background: "white",
              padding: 36,
              borderRadius: 16,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)",
              border: "1px solid #E2E8F0",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "#FEF2F2",
                color: "#EF4444",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 20px auto",
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Une erreur inattendue est survenue
            </h2>

            <p style={{ fontSize: 14, color: "#64748B", marginTop: 10, lineHeight: 1.6 }}>
              L'application a rencontré un problème technique temporaire. Vos données et vos votes restent en sécurité.
            </p>

            {this.state.error && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: "#F1F5F9",
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: "monospace",
                  color: "#475569",
                  textAlign: "left",
                  overflowX: "auto",
                  maxHeight: 100,
                }}
              >
                {this.state.error.message}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 28,
                justifyContent: "center",
              }}
            >
              <button
                onClick={this.handleReload}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  background: "#0A2540",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <RefreshCw size={16} /> Recharger la page
              </button>

              <button
                onClick={this.handleGoHome}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  background: "transparent",
                  color: "#475569",
                  border: "1px solid #CBD5E1",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <Home size={16} /> Accueil
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
