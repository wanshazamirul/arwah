'use client'

import { useState, useRef } from 'react'
import { Download, Upload, X } from 'lucide-react'

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null) // Store actual File object
  const [processedImage, setProcessedImage] = useState<string | null>(null)
  const [deceasedName, setDeceasedName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Process image with canvas
  const processImage = async (file: File, name: string) => {
    setIsProcessing(true)

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

    // Calculate circular crop position (center of template)
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2 - 50
    const circleRadius = Math.min(canvas.width, canvas.height) * 0.18

    // Create circular clip for uploaded photo
    ctx.save()
    ctx.beginPath()
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2)
    ctx.clip()

    // Calculate image dimensions to fit circle
    const scale = (circleRadius * 2) / Math.max(img.width, img.height) * 1.2
    const scaledWidth = img.width * scale
    const scaledHeight = img.height * scale
    const x = centerX - scaledWidth / 2
    const y = centerY - scaledHeight / 2

    // Draw uploaded image in color first
    ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

    // Convert to grayscale
    const imageData = ctx.getImageData(
      centerX - circleRadius,
      centerY - circleRadius,
      circleRadius * 2,
      circleRadius * 2
    )
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      data[i] = gray     // R
      data[i + 1] = gray // G
      data[i + 2] = gray // B
    }

    ctx.putImageData(imageData, centerX - circleRadius, centerY - circleRadius)
    ctx.restore()

    // Add feather effect OUTSIDE the circle edge
    // This creates a soft transition from the circle to the background
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'

    // Create gradient from transparent (at circle edge) to white (outside)
    const featherRadius = circleRadius * 1.15 // 15% feather outside
    const gradient = ctx.createRadialGradient(
      centerX, centerY, circleRadius * 0.95,
      centerX, centerY, featherRadius
    )
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.5)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.8)')

    // Draw feather ring outside the circle
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(centerX, centerY, featherRadius, 0, Math.PI * 2)
    ctx.fill()

    // Clear the inner part to show the photo clearly
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()

    // Add deceased name if provided - DRAWN LAST for top layer
    if (name.trim()) {
      const fontSize = Math.max(36, canvas.width * 0.045)
      const nameY = centerY + circleRadius + 90

      // Draw shadow for better visibility
      ctx.save()
      ctx.textAlign = 'center'
      ctx.font = `bold ${fontSize}px serif`

      // Shadow
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.fillText(name.toUpperCase(), centerX + 2, nameY + 2)

      // Main text
      ctx.fillStyle = '#000000'
      ctx.fillText(name.toUpperCase(), centerX, nameY)
      ctx.restore()

      console.log('Name drawn:', name.toUpperCase(), 'at Y:', nameY, 'font size:', fontSize)
    }

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        setProcessedImage(url)
        setIsProcessing(false)
      }
    }, 'image/png')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file) // Store the File object
      const reader = new FileReader()
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string)
        setProcessedImage(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleProcess = () => {
    // Use the stored File object instead of reading from input again
    if (uploadedFile) {
      processImage(uploadedFile, deceasedName)
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
    setUploadedFile(null) // Clear the File object
    setProcessedImage(null)
    setDeceasedName('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
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
                    Generate Card
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
