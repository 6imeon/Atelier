import React from "react";

interface Props {
  fallbackLabel: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            background: "#0A0A0F",
            color: "#fff",
            padding: 24,
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            minHeight: 120,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {this.props.fallbackLabel} crashed
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, maxWidth: 360, textAlign: "center", wordBreak: "break-word" }}>
            {this.state.error?.message ?? "Unknown error"}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 4,
              padding: "6px 16px",
              background: "#222",
              color: "#fff",
              border: "1px solid #444",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
