# 設計方針（UC1: Mastraベース基本AI会話MVP）

## ゴール

Mastraを用いたチャット経路を既存3プロセス構成に追加し、Rendererから送信したメッセージがストリーミングで返ってくる最小限のMVPを実現する。既存チャットと干渉せず、後続フェーズでDB永続化やMCP統合を拡張できるようにする。

## アーキテクチャ概要

- BackendにMastra専用サービス層を追加（`src/backend/mastra/`）。
- HandlerにMastra向けAPIを追加し、Connection経由でRendererへイベントを配信。
- RendererにMastraチャット用の薄いクライアントとUIコンポーネントを追加し、ホーム/チャット画面から遷移できる導線を用意。
- 永続化はMVPではインメモリ保持（プロセス終了でクリア）。threadIdを戻すことで将来のDB移行を容易にする。

## Backend設計

### 依存と初期化

- 追加依存: `@mastra/core`（0.24系）、必要に応じてサブパッケージ。AI SDK v5互換のため既存`ai`依存と共存可能。
- Mastra初期化時にAISettingsV2から「enabledなproviderConfigの先頭」を採用し、modelIdも先頭を選択（MVPルール）。APIキーはproviderConfig.config.apiKeyを使用。
- 設定不足の場合は初期化時点でエラーを返し、Rendererに状態を通知。

### サービス構成

- `MastraChatService`: Mastraインスタンス生成、thread管理、ストリーミング実行、abort管理を担当。
- `MastraSessionStore`: `Map<sessionId, { threadId, history: AIMessage[] }>` を保持し、同一sessionIdの追記を許可。
- ストリームは`AbortController`で管理し、`mastraChatAborted`イベントを必ず発火する。
- ログ: 初期化時のモデル/プロバイダー、threadId、チャンク数、エラー内容をINFO/ERRORで記録。

### API/イベント

- `startMastraSession(resourceId?) -> { sessionId, threadId }`  
  - resourceIdは将来用のオプション。内部でMastra Memory/Threadを作成。
- `streamMastraText(sessionId, messages) -> { streamId }`  
  - 指定sessionのhistoryに追記し、Mastraへmessagesを渡してストリーム開始。
- `abortMastraStream(streamId) -> void`
- イベントチャネル（payloadにsessionIdとstreamIdを含む）  
  - `mastraChatChunk` { chunk: string }  
  - `mastraChatEnd`  
  - `mastraChatError` { error: string }  
  - `mastraChatAborted`

### Mastra呼び出し方針

- Mastraのチャット実行API（`@mastra/core`のChat API。型定義を参照し、streaming対応のメソッドを選択）を使用し、AI SDK v5準拠のチャンクをBackendイベントに変換する。
- メッセージは`{ role: 'user' | 'assistant' | 'system', content: string }`で統一し、Mastraが要求する形式へ変換するMapperを一箇所に置く。
- 将来、MemoryやResourceスコープをDBに置き換える余地を残すため、threadIdは外部I/Fに含めて返却する。

## Renderer設計

- `src/renderer/src/lib/mastra-client.ts`: window.backendのMastra APIを呼び出すラッパー。ストリーミングはAsyncGeneratorで受け、AbortSignalに対応。
- UIコンポーネント `components/MastraMvpChat.tsx`（仮称）:  
  - セッション開始ボタン、入力欄、送信、ストリーム表示。セッションID/Thread ID表示。Abortボタンを配置。  
  - 既存`ChatPageWithSessions`とは別ルート。ホームまたはチャットヘッダーに「Mastra MVP」への導線を追加。
- ステートはコンポーネント内で完結（MVP）。将来SessionManagerと統合できるように型を合わせておく。

## エラーハンドリング

- Backendでの初期化・推論エラーは`mastraChatError`で通知し、Rendererはアラート表示とログ出力を行う。
- Abort時も必ず完了イベントを送る（UIがハングしないように）。
- 設定不足の場合は`startMastraSession`で明示的なエラーを返し、UIで警告を出す。

## テスト・検証

- typecheck: `pnpm run typecheck:node`を最低限実行。可能なら`typecheck:web`も。  
- 手動: Mastraチャット画面でメッセージ送信→ストリーム表示、Abortを確認。

## 拡張余地

- DB永続化: MastraのThread/ResourceをDrizzleで保存し、再起動後も復元する。
- モデル選択UI: 既存ModelSelectorをMastra経路にも流用する。
- MCP統合: Mastra側のtool呼び出しを有効化し、既存MCPマネージャと連携する。
