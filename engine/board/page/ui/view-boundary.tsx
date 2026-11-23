import { Component, type ReactNode } from 'react';

type Props = Readonly<{
  snapshot: unknown;
  fallback: ReactNode;
  onFail?: () => void;
  children: ReactNode;
}>;
type State = Readonly<{ hasFailed: boolean }>;

export class ViewBoundary extends Component<Props, State> {
  override state: State = { hasFailed: false };

  static getDerivedStateFromError(): State {
    return { hasFailed: true };
  }

  override componentDidCatch() {
    this.props.onFail?.();
  }

  override componentDidUpdate(previous: Props, before: State) {
    // The commit that caught the error can hold a new snapshot, and a retry there throws again.
    if (before.hasFailed && this.state.hasFailed && previous.snapshot !== this.props.snapshot)
      this.setState({ hasFailed: false });
  }

  override render() {
    return this.state.hasFailed ? this.props.fallback : this.props.children;
  }
}
