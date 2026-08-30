import { Button } from '../../../shared'
import './UploadActions.css'

type UploadActionsProps = {
  disabled: boolean
  isAnalyzing?: boolean
  onAnalyze: () => void
}

export function UploadActions({
  disabled,
  isAnalyzing = false,
  onAnalyze,
}: UploadActionsProps) {
  return (
    <div className="upload-actions">
      <Button disabled={disabled || isAnalyzing} onClick={onAnalyze}>
        {isAnalyzing ? 'Analiz ediliyor...' : 'Analiz Et'}
      </Button>
    </div>
  )
}
