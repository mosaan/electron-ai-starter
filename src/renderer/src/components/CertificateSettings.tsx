import { useState, useEffect, useCallback } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@renderer/components/ui/card'
import { CheckCircle, Loader2, RefreshCw, FileText, XCircle } from 'lucide-react'
import type { CertificateSettings, CertificateMode, ConnectionTestResult } from '@common/types'
import { isOk } from '@common/result'
import { logger } from '@renderer/lib/logger'

interface CertificateSettingsProps {
  className?: string
}

export function CertificateSettings({
  className = ''
}: CertificateSettingsProps): React.JSX.Element {
  const [mode, setMode] = useState<CertificateMode>('system')
  const [certificateCount, setCertificateCount] = useState(0)
  const [rejectUnauthorized, setRejectUnauthorized] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingSystem, setIsLoadingSystem] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [testSuccess, setTestSuccess] = useState(false)
  const [testError, setTestError] = useState(false)
  const [testMessage, setTestMessage] = useState<string>('')

  const loadSettings = useCallback(async (): Promise<void> => {
    try {
      await window.connectBackend()
      const result = await window.backend.getCertificateSettings()
      if (isOk(result)) {
        const settings = result.value
        setMode(settings.mode)
        setCertificateCount(settings.customCertificates?.length || 0)
        setRejectUnauthorized(settings.rejectUnauthorized !== false)
      } else {
        logger.error('Failed to get certificate settings:', result.error)
      }
    } catch (error) {
      logger.error('Failed to load certificate settings:', error)
    }
  }, [])

  const loadSystemSettings = async (): Promise<void> => {
    setIsLoadingSystem(true)
    try {
      const result = await window.backend.getSystemCertificateSettings()
      if (isOk(result)) {
        const settings = result.value
        setMode('system')
        setCertificateCount(settings.customCertificates?.length || 0)
        setRejectUnauthorized(settings.rejectUnauthorized !== false)
      } else {
        logger.error('Failed to get system certificate settings:', result.error)
      }
    } catch (error) {
      logger.error('Failed to load system certificate settings:', error)
    } finally {
      setIsLoadingSystem(false)
    }
  }

  const saveSettings = async (): Promise<void> => {
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      // Get current settings to preserve custom certificates if in custom mode
      const currentResult = await window.backend.getCertificateSettings()
      const currentSettings: CertificateSettings = isOk(currentResult)
        ? currentResult.value
        : { mode: 'none' }

      const settings: CertificateSettings = {
        mode,
        rejectUnauthorized,
        customCertificates:
          mode === 'custom' ? currentSettings.customCertificates : undefined
      }

      const result = await window.backend.setCertificateSettings(settings)
      if (isOk(result)) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
        logger.info('Certificate settings saved successfully')
      } else {
        logger.error('Failed to save certificate settings:', result.error)
      }
    } catch (error) {
      logger.error('Failed to save certificate settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleModeChange = async (newMode: CertificateMode): Promise<void> => {
    setMode(newMode)
    if (newMode === 'system') {
      await loadSystemSettings()
    } else if (newMode === 'none') {
      setCertificateCount(0)
    }
  }

  const testConnection = async (): Promise<void> => {
    setIsTesting(true)
    setTestSuccess(false)
    setTestError(false)
    setTestMessage('')

    try {
      // Get current settings to test
      const currentResult = await window.backend.getCertificateSettings()
      const currentSettings: CertificateSettings = isOk(currentResult)
        ? currentResult.value
        : { mode: 'none' }

      const settings: CertificateSettings = {
        mode,
        rejectUnauthorized,
        customCertificates:
          mode === 'custom' ? currentSettings.customCertificates : undefined
      }

      const result = await window.backend.testCertificateConnection(settings)

      if (isOk(result)) {
        const testResult: ConnectionTestResult = result.value
        if (testResult.success) {
          setTestSuccess(true)
          setTestMessage(
            `${testResult.message}${testResult.details?.responseTime ? ` (${testResult.details.responseTime}ms)` : ''}`
          )
          setTimeout(() => {
            setTestSuccess(false)
            setTestMessage('')
          }, 5000)
        } else {
          setTestError(true)
          let errorMsg = testResult.message
          if (testResult.details?.error) {
            errorMsg += `\n\nDetails: ${testResult.details.error}`
          }
          if (testResult.details?.errorType) {
            errorMsg += `\nType: ${testResult.details.errorType}`
          }
          setTestMessage(errorMsg)
          setTimeout(() => {
            setTestError(false)
            setTestMessage('')
          }, 8000)
        }
      } else {
        setTestError(true)
        setTestMessage('Failed to test connection')
        setTimeout(() => {
          setTestError(false)
          setTestMessage('')
        }, 5000)
      }
    } catch (error) {
      logger.error('Failed to test certificate connection:', error)
      setTestError(true)
      setTestMessage(`Error: ${error instanceof Error ? error.message : String(error)}`)
      setTimeout(() => {
        setTestError(false)
        setTestMessage('')
      }, 5000)
    } finally {
      setIsTesting(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Certificate Settings</CardTitle>
        <CardDescription>
          Configure SSL/TLS certificate settings for secure connections
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cert-mode">Certificate Mode</Label>
          <Select value={mode} onValueChange={handleModeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System Certificates</SelectItem>
              <SelectItem value="custom">Custom Certificates</SelectItem>
              <SelectItem value="none">Default (Node.js)</SelectItem>
            </SelectContent>
          </Select>
          {mode === 'system' && (
            <p className="text-sm text-gray-600">
              Using certificates from Windows certificate store
            </p>
          )}
          {mode === 'custom' && (
            <p className="text-sm text-gray-600">
              Custom certificates feature coming soon
            </p>
          )}
        </div>

        {mode !== 'none' && (
          <div className="space-y-2">
            <Label htmlFor="cert-count">Loaded Certificates</Label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md border">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-700">
                {certificateCount} certificate{certificateCount !== 1 ? 's' : ''} loaded
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="reject-unauthorized">Security</Label>
          <Select
            value={rejectUnauthorized ? 'true' : 'false'}
            onValueChange={(v) => setRejectUnauthorized(v === 'true')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Reject unauthorized certificates (Recommended)</SelectItem>
              <SelectItem value="false">Accept all certificates (Insecure)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-gray-600">
            {rejectUnauthorized
              ? 'Connections with invalid certificates will be rejected'
              : 'WARNING: Accepting all certificates is insecure and not recommended'}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              onClick={testConnection}
              disabled={isTesting}
              variant={
                testSuccess ? 'default' : testError ? 'destructive' : 'outline'
              }
              size="sm"
              className={
                testSuccess
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : testError
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : ''
              }
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : testSuccess ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Connected!
                </>
              ) : testError ? (
                <>
                  <XCircle className="h-4 w-4" />
                  Failed
                </>
              ) : (
                'Test Connection'
              )}
            </Button>

            {mode === 'system' && (
              <Button
                onClick={loadSystemSettings}
                disabled={isLoadingSystem}
                variant="outline"
                size="sm"
              >
                {isLoadingSystem ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reloading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Reload System Certificates
                  </>
                )}
              </Button>
            )}
          </div>

          <Button
            onClick={saveSettings}
            disabled={isSaving}
            size="sm"
            variant={saveSuccess ? 'default' : 'default'}
            className={saveSuccess ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Settings Saved!
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>

        {testMessage && (
          <div
            className={`mt-2 p-3 rounded-md text-sm ${
              testSuccess
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-orange-50 text-orange-800 border border-orange-200'
            }`}
          >
            <div className="whitespace-pre-wrap">{testMessage}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
