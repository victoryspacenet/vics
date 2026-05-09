import { Component } from 'react'
import { RefreshCw } from 'lucide-react'

/**
 * React Error Boundary - 앱 크래시 시 빈 화면 대신 오류 메시지 표시
 * Cursor Simple Browser 등에서 예기치 않은 에러로 화면이 사라지는 문제 완화
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
          <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
            <p className="text-4xl mb-4">😵</p>
            <h1 className="text-lg font-black text-[#22282E] mb-2">문제가 발생했어요</h1>
            <p className="text-sm text-gray-500 mb-6">
              화면이 예기치 않게 꺼졌을 수 있어요. 새로고침하면 해결될 거예요.
            </p>
            <button
              onClick={this.handleRetry}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#22282E] text-white text-sm font-bold hover:bg-[#363d46] transition-colors"
            >
              <RefreshCw size={16} />
              새로고침
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
