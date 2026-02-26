'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, Upload, X } from 'lucide-react'

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [processedImage, setProcessedImage] = useState<string | null>(null)
  const [livePreview, setLivePreview] = useState<string | null>(null)
  const [deceasedName, setDeceasedName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Manual crop controls
  const [circleSize, setCircleSize] = useState(18) // Percentage of min dimension
  const [featherAmount, setFeatherAmount] = useState(30) // Feather percentage (0-100)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Process image with canvas (shared function for both preview and final)
  const processImage = async (
    file: File,
    name: string,
    options: {
      circleSize: number
      featherAmount: number
      isPreview?: boolean
    }
  ): Promise<string | null> => {
    const { circleSize: size, featherAmount: feather, isPreview = false } = options

    const img = new Image()
    const template = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    // Load images
    const loadImg = (src: string) => new Promise<void>((resolve) => {
      img.onload = () => resolve()
      img.src = src
    })

    const loadTemplate = () => new Promise<void>((resolve) => {
      template.onload = () => resolve()
      template.src = '/template.jpg'
    })

    await Promise.all([loadImg(URL.createObjectURL(file)), loadTemplate()])

    // Use template's actual dimensions to maintain ratio
    canvas.width = template.width
    canvas.height = template.height

    // Draw template background at original size
    ctx.drawImage(template, 0, 0)

    // Calculate circular crop position (always dead center)
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2 - 50
    const circleRadius = Math.min(canvas.width, canvas.height) * (size / 100)

    // Create a temporary canvas for the photo with feathering
    // FIXED SIZE - image scale doesn't change when circle size changes
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')!

    // Use a fixed large enough size for the temp canvas
    // This ensures the image stays at consistent scale
    const maxRadius = Math.min(canvas.width, canvas.height) * 0.30 // Fixed at 30% max
    const fixedSize = maxRadius * 2 + 100 // Extra space for feathering
    tempCanvas.width = fixedSize
    tempCanvas.height = fixedSize

    // Calculate image dimensions at FIXED scale (doesn't change with circle size)
    const scale = (maxRadius * 2) / Math.max(img.width, img.height) * 1.2
    const scaledWidth = img.width * scale
    const scaledHeight = img.height * scale

    // Center image on temp canvas
    const tempX = (fixedSize - scaledWidth) / 2
    const tempY = (fixedSize - scaledHeight) / 2
    tempCtx.drawImage(img, tempX, tempY, scaledWidth, scaledHeight)

    // Convert to grayscale on temp canvas
    const imageData = tempCtx.getImageData(0, 0, fixedSize, fixedSize)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      data[i] = gray
      data[i + 1] = gray
      data[i + 2] = gray
    }

    tempCtx.putImageData(imageData, 0, 0)

    // Create circular mask with feathering
    const featherRadius = (feather / 100) * 50 // Max 50px feather

    if (feather === 0) {
      // No feathering - simple circular clip
      tempCtx.globalCompositeOperation = 'destination-in'
      tempCtx.beginPath()
      tempCtx.arc(fixedSize / 2, fixedSize / 2, circleRadius, 0, Math.PI * 2)
      tempCtx.fill()
    } else {
      // With feathering - use gradient
      const innerRadius = Math.max(0, circleRadius - featherRadius)
      const outerRadius = circleRadius

      const gradient = tempCtx.createRadialGradient(
        fixedSize / 2, fixedSize / 2, innerRadius,
        fixedSize / 2, fixedSize / 2, outerRadius
      )
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)')
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

      tempCtx.globalCompositeOperation = 'destination-in'
      tempCtx.fillStyle = gradient
      tempCtx.fillRect(0, 0, fixedSize, fixedSize)
    }

    // Draw the feathered photo onto the main canvas (centered)
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(
      tempCanvas,
      centerX - fixedSize / 2,
      centerY - fixedSize / 2
    )

    // Add deceased name if provided - DRAWN LAST for top layer
    if (name.trim()) {
      const fontSize = Math.max(36, canvas.width * 0.045)
      const nameY = centerY + circleRadius + 50

      ctx.save()
      ctx.textAlign = 'center'
      ctx.font = `bold ${fontSize}px Arial`

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillText(name.toUpperCase(), centerX + 2, nameY + 2)

      ctx.fillStyle = '#FFFFFF'
      ctx.fillText(name.toUpperCase(), centerX, nameY)
      ctx.restore()

      if (!isPreview) {
        console.log('Name drawn:', name.toUpperCase(), 'at Y:', nameY, 'font size:', fontSize)
      }
    }

    // Convert to blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          resolve(url)
        } else {
          resolve(null)
        }
      }, 'image/png')
    })
  }

  // Update live preview when controls change
  useEffect(() => {
    if (uploadedFile) {
      // Debounce preview updates for performance
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current)
      }

      previewTimeoutRef.current = setTimeout(() => {
        processImage(uploadedFile, deceasedName, {
          circleSize,
          featherAmount,
          isPreview: true
        }).then(setLivePreview)
      }, 100)
    }

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current)
      }
    }
  }, [circleSize, featherAmount, deceasedName, uploadedFile])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string)
        setProcessedImage(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleProcess = async () => {
    if (uploadedFile) {
      setIsProcessing(true)
      const result = await processImage(uploadedFile, deceasedName, {
        circleSize,
        featherAmount
      })
      setProcessedImage(result)
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (processedImage) {
      const a = document.createElement('a')
      a.href = processedImage
      a.download = `tahlil-${deceasedName || 'card'}.png`
      a.click()
    }
  }

  const handleReset = () => {
    setUploadedImage(null)
    setUploadedFile(null)
    setProcessedImage(null)
    setLivePreview(null)
    setDeceasedName('')
    setCircleSize(18)
    setFeatherAmount(30)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Arwah</h1>
          <p className="text-slate-400">Tahlil / Al-Fatihah Memorial Card Generator</p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-slate-700">
          {!processedImage ? (
            <>
              {/* Upload Section */}
              <div className="mb-6">
                <label
                  className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-slate-400 hover:bg-slate-700/30 transition-all"
                >
                  {uploadedImage ? (
                    <div className="relative">
                      <img
                        src={uploadedImage}
                        alt="Preview"
                        className="h-56 object-contain rounded-lg"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleReset()
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-slate-400 mb-4" />
                      <p className="text-slate-300 font-medium">Click to upload photo</p>
                      <p className="text-slate-500 text-sm mt-2">JPG, PNG supported</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Live Preview */}
              {livePreview && (
                <div className="mb-6">
                  <h3 className="text-white font-medium mb-3">Live Preview</h3>
                  <div className="border-2 border-emerald-500 rounded-lg overflow-hidden">
                    <img
                      src={livePreview}
                      alt="Live preview"
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {/* Name Input (Optional) */}
              <div className="mb-6">
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Nama Si Mat (Optional)
                </label>
                <input
                  type="text"
                  value={deceasedName}
                  onChange={(e) => setDeceasedName(e.target.value)}
                  placeholder="Contoh: Allahyarham Haji Ahmad"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              {/* Manual Crop Controls */}
              {uploadedImage && (
                <div className="mb-6 p-4 bg-slate-700/50 rounded-lg space-y-4">
                  <h3 className="text-white font-medium mb-3">Adjust Crop & Feather</h3>

                  {/* Circle Size */}
                  <div>
                    <label className="text-slate-300 text-sm flex justify-between mb-1">
                      <span>Circle Size (Crop Area)</span>
                      <span className="text-slate-400">{circleSize}%</span>
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="30"
                      value={circleSize}
                      onChange={(e) => setCircleSize(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>

                  {/* Feather Amount */}
                  <div>
                    <label className="text-slate-300 text-sm flex justify-between mb-1">
                      <span>Feather Amount (Edge Softness)</span>
                      <span className="text-slate-400">{featherAmount}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={featherAmount}
                      onChange={(e) => setFeatherAmount(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                    <p className="text-slate-500 text-xs mt-1">0% = sharp edge, 100% = very soft feather</p>
                  </div>
                </div>
              )}

              {/* Process Button */}
              <button
                onClick={handleProcess}
                disabled={!uploadedFile || isProcessing}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload size={20} />
                    Generate Final Card
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Result Section */}
              <div className="mb-6">
                <img
                  src={processedImage}
                  alt="Generated Card"
                  className="w-full rounded-lg shadow-lg"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleDownload}
                  className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <Download size={20} />
                  Download
                </button>
                <button
                  onClick={handleReset}
                  className="px-6 py-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Foto diproses di pelayar sahaja • Tiada data dimuat naik
        </p>
      </div>
    </div>
  )
}
