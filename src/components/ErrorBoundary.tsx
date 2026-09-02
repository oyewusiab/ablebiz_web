import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // You can log error info here
    // console.error(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, textAlign: "center", color: "#b91c1c", background: "rgba(255,255,255,0.85)", borderRadius: 16, margin: 32 }}>
          <h2 style={{ fontSize: 24, fontWeight: 900 }}>Something went wrong.</h2>
          <pre style={{ marginTop: 16, color: "#991b1b", fontSize: 16 }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
