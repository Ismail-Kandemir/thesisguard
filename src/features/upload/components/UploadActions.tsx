import { Button } from '../../../shared'
import './UploadActions.css'

type UploadActionsProps = {
  disabled: boolean
  disabledReason?: string
  isAnalyzing?: boolean
  onAnalyze: () => void
}

export function UploadActions({
  disabled,
  disabledReason,
  isAnalyzing = false,
  onAnalyze,
}: UploadActionsProps) {
  return (
    <div className="upload-actions">
      {disabled && !isAnalyzing && disabledReason ? (
        <p className="upload-actions__disabled-reason">{disabledReason}</p>
      ) : null}
      <Button disabled={disabled || isAnalyzing} onClick={onAnalyze}>
        {isAnalyzing ? 'Analiz ediliyor...' : disabled ? 'Eksikleri Tamamlayın' : 'Analiz Et'}
      </Button>
    </div>
  )
}
