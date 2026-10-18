import { Component } from 'react';
import ErrorState from './ErrorState';

/** Catches render errors so a broken page never white-screens the whole app. */
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('HIMI UI error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="section-shell py-16">
          <ErrorState
            title="This page hit a snag"
            description="Something unexpected happened while rendering this page. Your saved chats are safe."
            actionLabel="Reload page"
            onAction={() => window.location.reload()}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
