import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  X,
  FileImage,
  AlertCircle,
  CheckCircle,
  Loader2,
  CreditCard,
  Package,
  Camera
} from 'lucide-react'

interface FileUploadModalProps {
  type: 'payment' | 'receipt'
  onClose: () => void
  onSubmit: (file: File) => void
}

interface FileWithPreview extends File {
  preview: string
}

export default function FileUploadModal({
  type,
  onClose,
  onSubmit
}: FileUploadModalProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getUploadConfig = () => {
    if (type === 'payment') {
      return {
        title: 'Upload Payment Proof',
        description: 'Share proof of payment for this transaction',
        icon: <CreditCard className="w-5 h-5" />,
        accept: {
          'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
          'application/pdf': ['.pdf']
        },
        maxSize: 10 * 1024 * 1024, // 10MB
        helpText: 'Accepted formats: JPEG, PNG, GIF, PDF (Max 10MB)'
      }
    } else {
      return {
        title: 'Upload Shipping Receipt',
        description: 'Share proof that the item has been shipped',
        icon: <Package className="w-5 h-5" />,
        accept: {
          'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
          'application/pdf': ['.pdf']
        },
        maxSize: 10 * 1024 * 1024, // 10MB
        helpText: 'Accepted formats: JPEG, PNG, GIF, PDF (Max 10MB)'
      }
    }
  }

  const config = getUploadConfig()

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null)

    if (rejectedFiles.length > 0) {
      const rejectionReason = rejectedFiles[0].errors[0]
      if (rejectionReason.code === 'file-too-large') {
        setError('File size exceeds 10MB limit')
      } else if (rejectionReason.code === 'file-invalid-type') {
        setError('Invalid file type. Please use images or PDF only.')
      } else {
        setError('File upload failed. Please try again.')
      }
      return
    }

    const filesWithPreview = acceptedFiles.map(file =>
      Object.assign(file, {
        preview: URL.createObjectURL(file)
      })
    )

    // Only allow one file at a time
    setFiles(filesWithPreview.slice(0, 1))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: config.accept,
    maxSize: config.maxSize,
    multiple: false,
    disabled: isUploading
  })

  const handleRemoveFile = () => {
    setFiles([])
    setError(null)
  }

  const handleSubmit = async () => {
    if (files.length === 0) {
      setError('Please select a file to upload')
      return
    }

    setIsUploading(true)
    setError(null)

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 200)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      setUploadProgress(100)

      setTimeout(() => {
        onSubmit(files[0])
        onClose()
      }, 500)
    } catch (error) {
      setError('Upload failed. Please try again.')
      clearInterval(progressInterval)
      setUploadProgress(0)
    } finally {
      setIsUploading(false)
      setTimeout(() => {
        clearInterval(progressInterval)
        setUploadProgress(0)
      }, 3000)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            {config.icon}
            <span className="ml-2">{config.title}</span>
          </DialogTitle>
          <DialogDescription>
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-400 bg-blue-50'
                : isUploading
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />

            {files.length > 0 ? (
              <div className="space-y-3">
                <FilePreview file={files[0]} onRemove={handleRemoveFile} disabled={isUploading} />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  {isDragActive ? (
                    <Upload className="w-6 h-6 text-blue-600 animate-bounce" />
                  ) : (
                    <Camera className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {isDragActive ? 'Drop file here' : config.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {isDragActive
                      ? 'Release to upload'
                      : 'Drag and drop or click to browse'
                    }
                  </p>
                </div>
                <div className="flex items-center justify-center">
                  <Badge variant="outline" className="text-xs">
                    {config.helpText}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Uploading...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 text-red-600 mr-2 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {uploadProgress === 100 && !error && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                <p className="text-sm text-green-600">Upload completed successfully!</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isUploading}
              className="flex-1"
            >
              {uploadProgress === 100 ? 'Close' : 'Cancel'}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={files.length === 0 || isUploading}
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {type === 'payment' ? 'Proof' : 'Receipt'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface FilePreviewProps {
  file: FileWithPreview
  onRemove: () => void
  disabled: boolean
}

function FilePreview({ file, onRemove, disabled }: FilePreviewProps) {
  const isImage = file.type.startsWith('image/')

  return (
    <div className="relative bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center space-x-3 p-3">
        <div className="flex-shrink-0">
          {isImage ? (
            <img
              src={file.preview}
              alt="Preview"
              className="w-16 h-16 object-cover rounded"
              onLoad={() => {
                URL.revokeObjectURL(file.preview)
              }}
            />
          ) : (
            <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
              <FileImage className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {file.name}
          </p>
          <p className="text-xs text-gray-500">
            {file.type} • {formatFileSize(file.size)}
          </p>
        </div>
        {!disabled && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="flex-shrink-0 p-1 h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}