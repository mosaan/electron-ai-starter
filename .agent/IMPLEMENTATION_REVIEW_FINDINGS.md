# 実装レビュー結果：成果物の更新が必要な点

> 反復1、方向づけフェーズ
> 既存実装の調査完了日: 2025-11-25

本文書は、既存の実装を詳細に調査し、統一プロセスの要求ワークフロー成果物との差異を洗い出したものです。

---

## 1. ドメインモデルの更新が必要な点

### 1.1 追加すべき主要エンティティ

#### MessagePart（メッセージパート）
**概念**: メッセージの原子的なコンテンツブロック。メッセージは複数のパートから構成される。

**属性**:
- id: UUID
- messageId: UUID（外部キー）
- sessionId: UUID（外部キー）
- kind: Enum('text', 'tool_invocation', 'tool_result', 'attachment', 'metadata')
- sequence: Integer（順序番号）
- contentText: String（テキストコンテンツ）
- contentJson: JSON（JSON形式のコンテンツ）
- mimeType: String
- sizeBytes: Integer
- toolCallId: String（ツール呼び出しID）
- toolName: String
- status: Enum('pending', 'running', 'success', 'error', 'canceled')
- errorCode: String
- errorMessage: String
- relatedPartId: UUID（関連パートへの参照）
- metadata: JSON
- createdAt: Timestamp
- updatedAt: Timestamp

**関連**:
- 1つのメッセージは、1個以上のMessagePartを含む
- 1つのMessagePartは、0または1つの関連MessagePartを参照する

**ビジネスルール**:
- tool_invocationパートとtool_resultパートは、toolCallIdで対応づけられる
- パートはsequence順に処理される

---

#### ToolInvocation（ツール呼び出し）
**概念**: ツール実行のライフサイクルを専用に管理するエンティティ。MessagePartとは別にツール実行の詳細を記録する。

**属性**:
- id: UUID
- sessionId: UUID（外部キー）
- messageId: UUID（外部キー）
- invocationPartId: UUID（外部キー → MessagePart）
- resultPartId: UUID（外部キー → MessagePart、nullable）
- toolCallId: String（一意）
- toolName: String
- inputJson: JSON
- outputJson: JSON
- status: Enum('pending', 'running', 'success', 'error', 'canceled')
- errorCode: String
- errorMessage: String
- latencyMs: Integer（実行時間ミリ秒）
- startedAt: Timestamp
- completedAt: Timestamp
- createdAt: Timestamp
- updatedAt: Timestamp

**関連**:
- 1つのToolInvocationは、1つのinvocationPartを参照する
- 1つのToolInvocationは、0または1つのresultPartを参照する
- 1つのToolInvocationは、1つのメッセージに属する

**ビジネスルール**:
- toolCallIdは一意である
- latencyMsは、completedAt - startedAtから計算される

---

#### SessionSnapshot（セッションスナップショット）
**概念**: 会話履歴の圧縮用スナップショット。トークン制限対策として、古いメッセージを要約した内容を保存する。

**属性**:
- id: UUID
- sessionId: UUID（外部キー）
- kind: Enum('title', 'summary', 'memory')
- contentJson: JSON（要約内容）
- messageCutoffId: UUID（外部キー → ChatMessage、どこまでのメッセージが要約されたか）
- tokenCount: Integer（要約のトークン数）
- createdAt: Timestamp
- updatedAt: Timestamp

**関連**:
- 1つのSessionSnapshotは、1つのセッションに属する
- 1つのSessionSnapshotは、1つのメッセージ（カットオフポイント）を参照する

**ビジネスルール**:
- 1つのセッションは、複数のスナップショット（kind別）を持つことができる
- 要約は、messageCutoffIdまでのメッセージを含む

---

#### ModelConfig（モデル設定）
**概念**: AIモデルのメタデータとトークン制限情報。圧縮戦略の決定に使用される。

**属性**:
- id: String（"provider:model"形式）
- provider: String
- model: String
- maxInputTokens: Integer
- maxOutputTokens: Integer
- defaultCompressionThreshold: Real（デフォルト: 0.95）
- recommendedRetentionTokens: Integer（デフォルト: 1000）
- source: Enum('api', 'manual', 'default')
- lastUpdated: Timestamp
- createdAt: Timestamp

**関連**:
- 1つのChatSessionは、0または1つのModelConfigを参照する（modelId経由）

**ビジネスルール**:
- idは"provider:model"形式で一意である
- defaultCompressionThresholdは、会話履歴がこの比率に達したときに圧縮を開始する

---

### 1.2 既存エンティティの属性追加

#### ChatSession（会話セッション）に追加すべき属性:

| 属性 | 型 | 説明 |
|------|-----|------|
| archivedAt | Timestamp（nullable） | アーカイブ日時 |
| pinnedAt | Timestamp（nullable） | ピン留め日時 |
| providerConfigId | String（nullable） | AIプロバイダー設定ID（V2） |
| modelId | String（nullable） | 使用モデルID |
| messageCount | Integer（デフォルト: 0） | メッセージ数 |
| dataSchemaVersion | Integer（デフォルト: 1） | データスキーマバージョン |
| summary | JSON（nullable） | セッションサマリ |
| summaryUpdatedAt | Timestamp（nullable） | サマリ更新日時 |
| color | String（nullable） | セッションの色（UI用） |
| metadata | JSON（nullable） | 追加メタデータ |

**新しいビジネスルール**:
- archivedAtがnullでない場合、セッションはアーカイブされている
- pinnedAtがnullでない場合、セッションはピン留めされている
- messageCountは、セッションに属するメッセージの数を保持する（パフォーマンス最適化）

---

#### ChatMessage（メッセージ）に追加すべき属性:

| 属性 | 型 | 説明 |
|------|-----|------|
| state | Enum('pending', 'streaming', 'completed', 'error') | メッセージの状態 |
| sequence | Integer | セッション内の順序番号 |
| parentMessageId | UUID（nullable） | 親メッセージID |
| deletedAt | Timestamp（nullable） | 論理削除日時 |
| inputTokens | Integer（nullable） | 入力トークン数 |
| outputTokens | Integer（nullable） | 出力トークン数 |

**roleの値の追加**:
- 既存: 'user', 'assistant', 'system'
- 追加: **'tool'**（ツール実行結果メッセージ）

**新しいビジネスルール**:
- stateが'streaming'の場合、メッセージは現在ストリーミング中である
- sequenceは、セッション内でメッセージの順序を保証する
- deletedAtがnullでない場合、メッセージは論理削除されている

---

#### AIProvider（AIプロバイダー）の構造変更:

**重要な変更**: AI設定がV2に移行され、**AIProviderConfiguration**という新しい概念が導入されています。

**AIProviderConfiguration**:
- id: UUID（プロバイダー設定の一意識別子）
- name: String（ユーザー定義の設定名）
- type: Enum('openai', 'anthropic', 'google', 'azure')
- config: AIProviderConfig（APIキー、baseURLなど）
- models: AIModelDefinition[]（利用可能なモデルリスト）
- modelRefreshEnabled: Boolean
- modelLastRefreshed: Timestamp（nullable）
- enabled: Boolean
- createdAt: Timestamp
- updatedAt: Timestamp

**AIModelDefinition**:
- id: String（モデルID）
- source: Enum('api', 'custom', 'default')（モデルの取得元）
- isAvailable: Boolean（nullable）
- lastChecked: Timestamp（nullable）
- addedAt: Timestamp

**新しいビジネスルール**:
- 同じプロバイダータイプ（例：openai）でも、複数のAIProviderConfigurationを作成できる
- 各AIProviderConfigurationは、独立したAPIキーとモデルリストを持つ
- モデルは、API経由で自動リフレッシュできる（source='api'の場合）
- カスタムモデル（source='custom'）はAPI更新の影響を受けない

---

#### MCPServer（MCPサーバー）に追加すべき属性:

| 属性 | 型 | 説明 |
|------|-----|------|
| includeResources | Boolean（デフォルト: false） | リソースを含めるかどうか |

**runtimeStatus（実行時のみ存在）**:
- status: Enum('connected', 'stopped', 'error')
- error: String（nullable）
- errorDetails: String（nullable、stderrキャプチャ）
- updatedAt: Timestamp

**新しいビジネスルール**:
- MCPサーバーのstderr出力は、診断のためにキャプチャされる（最新10行）
- プロセス終了コードとシグナルも記録される

---

## 2. ユースケースモデルの更新が必要な点

### UC-03: AI設定を管理する

**現在の記述では不十分な点**:

基本フローを以下のように更新すべき：

1. ユーザーが設定画面を開く
2. **ユーザーが「新しいプロバイダー設定を追加」を選択する**
3. ユーザーがプロバイダータイプ（OpenAI、Anthropic、Google、Azure）を選択する
4. **ユーザーが設定に名前を付ける（例：「会社用OpenAI」「個人用OpenAI」）**
5. ユーザーがAPIキーを入力する
6. **（オプション）ユーザーがカスタムbaseURLを入力する（Azure、プライベートエンドポイント用）**
7. **システムがデフォルトのモデルリストを読み込む**
8. **ユーザーが「モデルをAPIから更新」を選択する（オプション）**
   - システムがプロバイダーAPIからモデルリストを取得する
   - システムがモデルリストを更新する（カスタムモデルは保持）
9. **ユーザーがカスタムモデルを追加する（オプション）**
10. ユーザーがデフォルトで使用するモデルを選択する
11. システムが設定をデータベースに保存する
12. （オプション）ユーザーが接続テストを実行する
13. システムが選択したAIプロバイダーとの接続を確認する

**追加の代替フロー**:
- 8a. モデルリストのAPI取得に失敗する
  - システムがエラーを表示する
  - システムが既存のモデルリストを保持する
- 9a. カスタムモデルIDが既に存在する
  - システムがエラーメッセージを表示する
  - ユーザーが別のモデルIDを入力する

**新しいユースケース: UC-03b: AIプロバイダー設定を編集する**
- 既存の設定の名前、APIキー、モデルリストを編集する
- モデルをAPIから更新する
- カスタムモデルを追加・削除する

**新しいユースケース: UC-03c: AIプロバイダー設定を削除する**
- 使用していない設定を削除する
- デフォルト選択されている設定を削除する場合は警告を表示する

---

### UC-02: 会話セッションを管理する

**追加すべき基本フロー**:

5. **ユーザーがセッションをアーカイブする**
   - システムがセッションにarchivedAtをセットする
   - システムがセッションをアーカイブリストに移動する
6. **ユーザーがセッションをピン留めする**
   - システムがセッションにpinnedAtをセットする
   - システムがセッションをリストの上部に固定表示する
7. **ユーザーがセッションに色を設定する**
   - システムがセッションのcolor属性を更新する
   - システムがUIでセッションをカラー表示する

---

## 3. 特色リストの更新が必要な点

### 追加すべき特色

#### 1.7 メッセージの状態管理
- **説明**: メッセージの状態（pending、streaming、completed、error）を管理し、UIに反映
- **優先度**: 高
- **状態**: 実装済み

#### 1.8 メッセージのパート構造
- **説明**: メッセージを原子的なパート（text、tool_invocation、tool_result、attachment、metadata）に分割して管理
- **優先度**: 高
- **状態**: 実装済み

#### 1.9 ツール呼び出しのライフサイクル管理
- **説明**: ツール実行の詳細（レイテンシ、開始時刻、完了時刻、エラー詳細）を専用テーブルで管理
- **優先度**: 中
- **状態**: 実装済み

#### 1.10 MCPサーバーのstderrキャプチャ
- **説明**: MCPサーバーの標準エラー出力をキャプチャして診断情報として表示
- **優先度**: 中
- **状態**: 実装済み

#### 2.3 セッションのアーカイブ機能
- **説明**: 古い会話セッションをアーカイブして整理
- **優先度**: 低
- **状態**: 実装済み

#### 2.4 セッションのピン留め機能
- **説明**: 重要な会話セッションをリストの上部に固定表示
- **優先度**: 低
- **状態**: 実装済み

#### 2.5 セッションの色分け機能
- **説明**: セッションに色を設定してUIで視覚的に区別
- **優先度**: 低
- **状態**: 実装済み

#### 3.4 AIプロバイダー設定V2（複数プロバイダー設定）
- **説明**: 同じプロバイダータイプでも複数の設定を作成・管理（例：会社用OpenAI、個人用OpenAI）
- **優先度**: 高
- **状態**: 実装済み

#### 3.5 モデルのAPI経由自動リフレッシュ
- **説明**: プロバイダーAPIからモデルリストを取得して自動更新（カスタムモデルは保持）
- **優先度**: 中
- **状態**: 実装済み

#### 3.6 カスタムモデルの追加
- **説明**: ユーザーが手動でカスタムモデルIDを追加
- **優先度**: 中
- **状態**: 実装済み

#### 2.6 モデル設定テーブル
- **説明**: AIモデルのメタデータ（トークン制限、圧縮閾値）をデータベースで管理
- **優先度**: 中
- **状態**: 実装済み（データ入力は今後）

---

## 4. 補足要求の仕様書の更新が必要な点

### 機能要求（FR）の追加

#### データ永続化の詳細化

**FR-09**: システムは、メッセージを原子的なパート（text、tool_invocation、tool_result、attachment、metadata）として保存しなければならない

**FR-10**: システムは、ツール呼び出しのライフサイクル（開始時刻、完了時刻、レイテンシ、ステータス）を専用テーブルで管理しなければならない

**FR-11**: システムは、会話履歴の圧縮用スナップショット（要約、カットオフポイント、トークン数）をセッションごとに保存しなければならない

**FR-12**: システムは、AIモデルのメタデータ（トークン制限、圧縮閾値）をデータベースで管理しなければならない

#### AI設定管理の詳細化

**FR-13**: システムは、同じプロバイダータイプでも複数のAI設定を作成・管理できなければならない

**FR-14**: システムは、プロバイダーAPIからモデルリストを取得して自動更新する機能を提供しなければならない

**FR-15**: システムは、ユーザーがカスタムモデルIDを手動で追加できる機能を提供しなければならない

**FR-16**: システムは、API取得モデル（source='api'）とカスタムモデル（source='custom'）を区別して管理しなければならない

#### MCP管理の詳細化

**FR-17**: システムは、MCPサーバーの標準エラー出力（stderr）をキャプチャし、最新10行を保持しなければならない

**FR-18**: システムは、MCPサーバープロセスの終了コードとシグナルを記録しなければならない

---

## 5. 実装済みだがドキュメント化されていない重要な設計判断

### 5.1 メッセージのパート構造による柔軟性

実装では、メッセージを複数のパートに分割する設計を採用しています。これにより：
- テキストとツール呼び出しを同一メッセージ内で混在できる
- 将来的な拡張（添付ファイル、画像など）が容易
- ツール呼び出しとツール結果を明示的に関連づけられる

### 5.2 ToolInvocationテーブルによる詳細追跡

MessagePartとは別にToolInvocationテーブルを設けることで：
- ツール実行のパフォーマンス分析が可能（latencyMs）
- ツール呼び出しの成功率やエラー傾向を分析できる
- 将来的なツール使用統計の基盤となる

### 5.3 AI設定V2の複数設定サポート

AISettingsV2では、同じプロバイダータイプでも複数の設定を持てるようになっています：
- 企業用と個人用でAPIキーを使い分け
- 本番環境とテスト環境でbaseURLを切り替え
- 異なる用途に応じてモデルリストを最適化

この設計は、エンタープライズ利用を想定したものです。

### 5.4 MCPサーバーのstderrキャプチャによる診断性向上

MCPサーバーのstderrを自動的にキャプチャすることで：
- サーバー起動失敗時の原因を即座に診断できる
- ユーザーがログファイルを探す必要がない
- サポート担当者がエラー詳細を容易に確認できる

---

## 次のステップ

1. **ドメインモデルの更新** - 上記の4つの新しいエンティティと既存エンティティの属性追加を反映
2. **ユースケースモデルの更新** - UC-03の詳細化とUC-03b、UC-03cの追加
3. **特色リストの更新** - 実装済みの10個の特色を追加
4. **補足要求の仕様書の更新** - FR-09からFR-18を追加

これらの更新により、統一プロセスの成果物が実装の現状を正確に反映します。

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-11-25 | 1.0 | 初版作成（反復1、方向づけフェーズ） |
