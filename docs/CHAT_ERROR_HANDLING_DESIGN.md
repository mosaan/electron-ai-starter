# チャットエラーハンドリングの設計方針

このドキュメントでは、AI チャット機能におけるエラーハンドリングとユーザー体験の設計方針を定義します。

## 目次

- [背景と問題](#背景と問題)
- [設計の目的](#設計の目的)
- [エラーハンドリングの基本方針](#エラーハンドリングの基本方針)
- [UI/UX 設計](#uiux-設計)
- [エラーの種類と対応](#エラーの種類と対応)
- [実装詳細](#実装詳細)
- [ユーザーフロー](#ユーザーフロー)
- [今後の拡張性](#今後の拡張性)

---

## 背景と問題

### 現在の問題

チャットメッセージの送信が失敗した場合、以下の問題が発生しています：

1. **フィードバック不足**: エラーが発生しても、チャット履歴エリアが白紙で表示され、何が起きたのか分からない
2. **メッセージの喪失**: 送信失敗したメッセージがどこにも残らず、ユーザーは再入力を強いられる
3. **リトライの困難**: エラー後に同じメッセージを再送信するには、全て手動で再入力する必要がある
4. **原因の不明瞭**: ネットワークエラー、認証エラー、レート制限など、エラーの種類が分からない

### 影響を受けるユーザーシナリオ

- ネットワーク接続が不安定な環境での利用
- API キーが無効または期限切れの場合
- レート制限に達した場合
- プロキシ設定が正しくない場合
- AI プロバイダー側のサービス障害

---

## 設計の目的

### 主要な目標

1. **エラーの可視化**: ユーザーに何が起きたかを明確に伝える
2. **メッセージの保護**: 送信失敗したメッセージを失わない
3. **リトライの容易性**: ワンクリックで再送信できる
4. **編集の柔軟性**: 失敗したメッセージを編集してから再送信できる
5. **原因の明確化**: エラーの種類に応じた適切なメッセージとアクションを提供

### 設計原則

- **非破壊的**: ユーザーが入力した内容を失わない
- **直感的**: 次に何をすべきか明確
- **文脈に応じた対応**: エラーの種類に応じて適切なガイダンスを提供
- **シンプル**: 複雑な UI を避け、基本的な操作で解決できる

---

## エラーハンドリングの基本方針

### 自動入力復元パターン

エラー発生時、以下の動作を行います：

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant I as 入力フィールド
    participant C as チャット履歴
    participant A as AI API

    U->>I: メッセージを入力
    U->>I: 送信ボタンをクリック
    I->>C: メッセージを表示（送信中）
    I->>A: API リクエスト
    A-->>I: エラーレスポンス
    I->>C: エラーメッセージを表示
    I->>I: 失敗したメッセージを自動復元
    Note over I: ユーザーは編集可能
    U->>I: [オプション] メッセージを編集
    U->>I: 再送信
```

### 主要な動作

1. **エラーメッセージの表示**: チャット履歴内に、ユーザーメッセージの直後にエラーメッセージを表示
2. **自動復元**: 失敗したメッセージを入力フィールドに自動的に復元
3. **フォーカス**: 入力フィールドにフォーカスを移動（すぐに編集・再送信可能）
4. **状態の保持**: 入力フィールドには復元されたメッセージが残り、ユーザーが編集または再送信できる

---

## UI/UX 設計

### エラーメッセージコンポーネント

チャット履歴内に表示されるエラーメッセージの構造：

```
┌─────────────────────────────────────────────────┐
│ ⚠️ メッセージの送信に失敗しました                │
│                                                 │
│ ネットワーク接続を確認してください。              │
│ 入力フィールドにメッセージが復元されています。     │
│                                                 │
│ [詳細を表示] [設定を開く]                        │
└─────────────────────────────────────────────────┘
```

#### デザイン要素

- **アイコン**: ⚠️（警告）または ❌（エラー）を使用
- **背景色**: 薄いオレンジまたは薄い赤（`bg-orange-50` / `bg-red-50`）
- **境界線**: オレンジまたは赤（`border-orange-200` / `border-red-200`）
- **テキスト**: エラーの種類に応じた説明
- **アクションボタン**:
  - 「詳細を表示」（技術的なエラー詳細を展開）
  - 「設定を開く」（設定に関連するエラーの場合のみ表示）

### 入力フィールドの状態

```
┌─────────────────────────────────────────────────┐
│ このメッセージの送信に失敗しました。              │
│ 編集して再送信するか、そのまま送信してください。   │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│ [復元されたメッセージがここに表示される]          │
│                                                 │
└─────────────────────────────────────────────────┘
          [再送信] [クリア]
```

#### インタラクション

- **復元時**: 入力フィールドにメッセージが自動的に入り、フォーカスが移動
- **編集可能**: ユーザーは自由にメッセージを編集できる
- **再送信**: 「送信」ボタンをクリックして再送信
- **クリア**: 復元されたメッセージを削除し、新しいメッセージを入力できる

---

## エラーの種類と対応

### エラーカテゴリー

| エラーの種類 | 原因例 | メッセージ | アクション |
|-------------|--------|-----------|-----------|
| **ネットワークエラー** | 接続タイムアウト、DNS解決失敗 | "ネットワーク接続を確認してください。" | リトライ、プロキシ設定確認 |
| **認証エラー** | 無効な API キー、期限切れ | "API キーが無効です。設定を確認してください。" | 設定画面へのリンク |
| **レート制限** | API 呼び出し上限 | "レート制限に達しました。しばらく待ってから再試行してください。" | 待機時間の表示 |
| **モデル選択エラー** | モデル未選択、無効なモデル | "モデルが選択されていません。" | モデル選択画面へのリンク |
| **プロバイダーエラー** | サービス障害、無効な設定 | "AI プロバイダーからエラーが返されました。" | 詳細表示、設定確認 |
| **不明なエラー** | その他の予期しないエラー | "予期しないエラーが発生しました。" | 詳細表示、ログ確認 |

### エラーメッセージの構造

```typescript
interface ChatError {
  // エラーの種類（カテゴリー）
  type: 'network' | 'auth' | 'rate_limit' | 'model_selection' | 'provider' | 'unknown'

  // ユーザー向けメッセージ
  message: string

  // 技術的な詳細（オプション、展開可能）
  details?: {
    statusCode?: number
    errorCode?: string
    errorMessage?: string
    timestamp: string
  }

  // 推奨されるアクション
  actions?: Array<{
    type: 'retry' | 'settings' | 'details'
    label: string
  }>
}
```

### エラー判定ロジック

```typescript
function categorizeError(error: unknown): ChatError {
  // ネットワークエラー
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: 'ネットワーク接続を確認してください。',
      actions: [{ type: 'retry', label: '再試行' }]
    }
  }

  // HTTP ステータスコードベースの判定
  if (error instanceof Response) {
    if (error.status === 401 || error.status === 403) {
      return {
        type: 'auth',
        message: 'API キーが無効です。設定を確認してください。',
        actions: [
          { type: 'settings', label: '設定を開く' },
          { type: 'retry', label: '再試行' }
        ]
      }
    }

    if (error.status === 429) {
      return {
        type: 'rate_limit',
        message: 'レート制限に達しました。しばらく待ってから再試行してください。',
        actions: [{ type: 'retry', label: '再試行' }]
      }
    }
  }

  // デフォルト
  return {
    type: 'unknown',
    message: '予期しないエラーが発生しました。',
    details: {
      errorMessage: String(error),
      timestamp: new Date().toISOString()
    },
    actions: [
      { type: 'details', label: '詳細を表示' },
      { type: 'retry', label: '再試行' }
    ]
  }
}
```

---

## 実装詳細

### コンポーネント構造

```
Thread (assistant-ui)
├── Message (ユーザーメッセージ)
├── ErrorMessage (新規コンポーネント)
│   ├── ErrorIcon
│   ├── ErrorTitle
│   ├── ErrorDescription
│   └── ErrorActions
│       ├── ShowDetailsButton
│       └── GoToSettingsButton
└── Message (AI レスポンス)
```

### 状態管理

```typescript
interface ChatState {
  // 現在の入力値
  inputValue: string

  // 送信失敗したメッセージ（復元用）
  failedMessage: string | null

  // 最後のエラー情報
  lastError: ChatError | null

  // メッセージ履歴
  messages: Array<{
    id: string
    role: 'user' | 'assistant' | 'error'
    content: string
    error?: ChatError
  }>
}
```

### 送信エラー時の処理フロー

```typescript
async function handleSendMessage(message: string) {
  try {
    // メッセージを履歴に追加
    addMessage({ role: 'user', content: message })

    // AI API を呼び出し
    const response = await sendToAI(message)

    // 成功: AI レスポンスを表示
    addMessage({ role: 'assistant', content: response })

  } catch (error) {
    // エラーを分類
    const chatError = categorizeError(error)

    // エラーメッセージを履歴に追加
    addMessage({
      role: 'error',
      content: chatError.message,
      error: chatError
    })

    // 失敗したメッセージを入力フィールドに復元
    restoreMessageToInput(message)

    // 入力フィールドにフォーカス
    focusInput()
  }
}

function restoreMessageToInput(message: string) {
  setInputValue(message)
  setFailedMessage(message)
}
```

### エラーメッセージコンポーネント

```typescript
interface ErrorMessageProps {
  error: ChatError
  onRetry?: () => void
  onGoToSettings?: () => void
}

function ErrorMessage({ error, onRetry, onGoToSettings }: ErrorMessageProps) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <Alert variant="destructive" className="my-2">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>メッセージの送信に失敗しました</AlertTitle>
      <AlertDescription>
        <p>{error.message}</p>
        <p className="text-sm mt-1">
          入力フィールドにメッセージが復元されています。
        </p>

        {showDetails && error.details && (
          <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
            <pre>{JSON.stringify(error.details, null, 2)}</pre>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          {error.details && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? '詳細を隠す' : '詳細を表示'}
            </Button>
          )}

          {error.type === 'auth' || error.type === 'model_selection' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onGoToSettings}
            >
              <Settings className="mr-1 h-3 w-3" />
              設定を開く
            </Button>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  )
}
```

### Assistant UI との統合

Assistant UI のカスタムコンポーネント機能を使用して、エラーメッセージを統合します：

```typescript
import { Thread } from '@assistant-ui/react'

function ChatThread() {
  return (
    <Thread
      components={{
        Message: CustomMessage,
        ErrorMessage: ErrorMessage
      }}
    />
  )
}

function CustomMessage({ message }) {
  if (message.role === 'error') {
    return <ErrorMessage error={message.error} />
  }

  return <DefaultMessage message={message} />
}
```

---

## ユーザーフロー

### 正常系フロー

```mermaid
graph TB
    Start([ユーザーがメッセージを入力]) --> Send[送信ボタンをクリック]
    Send --> Display[チャット履歴に表示]
    Display --> API[AI API にリクエスト]
    API --> Success{成功?}
    Success -->|Yes| Response[AI レスポンスを表示]
    Response --> End([完了])
```

### エラー時のフロー

```mermaid
graph TB
    Start([ユーザーがメッセージを入力]) --> Send[送信ボタンをクリック]
    Send --> Display[チャット履歴に表示]
    Display --> API[AI API にリクエスト]
    API --> Error[エラー発生]
    Error --> Categorize[エラーを分類]
    Categorize --> ShowError[エラーメッセージを表示]
    ShowError --> Restore[入力フィールドに復元]
    Restore --> Focus[フォーカスを移動]
    Focus --> UserAction{ユーザーの操作}

    UserAction -->|編集| Edit[メッセージを編集]
    UserAction -->|そのまま再送信| Retry[再送信]
    UserAction -->|設定を開く| Settings[設定画面へ遷移]
    UserAction -->|詳細を表示| Details[技術的な詳細を表示]
    UserAction -->|クリア| Clear[入力をクリア]

    Edit --> Retry
    Retry --> Send
    Settings --> Configure[設定を変更]
    Configure --> Back[チャットに戻る]
    Back --> Retry
    Details --> UserAction
    Clear --> End([完了])
```

### リトライのフロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant I as 入力フィールド
    participant C as チャット履歴
    participant A as AI API

    Note over U,A: 初回送信失敗
    U->>I: メッセージ入力・送信
    I->>A: API リクエスト
    A-->>I: エラー
    I->>C: エラーメッセージ表示
    I->>I: メッセージを復元

    Note over U,A: ユーザーが再試行を選択
    U->>I: [オプション] メッセージ編集
    U->>I: 送信ボタンをクリック
    I->>A: 再リクエスト
    A-->>I: 成功レスポンス
    I->>C: AI レスポンスを表示
    I->>I: 入力フィールドをクリア
```

---

## 今後の拡張性

### フェーズ 1: 基本的なエラーハンドリング（現在）

- ✅ エラーメッセージの表示
- ✅ 自動入力復元
- ✅ 基本的なエラー分類

### フェーズ 2: エラー情報の充実

- ⬜ より詳細なエラーカテゴリー
- ⬜ エラー履歴の保存
- ⬜ エラー統計の表示（設定画面）

### フェーズ 3: リトライの最適化

- ⬜ 指数バックオフによる自動リトライ
- ⬜ リトライカウンターの表示
- ⬜ レート制限を考慮した待機時間の計算

### フェーズ 4: オフライン対応

- ⬜ オフライン検出
- ⬜ メッセージのキューイング
- ⬜ オンライン復帰時の自動送信

### フェーズ 5: 高度な診断機能

- ⬜ ネットワーク診断ツール
- ⬜ 接続テストの統合
- ⬜ トラブルシューティングウィザード

### 検討事項

1. **パフォーマンス**: エラー発生時の UI レスポンスを最適化
2. **アクセシビリティ**: スクリーンリーダー対応、キーボード操作
3. **国際化**: エラーメッセージの多言語対応
4. **テスト**: エラーシナリオの自動テスト
5. **ログ収集**: エラー情報をログに記録し、デバッグを容易にする

---

## 参考資料

- [Electron AI Starter - IPC Communication Deep Dive](./IPC_COMMUNICATION_DEEP_DIVE.md)
- [Electron AI Starter - AI Settings V2 Design](./AI_SETTINGS_V2_DESIGN.md)
- [Assistant UI Documentation](https://github.com/assistant-ui/react)
- [Vercel AI SDK - Error Handling](https://sdk.vercel.ai/docs/guides/error-handling)

---

**最終更新**: 2025-11-12
