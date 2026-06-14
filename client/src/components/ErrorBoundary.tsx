import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: "2rem",
          backgroundColor: "#1a0000",
          color: "#ff6b6b",
          fontFamily: "monospace",
          fontSize: "14px",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            ⚠ Erreur de rendu
          </h1>
          <p style={{ marginBottom: "0.5rem", color: "#ffa8a8" }}>
            {this.state.error.message}
          </p>
          <details style={{ maxWidth: "600px", textAlign: "left", whiteSpace: "pre-wrap" }}>
            <summary style={{ cursor: "pointer", color: "#ffa8a8", marginBottom: "0.5rem" }}>
              Détails techniques
            </summary>
            <pre style={{ fontSize: "11px", color: "#ccc", overflow: "auto" }}>
              {this.state.error.stack}
            </pre>
            {this.state.info?.componentStack && (
              <pre style={{ fontSize: "11px", color: "#999", overflow: "auto", marginTop: "0.5rem" }}>
                {this.state.info.componentStack}
              </pre>
            )}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
